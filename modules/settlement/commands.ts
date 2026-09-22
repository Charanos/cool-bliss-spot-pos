import 'server-only';

import type { CashMovement } from '@bliss/db/seed/types';
import type { Bill, BillScope, OrderLine, Tender } from '@bliss/shared/domain';
import { type Cents, ZERO, abs, cents, compare, formatKes, isPositive, multiplyByQty, scale, subtract, sum } from '@bliss/shared/money';
import { type Actor, checkReason } from '@bliss/shared/reason';
import { amountDue, billableLines, checkTenders, evenShares, expectedCash, linesTotal } from '@bliss/shared/settlement';
import type { OutboxPayload } from '@bliss/shared/sync';
import { businessDate } from '@bliss/shared/time';
import { CommandRejected, touch } from '../_data/changes';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as pricing from '../pricing/service';
import * as tradeCommands from '../trade/commands';
import * as trade from '../trade/service';
import { settlementTables } from './schema';
import { billedLineIds, cashTakenIn, drawerProjection, openDrawerFor } from './service';

/**
 * Settlement writes. docs/05 sections 1.5, 1.8, 2.6, 2.7 and 2.12; docs/14 sections 6 and 7.
 *
 * The server is authoritative on money. A device sends what it showed the guest; the server works
 * the bill out again from its own lines and prices, and refuses rather than trusts a difference.
 * Bliss records tenders. It never contacts a payment provider and never claims a payment succeeded.
 */

const TAB_SCOPES: readonly BillScope[] = ['tab', 'seat', 'even_split'];

interface Planned {
  lines: OrderLine[];
  subtotal: Cents;
  seatId: string | null;
  quickItems: { productVariantId: string; qty: number; unitPriceCents: Cents; description: string }[];
}

function sameIds(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

function mismatch(): never {
  throw new CommandRejected('BILL_TOTAL_MISMATCH', 'The bill changed before it was settled. Open the tab again to see the current total.');
}

function planTabBill(p: OutboxPayload<'bill.settle'>): Planned {
  if (!p.tabId) throw new CommandRejected('VALIDATION_FAILED', 'A tab bill needs its tab.');
  const tab = trade.tabById(p.tabId);
  if (!tab) throw new CommandRejected('NOT_FOUND', 'That tab does not exist on the server.');
  if (tab.status === 'settled') throw new CommandRejected('TAB_ALREADY_SETTLED', 'This tab was already settled on another device.');
  const billed = billedLineIds();
  const tabLines = trade.linesFor(tab.id);

  for (const id of p.lineIds) {
    const line = tabLines.find((l) => l.id === id);
    if (!line) throw new CommandRejected('NOT_FOUND', 'A line on this bill is not on the tab.');
    if (line.status === 'voided') throw new CommandRejected('LINE_VOIDED', 'A line on this bill was voided before it was settled.');
    if (billed.has(line.id)) throw new CommandRejected('LINE_ALREADY_BILLED', 'A line on this bill was already settled on another bill.');
  }
  const remaining = billableLines(tabLines, billed);

  if (p.scope === 'tab') {
    if (!sameIds(p.lineIds, remaining.map((l) => l.id))) mismatch();
    return { lines: remaining, subtotal: linesTotal(remaining), seatId: null, quickItems: [] };
  }

  if (p.scope === 'seat') {
    if (!p.tabSeatId) throw new CommandRejected('VALIDATION_FAILED', 'A seat bill needs its seat.');
    const seat = trade.seatsFor(tab.id).find((s) => s.id === p.tabSeatId);
    if (!seat) throw new CommandRejected('NOT_FOUND', 'That seat is not on the tab.');
    if (seat.status === 'settled') throw new CommandRejected('SEAT_ALREADY_SETTLED', `Seat ${seat.seatNo} was already settled.`);
    const own = remaining.filter((l) => l.tabSeatId === seat.id);
    if (!sameIds(p.lineIds, own.map((l) => l.id))) mismatch();
    return { lines: own, subtotal: linesTotal(own), seatId: seat.id, quickItems: [] };
  }

  // Even split. The first share takes every remaining line and fixes the group total; later shares
  // take none and are checked against that same total. docs/05 2.7.
  if (!p.split) throw new CommandRejected('VALIDATION_FAILED', 'An even split needs its group.');
  const t = settlementTables();
  const groupBills = t.bills.filter((b) => b.splitGroupId === p.split!.groupId);
  const seats = trade.seatsFor(tab.id).filter((s) => s.status !== 'removed');
  let groupTotal: Cents;
  let lines: OrderLine[] = [];
  if (groupBills.length === 0) {
    if (p.split.index !== 0 || !sameIds(p.lineIds, remaining.map((l) => l.id))) mismatch();
    lines = remaining;
    groupTotal = linesTotal(remaining);
  } else {
    if (p.lineIds.length > 0) mismatch();
    const first = new Set(groupBills.map((b) => b.id));
    groupTotal = sum(t.billLines.filter((l) => first.has(l.billId)).map((l) => l.lineTotalCents));
    const taken = t.bills.filter((b) => b.splitGroupId === p.split!.groupId).length;
    if (taken >= p.split.count) throw new CommandRejected('BILL_ALREADY_SETTLED', 'Every share of this split is already settled.');
  }
  const shares = evenShares(groupTotal, p.split.count);
  const share = shares[p.split.index];
  if (share === undefined) mismatch();
  const active = seats.filter((s) => s.status === 'active').sort((a, b) => a.seatNo - b.seatNo);
  return { lines, subtotal: share, seatId: active[0]?.id ?? null, quickItems: [] };
}

function planQuickSale(p: OutboxPayload<'bill.settle'>): Planned {
  if (p.items.length === 0) throw new CommandRejected('VALIDATION_FAILED', 'A quick sale needs at least one item.');
  const quickItems = p.items.map((item) => {
    const variant = catalogue.variantById(item.productVariantId);
    if (!variant) throw new CommandRejected('STALE_SNAPSHOT', 'An item in this sale is no longer on the menu.');
    const price = pricing.currentPrice(variant.id, p.settledAt);
    if (!price || price.unitPriceCents !== cents(item.unitPriceCents)) mismatch();
    return { productVariantId: variant.id, qty: item.qty, unitPriceCents: price.unitPriceCents, description: variant.name };
  });
  return { lines: [], subtotal: sum(quickItems.map((i) => multiplyByQty(i.unitPriceCents, i.qty))), seatId: null, quickItems };
}

/**
 * Settle a bill: the bill, its lines snapshotted with seat number and label, its tenders, and the
 * seat and tab state, in one step or not at all. Idempotent on the bill id.
 */
export function settleBill(p: OutboxPayload<'bill.settle'>, actor: Actor): void {
  const t = settlementTables();
  if (t.bills.some((b) => b.id === p.billId)) return;
  if (!actor.deviceId) throw new CommandRejected('WRONG_SURFACE', 'Bills are settled at a counter device.');

  const plan = TAB_SCOPES.includes(p.scope) ? planTabBill(p) : planQuickSale(p);
  if (plan.subtotal !== cents(p.subtotalCents)) mismatch();
  const { due, rounding } = amountDue(plan.subtotal);
  if (due !== cents(p.dueCents) || rounding !== cents(p.roundingCents)) mismatch();

  const tenders = p.tenders.map((x) => ({ ...x, amountCents: cents(x.amountCents), tenderedCents: x.tenderedCents === null ? null : cents(x.tenderedCents) }));
  const check = checkTenders(due, tenders);
  if (!check.ok) throw new CommandRejected('TENDER_MISMATCH', check.message);

  const takesCash = tenders.some((x) => x.kind === 'cash');
  const drawer = openDrawerFor(actor.deviceId);
  if (takesCash && (!drawer || drawer.status !== 'open')) throw new CommandRejected('DRAWER_NOT_OPEN', 'Cash needs an open drawer on this device. Open the drawer, then settle.');

  const outlet = identity.outlet();
  const settledAt = p.settledAt;
  const billNumber = t.bills.reduce((max, b) => Math.max(max, b.billNumber), 0) + 1;
  const bill: Bill = {
    id: p.billId,
    outletId: outlet.id,
    businessDate: businessDate(settledAt, outlet.timezone, outlet.businessDayCutover),
    tabId: p.tabId,
    tabSeatId: plan.seatId ?? p.tabSeatId,
    billNumber,
    scope: p.scope,
    splitGroupId: p.split?.groupId ?? null,
    subtotalCents: plan.subtotal,
    discountCents: ZERO,
    // Prices include VAT; the bill states the VAT inside the total.
    taxCents: outlet.pricesTaxInclusive ? scale(plan.subtotal, BigInt(outlet.taxRateBps), BigInt(10_000 + outlet.taxRateBps)) : ZERO,
    totalCents: plan.subtotal,
    roundingCents: rounding,
    status: 'settled',
    settledAt,
    settledBy: actor.staffId,
    deviceId: actor.deviceId,
  };
  t.bills.push(bill);

  const seats = p.tabId ? trade.seatsFor(p.tabId) : [];
  const billLineIds: string[] = [];
  for (const line of plan.lines) {
    const seat = seats.find((s) => s.id === line.tabSeatId) ?? null;
    const id = `${bill.id}:${line.id}`;
    t.billLines.push({
      id,
      billId: bill.id,
      orderLineId: line.id,
      productVariantId: line.productVariantId,
      description: catalogue.variantById(line.productVariantId)?.name ?? 'Item',
      seatNo: seat?.seatNo ?? null,
      seatLabel: seat?.label ?? null,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
    });
    billLineIds.push(id);
  }
  plan.quickItems.forEach((item, i) => {
    const id = `${bill.id}:q${i}`;
    t.billLines.push({ id, billId: bill.id, orderLineId: null, productVariantId: item.productVariantId, description: item.description, seatNo: null, seatLabel: null, qty: item.qty, unitPriceCents: item.unitPriceCents, lineTotalCents: multiplyByQty(item.unitPriceCents, item.qty) });
    billLineIds.push(id);
    inventory.recordSale({ lineId: id, productVariantId: item.productVariantId, qty: item.qty, modifiers: [], actor, preferLocationKind: 'retail' });
  });

  const tenderRows: Tender[] = tenders.map((x) => ({
    id: x.tenderId,
    billId: bill.id,
    kind: x.kind,
    amountCents: x.amountCents,
    tenderedCents: x.kind === 'cash' ? x.tenderedCents : null,
    changeCents: x.kind === 'cash' && x.tenderedCents !== null ? subtract(x.tenderedCents, x.amountCents) : null,
    reference: x.reference?.trim() || null,
    createdBy: actor.staffId,
    deviceId: actor.deviceId!,
    createdAt: settledAt,
  }));
  t.tenders.push(...tenderRows);

  touch('bills', bill.id);
  touch('billLines', ...billLineIds);
  touch('tenders', ...tenderRows.map((x) => x.id));

  if (p.tabId) {
    if (p.scope === 'seat' && plan.seatId) tradeCommands.settleSeat(plan.seatId, bill.id, settledAt);
    if (p.scope === 'even_split' && p.split) {
      const active = seats.filter((s) => s.status === 'active').sort((a, b) => a.seatNo - b.seatNo);
      if (active[0]) tradeCommands.settleSeat(active[0].id, bill.id, settledAt);
    }
    const remaining = billableLines(trade.linesFor(p.tabId), billedLineIds()).length;
    const openSplit = p.split ? settlementTables().bills.filter((b) => b.splitGroupId === p.split!.groupId).length < p.split.count : false;
    tradeCommands.updateTabAfterBill(p.tabId, remaining, openSplit, bill.id, settledAt);
  }

  audit.record({
    outletId: outlet.id,
    actorStaffId: actor.staffId,
    actorDeviceId: actor.deviceId,
    action: 'bill.settled',
    entityType: 'bill',
    entityId: bill.id,
    before: null,
    after: { billNumber, scope: p.scope, totalCents: plan.subtotal.toString(), tenders: tenderRows.map((x) => x.kind) },
    reason: null,
    severity: 'info',
  });
}

/* ------------------------------------------------------------------ drawer */

export function openDrawer(p: OutboxPayload<'drawer.open'>, actor: Actor): void {
  const t = settlementTables();
  if (t.drawerSessions.some((s) => s.id === p.sessionId)) return;
  if (!actor.deviceId) throw new CommandRejected('WRONG_SURFACE', 'A drawer belongs to a counter device.');
  const existing = openDrawerFor(actor.deviceId);
  if (existing) throw new CommandRejected('DRAWER_ALREADY_OPEN', 'A drawer is already open on this device.');
  const float = cents(p.floatCents);
  if (!isPositive(float) && float !== ZERO) throw new CommandRejected('VALIDATION_FAILED', 'A float cannot be below zero.');
  const outlet = identity.outlet();
  t.drawerSessions.push({
    id: p.sessionId,
    outletId: outlet.id,
    businessDate: businessDate(p.openedAt, outlet.timezone, outlet.businessDayCutover),
    deviceId: actor.deviceId,
    openedBy: actor.staffId,
    openedAt: p.openedAt,
    openingFloatCents: float,
    closedBy: null,
    closedAt: null,
    countedCashCents: null,
    expectedCashCents: null,
    varianceCents: null,
    varianceReason: null,
    status: 'open',
  });
  const movement: CashMovement = { id: `${p.sessionId}:float`, drawerSessionId: p.sessionId, kind: 'opening_float', amountCents: float, reason: null, createdBy: actor.staffId, deviceId: actor.deviceId, occurredAt: p.openedAt };
  t.cashMovements.push(movement);
  touch('drawerSessions', p.sessionId);
  audit.record({ outletId: outlet.id, actorStaffId: actor.staffId, actorDeviceId: actor.deviceId, action: 'drawer.opened', entityType: 'drawer_session', entityId: p.sessionId, before: null, after: { floatCents: float.toString() }, reason: null, severity: 'info' });
}

export function dropCash(p: OutboxPayload<'drawer.drop'>, actor: Actor): void {
  const t = settlementTables();
  if (t.cashMovements.some((m) => m.id === p.movementId)) return;
  const session = t.drawerSessions.find((s) => s.id === p.sessionId);
  if (!session || session.status !== 'open' || session.deviceId !== actor.deviceId) throw new CommandRejected('DRAWER_NOT_OPEN', 'That drawer is not open on this device.');
  const amount = cents(p.amountCents);
  if (!isPositive(amount)) throw new CommandRejected('VALIDATION_FAILED', 'A drop needs an amount.');
  t.cashMovements.push({ id: p.movementId, drawerSessionId: session.id, kind: 'drop_to_safe', amountCents: amount, reason: p.reason, createdBy: actor.staffId, deviceId: session.deviceId, occurredAt: p.at });
  touch('drawerSessions', session.id);
  audit.record({ outletId: session.outletId, actorStaffId: actor.staffId, actorDeviceId: actor.deviceId, action: 'drawer.cash_dropped', entityType: 'drawer_session', entityId: session.id, before: null, after: { amountCents: amount.toString() }, reason: p.reason, severity: 'notable' });
}

/** Tabs that must be settled or voided before the drawer closes for the business day. */
export function closePreflight() {
  return trade.openTabs().map((s) => ({ tabId: s.tab.id, label: s.tableLabel, tabNumber: s.tab.tabNumber, waiter: identity.displayName(s.tab.assignedTo), totalCents: s.total, seats: s.seats.filter((x) => x.status !== 'removed').map((x) => ({ seatNo: x.seatNo, settled: x.status === 'settled' })) }));
}

/**
 * Commit the blind count. The counted figure is locked the moment it arrives, and only then are the
 * expected figure and the variance worked out and returned. Counting twice returns the first count.
 */
export function countDrawer(input: { sessionId: string; countedCents: Cents; actor: Actor }) {
  const t = settlementTables();
  const session = t.drawerSessions.find((s) => s.id === input.sessionId);
  if (!session || session.deviceId !== input.actor.deviceId) throw new CommandRejected('DRAWER_NOT_OPEN', 'That drawer is not open on this device.');
  identity.assertCan(input.actor.staffId, 'drawer.close', 'closing the drawer');
  if (session.status === 'open') {
    const open = closePreflight();
    if (open.length > 0) throw new CommandRejected('VALIDATION_FAILED', `${open.length} ${open.length === 1 ? 'tab is' : 'tabs are'} still open. They must be settled or voided first.`);
    if (compare(input.countedCents, ZERO) < 0) throw new CommandRejected('VALIDATION_FAILED', 'A count cannot be below zero.');
    const drops = t.cashMovements.filter((m) => m.drawerSessionId === session.id && m.kind === 'drop_to_safe').map((m) => m.amountCents);
    const expected = expectedCash({ float: session.openingFloatCents, cashTaken: cashTakenIn(session.id), drops });
    session.status = 'counting';
    session.countedCashCents = input.countedCents;
    session.expectedCashCents = expected;
    session.varianceCents = subtract(input.countedCents, expected);
    touch('drawerSessions', session.id);
  }
  const outlet = identity.outlet();
  return { view: drawerProjection(session), thresholdCents: outlet.drawerVarianceThresholdCents, needsReason: session.varianceCents !== null && compare(abs(session.varianceCents), outlet.drawerVarianceThresholdCents) > 0 };
}

/** Close a counted drawer. A variance over the outlet threshold needs a reason. A closed drawer never reopens. */
export function closeDrawer(input: { sessionId: string; reason: string | null; actor: Actor }) {
  const t = settlementTables();
  const session = t.drawerSessions.find((s) => s.id === input.sessionId);
  if (!session || session.deviceId !== input.actor.deviceId) throw new CommandRejected('DRAWER_NOT_OPEN', 'That drawer is not on this device.');
  identity.assertCan(input.actor.staffId, 'drawer.close', 'closing the drawer');
  if (session.status === 'closed') return drawerProjection(session);
  if (session.status !== 'counting' || session.varianceCents === null) throw new CommandRejected('VALIDATION_FAILED', 'Count the drawer before closing it.');
  const outlet = identity.outlet();
  const over = compare(abs(session.varianceCents), outlet.drawerVarianceThresholdCents) > 0;
  let reason: string | null = input.reason?.trim() || null;
  if (over) {
    const check = checkReason(reason ?? '');
    if (!check.ok) throw new CommandRejected('VALIDATION_FAILED', `The count is ${formatKes(abs(session.varianceCents), { decimals: 'whole' })} ${isPositive(session.varianceCents) ? 'over' : 'under'} the expected figure. Write what you think happened, at least 10 characters.`);
    reason = check.reason;
  }
  session.status = 'closed';
  session.closedBy = input.actor.staffId;
  session.closedAt = Date.now();
  session.varianceReason = reason;
  touch('drawerSessions', session.id);
  audit.record({
    outletId: outlet.id,
    actorStaffId: input.actor.staffId,
    actorDeviceId: input.actor.deviceId,
    action: 'drawer.closed',
    entityType: 'drawer_session',
    entityId: session.id,
    before: { status: 'counting' },
    after: { varianceCents: session.varianceCents.toString() },
    reason,
    severity: over ? 'sensitive' : 'info',
  });
  return drawerProjection(session);
}
