import 'server-only';

import type { OrderLine, Tab, TabSeat, Zone, ServiceTable, CatalogueStatus, TableStatus } from '@bliss/shared/domain';
import { type Cents, ZERO, add, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import type { Actor } from '@bliss/shared/reason';
import { createUuidV7 } from '@bliss/shared/id';
import { isSeated, tabLabel } from '@bliss/shared/trade';
import { dataset } from '../_data/source';
import * as audit from '../audit/service';
import { assertCan } from '../identity/service';
import { tradeTables } from './schema';

const createId = createUuidV7();

export function zones() {
  return [...tradeTables().zones].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function tables() {
  return tradeTables().tables;
}

export function tableById(id: string | null) {
  return id ? (tradeTables().tables.find((t) => t.id === id) ?? null) : null;
}

export function zoneById(id: string | null) {
  return id ? (tradeTables().zones.find((z) => z.id === id) ?? null) : null;
}

let lineIndex: { source: OrderLine[]; length: number; byTab: Map<string, OrderLine[]> } | null = null;
let seatIndex: { source: TabSeat[]; length: number; byTab: Map<string, TabSeat[]> } | null = null;

function linesByTab() {
  const { lines } = tradeTables();
  if (lineIndex && lineIndex.source === lines && lineIndex.length === lines.length) return lineIndex.byTab;
  const byTab = new Map<string, OrderLine[]>();
  for (const l of lines) byTab.set(l.tabId, [...(byTab.get(l.tabId) ?? []), l]);
  lineIndex = { source: lines, length: lines.length, byTab };
  return byTab;
}

function seatsByTab() {
  const { seats } = tradeTables();
  if (seatIndex && seatIndex.source === seats && seatIndex.length === seats.length) return seatIndex.byTab;
  const byTab = new Map<string, TabSeat[]>();
  for (const s of seats) byTab.set(s.tabId, [...(byTab.get(s.tabId) ?? []), s]);
  seatIndex = { source: seats, length: seats.length, byTab };
  return byTab;
}

export function linesFor(tabId: string): OrderLine[] {
  return linesByTab().get(tabId) ?? [];
}

export function seatsFor(tabId: string): TabSeat[] {
  return [...(seatsByTab().get(tabId) ?? [])].sort((a, b) => a.seatNo - b.seatNo);
}

export function tabTotal(tabId: string): Cents {
  return sum(linesFor(tabId).filter((l) => l.status !== 'voided').map((l) => l.lineTotalCents));
}

export interface TabSummary {
  tab: Tab;
  tableLabel: string;
  zoneName: string;
  seats: (TabSeat & { total: Cents; lineCount: number })[];
  sharedTotal: Cents;
  total: Cents;
  lineCount: number;
  pendingCount: number;
  lastFiredAt: number | null;
}

export function summarise(tab: Tab): TabSummary {
  const lines = linesFor(tab.id).filter((l) => l.status !== 'voided');
  const seats = seatsFor(tab.id).map((s) => {
    const own = lines.filter((l) => l.tabSeatId === s.id);
    return { ...s, total: sum(own.map((l) => l.lineTotalCents)), lineCount: own.length };
  });
  const orders = tradeTables().orders.filter((o) => o.tabId === tab.id);
  return {
    tab,
    tableLabel: tabLabel({ tableLabel: tableById(tab.serviceTableId)?.label, name: tab.name }),
    zoneName: tradeTables().zones.find((z) => z.id === tab.zoneId)?.name ?? '',
    seats,
    sharedTotal: sum(lines.filter((l) => l.tabSeatId === null).map((l) => l.lineTotalCents)),
    total: sum(lines.map((l) => l.lineTotalCents)),
    lineCount: lines.length,
    pendingCount: lines.filter((l) => l.status === 'pending').length,
    lastFiredAt: orders.reduce<number | null>((max, o) => (o.firedAt && (!max || o.firedAt > max) ? o.firedAt : max), null),
  };
}

export function openTabs(): TabSummary[] {
  return tradeTables()
    .tabs.filter((t) => t.status === 'open' || t.status === 'part_settled' || t.status === 'settling')
    .sort((a, b) => a.openedAt - b.openedAt)
    .map(summarise);
}

/** Tonight's tabs that are paid but still at their table. docs/16 section 8. */
export function seatedTabs(): Tab[] {
  const date = dataset().currentBusinessDate;
  return tradeTables().tabs.filter((t) => t.businessDate === date && isSeated(t));
}

export function tabsOn(date: IsoDate): Tab[] {
  return tradeTables().tabs.filter((t) => t.businessDate === date);
}

export function tabsBetween(from: IsoDate, to: IsoDate): Tab[] {
  return tradeTables().tabs.filter((t) => t.businessDate >= from && t.businessDate <= to);
}

export function tabById(id: string): Tab | null {
  return tradeTables().tabs.find((t) => t.id === id) ?? null;
}

/** Lines fired on business dates in [from, to], excluding voids unless asked. */
export function linesBetween(from: IsoDate, to: IsoDate, options: { includeVoided?: boolean } = {}): OrderLine[] {
  const ids = new Set(tabsBetween(from, to).map((t) => t.id));
  return tradeTables().lines.filter((l) => ids.has(l.tabId) && (options.includeVoided || l.status !== 'voided'));
}

export function ordersFor(tabId: string) {
  return tradeTables().orders.filter((o) => o.tabId === tabId).sort((a, b) => (a.firedAt ?? 0) - (b.firedAt ?? 0));
}

export function modifiersFor(lineId: string) {
  return tradeTables().lineModifiers.filter((m) => m.orderLineId === lineId);
}

export function orderFiredAt(orderId: string): number | null {
  return tradeTables().orders.find((o) => o.id === orderId)?.firedAt ?? null;
}

export function shiftsOn(date: IsoDate) {
  return tradeTables().shifts.filter((s) => s.businessDate === date);
}

export function shiftsBetween(from: IsoDate, to: IsoDate) {
  return tradeTables().shifts.filter((s) => s.businessDate >= from && s.businessDate <= to);
}

/** Seats with at least one non-voided line: the honest count of people served. */
export function seatsServed(date: IsoDate): number {
  const tabs = tabsOn(date);
  let count = 0;
  for (const tab of tabs) {
    const lines = linesFor(tab.id).filter((l) => l.status !== 'voided');
    if (lines.length === 0) continue;
    const seatIds = new Set(lines.map((l) => l.tabSeatId).filter(Boolean));
    count += Math.max(1, seatIds.size);
  }
  return count;
}

export function voidedBetween(from: IsoDate, to: IsoDate) {
  return linesBetween(from, to, { includeVoided: true }).filter((l) => l.status === 'voided');
}

export function totalOf(lines: readonly OrderLine[]): Cents {
  return lines.reduce((a, l) => add(a, l.lineTotalCents), ZERO);
}

export function createZone(input: { name: string; sortOrder: number; defaultPriceListId: string | null; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'add a new zone');
  const { zones } = tradeTables();
  const id = createId();
  const zone: Zone = {
    id,
    outletId: zones[0]?.outletId ?? createId(),
    name: input.name,
    sortOrder: input.sortOrder,
    defaultPriceListId: input.defaultPriceListId,
    status: 'active',
  };
  zones.push(zone);
  audit.record({ outletId: zone.outletId, actorStaffId: input.actor.staffId, action: 'zone.created', entityType: 'zone', entityId: zone.id, before: null, after: { name: input.name }, reason: null, severity: 'info' });
  return zone;
}

export function updateZone(input: { zoneId: string; name: string; sortOrder: number; defaultPriceListId: string | null; status: CatalogueStatus; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'update a zone');
  const zone = zoneById(input.zoneId);
  if (!zone) throw new Error('Zone not found.');
  const before = { name: zone.name, status: zone.status };
  zone.name = input.name;
  zone.sortOrder = input.sortOrder;
  zone.defaultPriceListId = input.defaultPriceListId;
  zone.status = input.status;
  audit.record({ outletId: zone.outletId, actorStaffId: input.actor.staffId, action: 'zone.updated', entityType: 'zone', entityId: zone.id, before, after: { name: input.name, status: input.status }, reason: null, severity: 'info' });
  return zone;
}

export function createServiceTable(input: { zoneId: string; label: string; seats: number; positionX: number; positionY: number; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'add a new table');
  const { tables } = tradeTables();
  const id = createId();
  const table: ServiceTable = {
    id,
    outletId: tables[0]?.outletId ?? createId(),
    zoneId: input.zoneId,
    label: input.label,
    seats: input.seats,
    positionX: input.positionX,
    positionY: input.positionY,
    status: 'available',
  };
  tables.push(table);
  audit.record({ outletId: table.outletId, actorStaffId: input.actor.staffId, action: 'table.created', entityType: 'table', entityId: table.id, before: null, after: { label: input.label, zoneId: input.zoneId }, reason: null, severity: 'info' });
  return table;
}

export function updateServiceTable(input: { tableId: string; zoneId: string; label: string; seats: number; positionX: number; positionY: number; status: TableStatus; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'update a table');
  const table = tableById(input.tableId);
  if (!table) throw new Error('Table not found.');
  const before = { label: table.label, zoneId: table.zoneId, status: table.status };
  table.zoneId = input.zoneId;
  table.label = input.label;
  table.seats = input.seats;
  table.positionX = input.positionX;
  table.positionY = input.positionY;
  table.status = input.status;
  audit.record({ outletId: table.outletId, actorStaffId: input.actor.staffId, action: 'table.updated', entityType: 'table', entityId: table.id, before, after: { label: input.label, zoneId: input.zoneId, status: input.status }, reason: null, severity: 'info' });
  return table;
}
