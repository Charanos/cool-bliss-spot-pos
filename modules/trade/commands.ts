import 'server-only';

import type { Order, OrderLine, OrderLineModifier, Tab, TabSeat } from '@bliss/shared/domain';
import { cents } from '@bliss/shared/money';
import type { Actor } from '@bliss/shared/reason';
import { seatColourIndex } from '@bliss/shared/seats';
import type { OutboxPayload } from '@bliss/shared/sync';
import { businessDate } from '@bliss/shared/time';
import { CommandRejected, touch } from '../_data/changes';
import * as audit from '../audit/service';
import * as availability from '../availability/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as settlement from '../settlement/service';
import { tradeTables } from './schema';

/**
 * Trade writes, applied from device outbox entries. docs/05 sections 1 to 2.5 and 2.11, docs/14
 * section 4.
 *
 * Every command is idempotent on the ids the device generated, refuses with a CommandRejected the
 * device can act on, records the rows it touched in the change feed, and audits what docs/01 R10
 * asks for. Money is taken as the device fired it: price is fixed at fire time, never at settlement.
 */

const OPEN: readonly Tab['status'][] = ['open', 'part_settled', 'settling'];

function openTabOrThrow(tabId: string): Tab {
  const tab = tradeTables().tabs.find((t) => t.id === tabId);
  if (!tab) throw new CommandRejected('NOT_FOUND', 'That tab does not exist on the server.');
  if (!OPEN.includes(tab.status)) throw new CommandRejected('TAB_ALREADY_SETTLED', 'That tab was already settled.');
  return tab;
}

function lineOrThrow(lineId: string): OrderLine {
  const line = tradeTables().lines.find((l) => l.id === lineId);
  if (!line) throw new CommandRejected('NOT_FOUND', 'That line does not exist on the server.');
  return line;
}

function activeSeatOrThrow(tabId: string, seatId: string): TabSeat {
  const seat = tradeTables().seats.find((s) => s.id === seatId && s.tabId === tabId);
  if (!seat || seat.status === 'removed') throw new CommandRejected('NOT_FOUND', 'That seat is not on the tab.');
  if (seat.status === 'settled') throw new CommandRejected('SEAT_ALREADY_SETTLED', `Seat ${seat.seatNo} was settled before this change arrived.`);
  return seat;
}

export function openTab(p: OutboxPayload<'tab.open'>, actor: Actor): void {
  const t = tradeTables();
  if (t.tabs.some((x) => x.id === p.tabId)) return;
  if (!t.zones.some((z) => z.id === p.zoneId)) throw new CommandRejected('VALIDATION_FAILED', 'That zone does not exist.');
  const outlet = identity.outlet();
  const date = businessDate(p.openedAt, outlet.timezone, outlet.businessDayCutover);
  const tabNumber = t.tabs.filter((x) => x.businessDate === date).reduce((max, x) => Math.max(max, x.tabNumber ?? 0), 0) + 1;
  const tab: Tab = {
    id: p.tabId,
    outletId: outlet.id,
    businessDate: date,
    serviceTableId: p.serviceTableId,
    zoneId: p.zoneId,
    tabNumber,
    name: p.name,
    guestCount: p.guestCount,
    openedBy: actor.staffId,
    openedAt: p.openedAt,
    assignedTo: actor.staffId,
    status: 'open',
    mergedIntoTabId: null,
    closedAt: null,
  };
  t.tabs.push(tab);
  const seats: TabSeat[] = p.seats.map((s) => ({
    id: s.seatId,
    outletId: outlet.id,
    tabId: tab.id,
    seatNo: s.seatNo,
    label: null,
    colourIndex: seatColourIndex(s.seatNo),
    status: 'active',
    settledBillId: null,
    settledAt: null,
    createdBy: actor.staffId,
    createdAt: p.openedAt,
  }));
  t.seats.push(...seats);
  touch('tabs', tab.id);
  touch('seats', ...seats.map((s) => s.id));
}

export function addSeat(p: OutboxPayload<'seat.add'>, actor: Actor): void {
  const t = tradeTables();
  if (t.seats.some((s) => s.id === p.seatId)) return;
  const tab = openTabOrThrow(p.tabId);
  t.seats.push({
    id: p.seatId,
    outletId: tab.outletId,
    tabId: tab.id,
    seatNo: p.seatNo,
    label: null,
    colourIndex: seatColourIndex(p.seatNo),
    status: 'active',
    settledBillId: null,
    settledAt: null,
    createdBy: actor.staffId,
    createdAt: Date.now(),
  });
  tab.guestCount += 1;
  touch('seats', p.seatId);
  touch('tabs', tab.id);
}

export function labelSeat(p: OutboxPayload<'seat.label'>): void {
  openTabOrThrow(p.tabId);
  const seat = activeSeatOrThrow(p.tabId, p.seatId);
  seat.label = p.label;
  touch('seats', seat.id);
}

export function removeSeat(p: OutboxPayload<'seat.remove'>): void {
  openTabOrThrow(p.tabId);
  const seat = tradeTables().seats.find((s) => s.id === p.seatId && s.tabId === p.tabId);
  if (!seat || seat.status === 'removed') return;
  const lines = tradeTables().lines.filter((l) => l.tabSeatId === seat.id && l.status !== 'voided');
  if (lines.length > 0) throw new CommandRejected('SEAT_HAS_LINES', `Seat ${seat.seatNo} has ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} on it.`);
  seat.status = 'removed';
  touch('seats', seat.id);
}

/**
 * Fire: the order, its lines and modifiers, and the stock they take, as one step. A line for an item
 * that finished while the device was offline is accepted and flagged, never dropped: a drink may
 * already be poured. docs/02 section 6, the stock conflict rule.
 */
export function fireOrder(p: OutboxPayload<'order.fire'>, actor: Actor): { stockConflictLineIds: string[] } {
  const t = tradeTables();
  if (t.orders.some((o) => o.id === p.orderId)) return { stockConflictLineIds: [] };
  const tab = openTabOrThrow(p.tabId);
  for (const l of p.lines) {
    if (l.tabSeatId) activeSeatOrThrow(tab.id, l.tabSeatId);
    if (!catalogue.variantById(l.productVariantId)) throw new CommandRejected('STALE_SNAPSHOT', 'An item on this order is no longer on the menu.');
  }
  const order: Order = {
    id: p.orderId,
    outletId: tab.outletId,
    tabId: tab.id,
    businessDate: tab.businessDate,
    orderNumber: t.orders.filter((o) => o.tabId === tab.id).length + 1,
    firedAt: p.firedAt,
    firedBy: actor.staffId,
    deviceId: actor.deviceId ?? '',
    status: 'fired',
    clientCreatedAt: p.firedAt,
    serverReceivedAt: Date.now(),
    note: null,
  };
  t.orders.push(order);

  const conflicts: string[] = [];
  for (const l of p.lines) {
    const finished = availability.evaluate(l.productVariantId).state === 'finished';
    if (finished) conflicts.push(l.lineId);
    const line: OrderLine = {
      id: l.lineId,
      outletId: tab.outletId,
      orderId: order.id,
      tabId: tab.id,
      tabSeatId: l.tabSeatId,
      productVariantId: l.productVariantId,
      qty: l.qty,
      unitPriceCents: cents(l.unitPriceCents),
      lineTotalCents: cents(l.lineTotalCents),
      priceDerivation: l.priceDerivation,
      note: l.note,
      status: 'pending',
      stockConflict: finished,
      servedAt: null,
      servedBy: null,
      voidedBy: null,
      voidedAt: null,
      voidReason: null,
      createdBy: actor.staffId,
      deviceId: actor.deviceId ?? '',
      clientCreatedAt: l.clientCreatedAt,
    };
    t.lines.push(line);
    const modifiers: OrderLineModifier[] = l.modifiers.map((m, i) => ({
      id: `${line.id}:m${i}`,
      orderLineId: line.id,
      modifierId: m.modifierId,
      name: catalogue.modifierById(m.modifierId)?.name ?? 'Modifier',
      qty: m.qty,
      priceDeltaCents: cents(m.priceDeltaCents),
      linkedVariantId: m.linkedVariantId,
    }));
    t.lineModifiers.push(...modifiers);
    inventory.recordSale({ lineId: line.id, productVariantId: line.productVariantId, qty: line.qty, modifiers, actor });
    touch('lines', line.id);
    if (modifiers.length > 0) touch('lineModifiers', ...modifiers.map((m) => m.id));
  }
  touch('orders', order.id);
  return { stockConflictLineIds: conflicts };
}

function assertNotBilled(line: OrderLine) {
  if (settlement.billedLineIds().has(line.id)) throw new CommandRejected('LINE_ALREADY_BILLED', 'That line is already on a settled bill.');
}

export function moveLine(p: OutboxPayload<'line.move'>, actor: Actor): void {
  openTabOrThrow(p.tabId);
  const line = lineOrThrow(p.lineId);
  if (line.tabSeatId === p.toSeatId) return;
  if (line.status === 'voided') throw new CommandRejected('LINE_VOIDED', 'That line was voided.');
  assertNotBilled(line);
  if (p.toSeatId) activeSeatOrThrow(line.tabId, p.toSeatId);
  const from = line.tabSeatId;
  line.tabSeatId = p.toSeatId;
  touch('lines', line.id);
  audit.record({
    outletId: line.outletId,
    actorStaffId: actor.staffId,
    actorDeviceId: actor.deviceId,
    action: 'line.moved',
    entityType: 'order_line',
    entityId: line.id,
    before: { tabSeatId: from },
    after: { tabSeatId: p.toSeatId },
    reason: null,
    severity: 'info',
  });
}

export function noteLine(p: OutboxPayload<'line.note'>): void {
  const line = lineOrThrow(p.lineId);
  if (line.status !== 'pending') return;
  line.note = p.note;
  touch('lines', line.id);
}

/** Void: the stock comes back, the audit row is sensitive, and a poured line needs its approval. */
export function voidLine(p: OutboxPayload<'line.void'>, actor: Actor): void {
  const line = lineOrThrow(p.lineId);
  if (line.status === 'voided') return;
  assertNotBilled(line);
  if (line.status === 'served' && !p.approvalToken) throw new CommandRejected('APPROVAL_REQUIRED', 'This line was poured. A supervisor approves the void with their PIN.');
  const before = line.status;
  line.status = 'voided';
  line.voidedBy = actor.staffId;
  line.voidedAt = Date.now();
  line.voidReason = p.reason;
  inventory.reverseSale({ lineId: line.id, actor });
  rollUpOrder(line.orderId);
  touch('lines', line.id);
  audit.record({
    outletId: line.outletId,
    actorStaffId: actor.staffId,
    actorDeviceId: actor.deviceId,
    action: 'line.voided',
    entityType: 'order_line',
    entityId: line.id,
    before: { status: before },
    after: { status: 'voided' },
    reason: p.reason,
    severity: 'sensitive',
  });
}

/** docs/05 1.3: the order is served when its last live line is, partially served from the first. */
function rollUpOrder(orderId: string) {
  const t = tradeTables();
  const order = t.orders.find((o) => o.id === orderId);
  if (!order) return;
  const live = t.lines.filter((l) => l.orderId === orderId && l.status !== 'voided');
  const next: Order['status'] = live.length === 0 ? 'voided' : live.every((l) => l.status === 'served') ? 'served' : live.some((l) => l.status === 'served') ? 'partially_served' : 'fired';
  if (order.status !== next) {
    order.status = next;
    touch('orders', order.id);
  }
}

/** The counter pours. A line already poured or voided is left as it is. */
export function serveLines(p: OutboxPayload<'line.serve'>, actor: Actor): void {
  const t = tradeTables();
  const orders = new Set<string>();
  for (const id of p.lineIds) {
    const line = t.lines.find((l) => l.id === id && l.tabId === p.tabId);
    if (!line) throw new CommandRejected('NOT_FOUND', 'A line on this ticket does not exist on the server.');
    if (line.status !== 'pending') continue;
    line.status = 'served';
    line.servedAt = p.servedAt;
    line.servedBy = actor.staffId;
    touch('lines', line.id);
    orders.add(line.orderId);
  }
  for (const id of orders) rollUpOrder(id);
}

export function moveTab(p: OutboxPayload<'tab.move'>, actor: Actor): void {
  const tab = openTabOrThrow(p.tabId);
  const table = tradeTables().tables.find((x) => x.id === p.toTableId);
  if (!table) throw new CommandRejected('NOT_FOUND', 'That table does not exist.');
  if (tab.serviceTableId === table.id) return;
  const before = { serviceTableId: tab.serviceTableId };
  tab.serviceTableId = table.id;
  tab.zoneId = table.zoneId;
  touch('tabs', tab.id);
  audit.record({ outletId: tab.outletId, actorStaffId: actor.staffId, actorDeviceId: actor.deviceId, action: 'tab.moved', entityType: 'tab', entityId: tab.id, before, after: { serviceTableId: table.id }, reason: null, severity: 'info' });
}

export function handOver(p: OutboxPayload<'tab.handover'>, actor: Actor): void {
  if (!identity.staffById(p.toStaffId)) throw new CommandRejected('NOT_FOUND', 'That person is not on the team.');
  for (const id of p.tabIds) {
    const tab = openTabOrThrow(id);
    if (tab.assignedTo === p.toStaffId) continue;
    const before = { assignedTo: tab.assignedTo };
    tab.assignedTo = p.toStaffId;
    touch('tabs', tab.id);
    audit.record({ outletId: tab.outletId, actorStaffId: actor.staffId, actorDeviceId: actor.deviceId, action: 'tab.handover', entityType: 'tab', entityId: tab.id, before, after: { assignedTo: p.toStaffId }, reason: null, severity: 'info' });
  }
}

/* ------------------------------------------------------ used by settlement */

/** Mark a seat settled by a bill. */
export function settleSeat(seatId: string, billId: string, at: number): void {
  const seat = tradeTables().seats.find((s) => s.id === seatId);
  if (!seat || seat.status !== 'active') return;
  seat.status = 'settled';
  seat.settledBillId = billId;
  seat.settledAt = at;
  touch('seats', seat.id);
}

/** Close a tab when nothing is left to bill, or mark it part settled. */
export function updateTabAfterBill(tabId: string, remainingBillable: number, openSplit: boolean, billId: string, at: number): void {
  const t = tradeTables();
  const tab = t.tabs.find((x) => x.id === tabId);
  if (!tab) return;
  if (remainingBillable === 0 && !openSplit) {
    tab.status = 'settled';
    tab.closedAt = at;
    for (const seat of t.seats.filter((s) => s.tabId === tabId && s.status === 'active')) settleSeat(seat.id, billId, at);
  } else {
    tab.status = 'part_settled';
  }
  touch('tabs', tab.id);
}
