import 'server-only';

import type { OrderLine, Tab, TabSeat } from '@bliss/shared/domain';
import { type Cents, ZERO, add, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import { isSeated, tabLabel } from '@bliss/shared/trade';
import { dataset } from '../_data/source';
import { tradeTables } from './schema';

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
