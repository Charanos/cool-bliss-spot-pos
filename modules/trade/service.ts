import 'server-only';

import { DomainError } from '../_data/errors';

import type { OrderLine, Tab, TabSeat, Zone, ServiceTable, CatalogueStatus, TableStatus } from '@bliss/shared/domain';
import { type Cents, ZERO, add, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import type { Actor } from '@bliss/shared/reason';
import { createUuidV7 } from '@bliss/shared/id';
import { isSeated, tabLabel } from '@bliss/shared/trade';
import { bumpCatalogueVersion, dataset } from '../_data/source';
import * as audit from '../audit/service';
import { assertCan, outlet } from '../identity/service';
import * as pricing from '../pricing/service';
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

/**
 * Indexes by tab, rebuilt when their table changes. A rolled-back write can shrink and regrow a table
 * to the same length, so each index also checks the last row it saw.
 */
interface ByTab<T> {
  source: T[];
  length: number;
  last: T | undefined;
  byTab: Map<string, T[]>;
}

function indexByTab<T extends { tabId: string }>(cache: ByTab<T> | null, rows: T[]): ByTab<T> {
  const last = rows[rows.length - 1];
  if (cache && cache.source === rows && cache.length === rows.length && cache.last === last) return cache;
  const byTab = new Map<string, T[]>();
  for (const row of rows) {
    const list = byTab.get(row.tabId);
    if (list) list.push(row);
    else byTab.set(row.tabId, [row]);
  }
  return { source: rows, length: rows.length, last, byTab };
}

let lineIndex: ByTab<OrderLine> | null = null;
let seatIndex: ByTab<TabSeat> | null = null;
let orderIndex: ByTab<ReturnType<typeof tradeTables>['orders'][number]> | null = null;

function linesByTab() {
  lineIndex = indexByTab(lineIndex, tradeTables().lines);
  return lineIndex.byTab;
}

function seatsByTab() {
  seatIndex = indexByTab(seatIndex, tradeTables().seats);
  return seatIndex.byTab;
}

function ordersByTab() {
  orderIndex = indexByTab(orderIndex, tradeTables().orders);
  return orderIndex.byTab;
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
  const orders = ordersByTab().get(tab.id) ?? [];
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
  return [...(ordersByTab().get(tabId) ?? [])].sort((a, b) => (a.firedAt ?? 0) - (b.firedAt ?? 0));
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

/* ------------------------------------------------------------ zones and tables */

function cleanLabel(value: string, what: string, max: number): string {
  const label = value.trim().replace(/\s+/g, ' ');
  if (label.length < 1 || label.length > max) throw new DomainError(`A ${what} is 1 to ${max} characters.`);
  return label;
}

function checkPriceList(id: string | null): string | null {
  if (!id) return null;
  if (!pricing.priceLists().some((l) => l.id === id)) throw new DomainError('That price list is not part of this outlet.');
  return id;
}

function checkSortOrder(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 999) throw new DomainError('The order is a whole number from 0 to 999.');
  return value;
}

/** Whether a tab is still open on a table. A table with a guest on it cannot be taken out of service. */
function openTabOn(tableId: string): Tab | null {
  return tradeTables().tabs.find((t) => t.serviceTableId === tableId && (t.status === 'open' || t.status === 'part_settled' || t.status === 'settling')) ?? null;
}

export function createZone(input: { name: string; sortOrder: number; defaultPriceListId: string | null; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'adding zones');
  const { zones } = tradeTables();
  const name = cleanLabel(input.name, 'zone name', 40);
  if (zones.some((z) => z.status === 'active' && z.name.toLowerCase() === name.toLowerCase())) throw new DomainError(`There is already a zone called ${name}.`);
  const zone: Zone = {
    id: createId(),
    outletId: outlet().id,
    name,
    sortOrder: checkSortOrder(input.sortOrder),
    defaultPriceListId: checkPriceList(input.defaultPriceListId),
    status: 'active',
  };
  zones.push(zone);
  bumpCatalogueVersion();
  audit.record({ outletId: zone.outletId, actorStaffId: input.actor.staffId, action: 'zone.created', entityType: 'zone', entityId: zone.id, before: null, after: { name }, reason: null, severity: 'info' });
  return zone;
}

export function updateZone(input: { zoneId: string; name: string; sortOrder: number; defaultPriceListId: string | null; status: CatalogueStatus; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'updating zones');
  const zone = zoneById(input.zoneId);
  if (!zone) throw new DomainError('That zone is not part of this outlet.');
  if (input.status !== 'active' && input.status !== 'archived') throw new DomainError('A zone is active or archived.');
  const name = cleanLabel(input.name, 'zone name', 40);
  if (tradeTables().zones.some((z) => z.id !== zone.id && z.status === 'active' && z.name.toLowerCase() === name.toLowerCase())) throw new DomainError(`There is already a zone called ${name}.`);
  if (input.status === 'archived' && zone.status === 'active') {
    const busy = tradeTables().tables.filter((t) => t.zoneId === zone.id).find((t) => openTabOn(t.id));
    if (busy) throw new DomainError(`Table ${busy.label} in ${zone.name} has an open tab. Archive the zone once it is settled.`);
  }
  const before = { name: zone.name, sortOrder: zone.sortOrder, defaultPriceListId: zone.defaultPriceListId, status: zone.status };
  zone.name = name;
  zone.sortOrder = checkSortOrder(input.sortOrder);
  zone.defaultPriceListId = checkPriceList(input.defaultPriceListId);
  zone.status = input.status;
  bumpCatalogueVersion();
  audit.record({ outletId: zone.outletId, actorStaffId: input.actor.staffId, action: 'zone.updated', entityType: 'zone', entityId: zone.id, before, after: { name, sortOrder: zone.sortOrder, defaultPriceListId: zone.defaultPriceListId, status: zone.status }, reason: null, severity: 'info' });
  return zone;
}

function checkSeats(seats: number): number {
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) throw new DomainError('A table seats 1 to 40 people.');
  return seats;
}

function checkPosition(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) throw new DomainError('A table position is on the floor plan.');
  return Math.round(value);
}

function activeZone(zoneId: string): Zone {
  const zone = zoneById(zoneId);
  if (!zone || zone.status !== 'active') throw new DomainError('Choose an active zone for this table.');
  return zone;
}

export function createServiceTable(input: { zoneId: string; label: string; seats: number; positionX: number; positionY: number; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'adding tables');
  const zone = activeZone(input.zoneId);
  const label = cleanLabel(input.label, 'table label', 12);
  if (tradeTables().tables.some((t) => t.status !== 'out_of_service' && t.label.toLowerCase() === label.toLowerCase())) throw new DomainError(`There is already a table ${label}.`);
  const table: ServiceTable = {
    id: createId(),
    outletId: outlet().id,
    zoneId: zone.id,
    label,
    seats: checkSeats(input.seats),
    positionX: checkPosition(input.positionX),
    positionY: checkPosition(input.positionY),
    status: 'available',
  };
  tradeTables().tables.push(table);
  bumpCatalogueVersion();
  audit.record({ outletId: table.outletId, actorStaffId: input.actor.staffId, action: 'table.created', entityType: 'table', entityId: table.id, before: null, after: { label, zone: zone.name, seats: table.seats }, reason: null, severity: 'info' });
  return table;
}

/**
 * Update a table. Occupancy is not the Console's to set: a table is occupied because a tab is open on
 * it. The Console chooses between in service and out of service, and a table with a guest stays in.
 */
export function updateServiceTable(input: { tableId: string; zoneId: string; label: string; seats: number; positionX: number; positionY: number; status: TableStatus; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'updating tables');
  const table = tableById(input.tableId);
  if (!table) throw new DomainError('That table is not part of this outlet.');
  const zone = activeZone(input.zoneId);
  const label = cleanLabel(input.label, 'table label', 12);
  if (tradeTables().tables.some((t) => t.id !== table.id && t.status !== 'out_of_service' && t.label.toLowerCase() === label.toLowerCase())) throw new DomainError(`There is already a table ${label}.`);
  if (input.status !== 'available' && input.status !== 'out_of_service' && input.status !== table.status) throw new DomainError('A table is in service or out of service. It is occupied only while a tab is open on it.');
  const open = openTabOn(table.id);
  if (open && input.status === 'out_of_service') throw new DomainError(`Table ${table.label} has an open tab. Take it out of service once it is settled.`);
  if (open && zone.id !== table.zoneId) throw new DomainError(`Table ${table.label} has an open tab. Move it to another zone once it is settled.`);
  const before = { label: table.label, zoneId: table.zoneId, seats: table.seats, status: table.status };
  table.zoneId = zone.id;
  table.label = label;
  table.seats = checkSeats(input.seats);
  table.positionX = checkPosition(input.positionX);
  table.positionY = checkPosition(input.positionY);
  // Bringing a table back into service makes it available, or occupied again if a tab is on it.
  table.status = input.status === 'out_of_service' ? 'out_of_service' : open ? 'occupied' : table.status === 'occupied' ? 'occupied' : 'available';
  bumpCatalogueVersion();
  audit.record({ outletId: table.outletId, actorStaffId: input.actor.staffId, action: 'table.updated', entityType: 'table', entityId: table.id, before, after: { label, zone: zone.name, seats: table.seats, status: table.status }, reason: null, severity: 'info' });
  return table;
}
