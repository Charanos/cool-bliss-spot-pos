import 'server-only';

import type { Bill, TenderKind } from '@bliss/shared/domain';
import { type Cents, ZERO, add, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import type { DrawerSession } from '@bliss/db/seed/types';
import { settlementTables } from './schema';

export function billsBetween(from: IsoDate, to: IsoDate): Bill[] {
  return settlementTables().bills.filter((b) => b.businessDate >= from && b.businessDate <= to && b.status !== 'voided');
}

export function billsOn(date: IsoDate): Bill[] {
  return billsBetween(date, date);
}

export function billById(id: string) {
  return settlementTables().bills.find((b) => b.id === id) ?? null;
}

export function billLines(billId: string) {
  return settlementTables().billLines.filter((l) => l.billId === billId);
}

export function tendersFor(billId: string) {
  return settlementTables().tenders.filter((t) => t.billId === billId);
}

let tenderIndex: { source: unknown[]; length: number; byBill: Map<string, ReturnType<typeof tendersFor>> } | null = null;

export function tendersByBill() {
  const { tenders } = settlementTables();
  if (tenderIndex && tenderIndex.source === tenders && tenderIndex.length === tenders.length) return tenderIndex.byBill;
  const byBill = new Map<string, ReturnType<typeof tendersFor>>();
  for (const t of tenders) byBill.set(t.billId, [...(byBill.get(t.billId) ?? []), t]);
  tenderIndex = { source: tenders, length: tenders.length, byBill };
  return byBill;
}

export function netSales(date: IsoDate): Cents {
  return sum(billsOn(date).map((b) => b.totalCents));
}

export function tenderMix(from: IsoDate, to: IsoDate): { kind: TenderKind; amount: Cents; count: number }[] {
  const bills = new Set(billsBetween(from, to).map((b) => b.id));
  const totals = new Map<TenderKind, { amount: Cents; count: number }>();
  for (const t of settlementTables().tenders) {
    if (!bills.has(t.billId)) continue;
    const current = totals.get(t.kind) ?? { amount: ZERO, count: 0 };
    totals.set(t.kind, { amount: add(current.amount, t.amountCents), count: current.count + 1 });
  }
  return [...totals.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => (a.amount > b.amount ? -1 : 1));
}

export function drawerSessions() {
  return [...settlementTables().drawerSessions].sort((a, b) => b.openedAt - a.openedAt);
}

/**
 * docs/01-product-spec.md R7: expected cash is absent from every response before the counted figure
 * is committed. An open session is returned without the field at all.
 */
export function drawerFor(date: IsoDate) {
  const session = settlementTables().drawerSessions.find((s) => s.businessDate === date);
  if (!session) return null;
  if (session.status !== 'closed') {
    const { expectedCashCents: _withheld, countedCashCents: _notYet, varianceCents: _none, ...blind } = session;
    return { ...blind, stage: 'blind' as const };
  }
  return { ...session, stage: 'closed' as const };
}

let billedIndex: { source: unknown[]; length: number; ids: Set<string> } | null = null;

/** Order lines already on a bill. A line is billed once, ever. */
export function billedLineIds(): Set<string> {
  const { billLines } = settlementTables();
  if (billedIndex && billedIndex.source === billLines && billedIndex.length === billLines.length) return billedIndex.ids;
  const ids = new Set<string>();
  for (const l of billLines) if (l.orderLineId) ids.add(l.orderLineId);
  billedIndex = { source: billLines, length: billLines.length, ids };
  return ids;
}

export function billsForTab(tabId: string): Bill[] {
  return settlementTables().bills.filter((b) => b.tabId === tabId);
}

/** The session open on a device, if any: at most one, whatever the business date. */
export function openDrawerFor(deviceId: string) {
  return settlementTables().drawerSessions.find((s) => s.deviceId === deviceId && s.status !== 'closed') ?? null;
}

/**
 * A drawer session as a device may see it. docs/01 R7: before the count is committed the expected
 * figure, the counted figure and the variance are absent from the object, not merely null.
 */
export function drawerProjection(session: DrawerSession) {
  const drops = settlementTables().cashMovements.filter((m) => m.drawerSessionId === session.id && m.kind === 'drop_to_safe');
  const base = {
    id: session.id,
    businessDate: session.businessDate,
    deviceId: session.deviceId,
    openedBy: session.openedBy,
    openedAt: session.openedAt,
    openingFloatCents: session.openingFloatCents,
    status: session.status,
    drops: drops.map((d) => ({ id: d.id, amountCents: d.amountCents, reason: d.reason, occurredAt: d.occurredAt, createdBy: d.createdBy })),
    cashBills: cashBillCount(session.id),
  };
  if (session.countedCashCents === null) return base;
  return {
    ...base,
    closedBy: session.closedBy,
    closedAt: session.closedAt,
    countedCashCents: session.countedCashCents,
    expectedCashCents: session.expectedCashCents,
    varianceCents: session.varianceCents,
    varianceReason: session.varianceReason,
  };
}

export type DrawerView = ReturnType<typeof drawerProjection>;

function sessionWindow(sessionId: string) {
  const session = settlementTables().drawerSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  return { session, until: session.closedAt ?? Number.POSITIVE_INFINITY };
}

/** Cash tender amounts on bills settled on the session's device while it was open. */
export function cashTakenIn(sessionId: string): Cents[] {
  const w = sessionWindow(sessionId);
  if (!w) return [];
  const t = settlementTables();
  const bills = new Set(t.bills.filter((b) => b.deviceId === w.session.deviceId && b.status === 'settled' && (b.settledAt ?? 0) >= w.session.openedAt && (b.settledAt ?? 0) <= w.until).map((b) => b.id));
  return t.tenders.filter((x) => x.kind === 'cash' && bills.has(x.billId)).map((x) => x.amountCents);
}

function cashBillCount(sessionId: string): number {
  const w = sessionWindow(sessionId);
  if (!w) return 0;
  const t = settlementTables();
  const bills = new Set(t.bills.filter((b) => b.deviceId === w.session.deviceId && b.status === 'settled' && (b.settledAt ?? 0) >= w.session.openedAt && (b.settledAt ?? 0) <= w.until).map((b) => b.id));
  return new Set(t.tenders.filter((x) => x.kind === 'cash' && bills.has(x.billId)).map((x) => x.billId)).size;
}
