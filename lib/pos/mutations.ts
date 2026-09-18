'use client';

import { isSellable } from '@bliss/shared/availability';
import type { Order, OrderLine, OrderLineModifier, Tab, TabSeat } from '@bliss/shared/domain';
import { type Cents, toJSON } from '@bliss/shared/money';
import { resolvePrice } from '@bliss/shared/pricing';
import { checkReason } from '@bliss/shared/reason';
import { canRemoveSeat, nextSeatNo, normaliseSeatLabel, seatColourIndex, seatNumbersForGuests } from '@bliss/shared/seats';
import { type OutboxKind, type OutboxPayload, validatePayload } from '@bliss/shared/sync';
import { businessDate } from '@bliss/shared/time';
import { META, posDb, getMeta, setMeta } from './db';
import { newId } from './ids';
import { pricingIndex } from './pricing';
import type { BoundDevice, StaffSession } from './session';
import { syncNow } from './sync';

/**
 * Floor mutations. docs/01-product-spec.md R3: every mutating action writes local state and an outbox
 * entry in one IndexedDB transaction, renders before any network call, and drains in sequence.
 *
 * Unfired lines are the waiter's draft: they live on the tablet and survive a force close, and reach
 * the server inside the order.fire entry, which the server applies as one transaction. docs/05 1.3:
 * "draft exists only on the client. An order that reaches the server is at least fired."
 */

export type SeatSelection = string | 'shared';

export interface Context {
  session: StaffSession;
  device: BoundDevice;
  outletId: string;
  timezone: string;
  cutover: string;
}

export async function context(): Promise<Context> {
  const [session, device, outlet] = await Promise.all([
    getMeta<StaffSession>(META.session),
    getMeta<BoundDevice>(META.deviceId),
    getMeta<{ id: string; timezone: string; cutover: string }>(META.outlet),
  ]);
  if (!session) throw new Error('Sign in to take orders on this tablet.');
  if (!device || !outlet) throw new Error('This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.');
  return { session, device, outletId: outlet.id, timezone: outlet.timezone, cutover: outlet.cutover };
}

export async function enqueue<K extends OutboxKind>(ctx: Context, kind: K, aggregateId: string, payload: OutboxPayload<K>) {
  const db = posDb();
  const seq = ((await getMeta<number>(META.deviceSeq)) ?? 0) + 1;
  await setMeta(META.deviceSeq, seq);
  await db.outbox.add({
    id: newId(ctx.device.id),
    seq,
    deviceId: ctx.device.id,
    staffId: ctx.session.staffId,
    kind,
    aggregateId,
    payload: validatePayload(kind, payload),
    clientAt: Date.now(),
    attempts: 0,
    status: 'pending',
  });
}

export function afterCommit() {
  void syncNow();
}

/* ----------------------------------------------------------------- tabs */

export async function openTab(input: { tableId: string | null; zoneId: string; guestCount: number; name: string | null }): Promise<string> {
  const ctx = await context();
  const db = posDb();
  const now = Date.now();
  const tabId = newId(ctx.device.id);
  const seatNos = seatNumbersForGuests(input.guestCount);
  const seats: TabSeat[] = seatNos.map((seatNo) => ({
    id: newId(ctx.device.id),
    outletId: ctx.outletId,
    tabId,
    seatNo,
    label: null,
    colourIndex: seatColourIndex(seatNo),
    status: 'active',
    settledBillId: null,
    settledAt: null,
    createdBy: ctx.session.staffId,
    createdAt: now,
  }));
  const tab: Tab = {
    id: tabId,
    outletId: ctx.outletId,
    businessDate: businessDate(now, ctx.timezone, ctx.cutover),
    serviceTableId: input.tableId,
    zoneId: input.zoneId,
    // Server allocated on acknowledgement. Until then the rail shows the table, never a placeholder.
    tabNumber: null,
    name: input.name?.trim() || null,
    guestCount: seatNos.length,
    openedBy: ctx.session.staffId,
    openedAt: now,
    assignedTo: ctx.session.staffId,
    status: 'open',
    mergedIntoTabId: null,
    closedAt: null,
  };
  await db.transaction('rw', [db.tabs, db.seats, db.outbox, db.meta], async () => {
    await db.tabs.add(tab);
    await db.seats.bulkAdd(seats);
    await setMeta(META.selectedSeat(tabId), seats[0]!.id);
    await enqueue(ctx, 'tab.open', tabId, {
      v: 1,
      tabId,
      serviceTableId: input.tableId,
      zoneId: input.zoneId,
      name: tab.name,
      guestCount: tab.guestCount,
      seats: seats.map((s) => ({ seatId: s.id, seatNo: s.seatNo })),
      openedAt: now,
    });
  });
  afterCommit();
  return tabId;
}

export async function moveTab(tabId: string, toTableId: string) {
  const ctx = await context();
  const db = posDb();
  await db.transaction('rw', [db.tabs, db.serviceTables, db.outbox, db.meta], async () => {
    const tab = await db.tabs.get(tabId);
    if (!tab) throw new Error('That tab is no longer open.');
    const table = await db.serviceTables.get(toTableId);
    await db.tabs.update(tabId, { serviceTableId: toTableId, zoneId: table?.zoneId ?? tab.zoneId });
    await enqueue(ctx, 'tab.move', tabId, { v: 1, tabId, fromTableId: tab.serviceTableId, toTableId });
  });
  afterCommit();
}

export async function handOver(tabIds: string[], toStaffId: string) {
  const ctx = await context();
  const db = posDb();
  await db.transaction('rw', [db.tabs, db.outbox, db.meta], async () => {
    for (const id of tabIds) await db.tabs.update(id, { assignedTo: toStaffId });
    await enqueue(ctx, 'tab.handover', tabIds[0]!, { v: 1, tabIds, toStaffId });
  });
  afterCommit();
}

/* ---------------------------------------------------------------- seats */

export async function selectSeat(tabId: string, seat: SeatSelection) {
  await setMeta(META.selectedSeat(tabId), seat);
}

export async function addSeat(tabId: string): Promise<number> {
  const ctx = await context();
  const db = posDb();
  let added = 0;
  await db.transaction('rw', [db.tabs, db.seats, db.outbox, db.meta], async () => {
    const seats = await db.seats.where('tabId').equals(tabId).toArray();
    const seatNo = nextSeatNo(seats);
    const seat: TabSeat = {
      id: newId(ctx.device.id),
      outletId: ctx.outletId,
      tabId,
      seatNo,
      label: null,
      colourIndex: seatColourIndex(seatNo),
      status: 'active',
      settledBillId: null,
      settledAt: null,
      createdBy: ctx.session.staffId,
      createdAt: Date.now(),
    };
    await db.seats.add(seat);
    const tab = await db.tabs.get(tabId);
    if (tab) await db.tabs.update(tabId, { guestCount: tab.guestCount + 1 });
    await setMeta(META.selectedSeat(tabId), seat.id);
    await enqueue(ctx, 'seat.add', tabId, { v: 1, tabId, seatId: seat.id, seatNo });
    added = seatNo;
  });
  afterCommit();
  return added;
}

export async function labelSeat(seatId: string, label: string) {
  const ctx = await context();
  const db = posDb();
  const value = normaliseSeatLabel(label);
  await db.transaction('rw', [db.seats, db.outbox, db.meta], async () => {
    const seat = await db.seats.get(seatId);
    if (!seat) throw new Error('That seat is no longer on the tab.');
    await db.seats.update(seatId, { label: value });
    await enqueue(ctx, 'seat.label', seat.tabId, { v: 1, tabId: seat.tabId, seatId, label: value });
  });
  afterCommit();
}

export async function removeSeat(seatId: string) {
  const ctx = await context();
  const db = posDb();
  await db.transaction('rw', [db.seats, db.lines, db.tabs, db.outbox, db.meta], async () => {
    const seat = await db.seats.get(seatId);
    if (!seat) return;
    const lines = await db.lines.where('tabSeatId').equals(seatId).toArray();
    const check = canRemoveSeat(seatId, lines);
    if (!check.ok) {
      throw new Error(`Seat ${seat.seatNo} has ${check.lineCount} ${check.lineCount === 1 ? 'line' : 'lines'} on it. Move them or void them first.`);
    }
    await db.seats.update(seatId, { status: 'removed' });
    const remaining = (await db.seats.where('tabId').equals(seat.tabId).toArray()).filter((s) => s.status === 'active' && s.id !== seatId);
    const selected = await getMeta<string>(META.selectedSeat(seat.tabId));
    if (selected === seatId) await setMeta(META.selectedSeat(seat.tabId), remaining[0]?.id ?? 'shared');
    await enqueue(ctx, 'seat.remove', seat.tabId, { v: 1, tabId: seat.tabId, seatId });
  });
  afterCommit();
}

/* ---------------------------------------------------------------- lines */

export interface ModifierChoice {
  modifierId: string;
  name: string;
  priceDeltaCents: Cents;
  linkedVariantId: string | null;
}

async function draftOrder(ctx: Context, tabId: string): Promise<Order> {
  const db = posDb();
  const existing = (await db.orders.where('tabId').equals(tabId).toArray()).find((o) => o.status === 'draft');
  if (existing) return existing;
  const now = Date.now();
  const order: Order = {
    id: newId(ctx.device.id),
    outletId: ctx.outletId,
    tabId,
    businessDate: businessDate(now, ctx.timezone, ctx.cutover),
    orderNumber: null,
    firedAt: null,
    firedBy: null,
    deviceId: ctx.device.id,
    status: 'draft',
    clientCreatedAt: now,
    serverReceivedAt: null,
    note: null,
  };
  await db.orders.add(order);
  return order;
}

/**
 * Add a serve to the selected seat. Availability is checked locally first: a finished tile makes no
 * network call and adds nothing. The row renders from the local commit, never from a server reply.
 */
export async function addLine(input: { tabId: string; seat: SeatSelection; variantId: string; qty?: number; modifiers?: ModifierChoice[]; note?: string | null }) {
  const ctx = await context();
  const db = posDb();
  const availability = await db.availability.get(input.variantId);
  if (availability && !isSellable(availability.state)) return null;
  const index = await pricingIndex();
  const modifiers = input.modifiers ?? [];
  const note = input.note?.trim() || null;
  const tabSeatId = input.seat === 'shared' ? null : input.seat;
  let lineId = '';

  await db.transaction('rw', [db.orders, db.lines, db.lineModifiers, db.meta], async () => {
    const order = await draftOrder(ctx, input.tabId);
    const drafts = await db.lines.where('orderId').equals(order.id).toArray();
    const modifierKey = modifiers.map((m) => m.modifierId).sort().join(',');
    const same = modifiers.length === 0 && !note ? drafts.find((l) => l.productVariantId === input.variantId && l.tabSeatId === tabSeatId && !l.note) : undefined;
    const sameHasModifiers = same ? (await db.lineModifiers.where('orderLineId').equals(same.id).count()) > 0 : false;
    const now = Date.now();
    const qty = (same && !sameHasModifiers && modifierKey === '' ? same.qty : 0) + (input.qty ?? 1);
    const price = resolvePrice(index, {
      variantId: input.variantId,
      qty,
      at: now,
      timeZone: ctx.timezone,
      modifiers: modifiers.map((m) => ({ name: m.name, priceDeltaCents: m.priceDeltaCents, qty: 1 })),
    });

    if (same && !sameHasModifiers) {
      await db.lines.update(same.id, { qty, unitPriceCents: price.unitPriceCents, lineTotalCents: price.lineTotalCents, priceDerivation: price.derivation });
      lineId = same.id;
      return;
    }
    const line: OrderLine = {
      id: newId(ctx.device.id),
      outletId: ctx.outletId,
      orderId: order.id,
      tabId: input.tabId,
      tabSeatId,
      productVariantId: input.variantId,
      qty,
      unitPriceCents: price.unitPriceCents,
      lineTotalCents: price.lineTotalCents,
      priceDerivation: price.derivation,
      note,
      status: 'draft',
      stockConflict: false,
      servedAt: null,
      servedBy: null,
      voidedBy: null,
      voidedAt: null,
      voidReason: null,
      createdBy: ctx.session.staffId,
      deviceId: ctx.device.id,
      clientCreatedAt: now,
    };
    await db.lines.add(line);
    const rows: OrderLineModifier[] = modifiers.map((m) => ({
      id: newId(ctx.device.id),
      orderLineId: line.id,
      modifierId: m.modifierId,
      name: m.name,
      qty: 1,
      priceDeltaCents: m.priceDeltaCents,
      linkedVariantId: m.linkedVariantId,
    }));
    if (rows.length > 0) await db.lineModifiers.bulkAdd(rows);
    lineId = line.id;
  });
  return lineId;
}

/** Change the quantity of a line that has not been fired. A fired line never changes quantity. */
export async function setDraftQty(lineId: string, qty: number) {
  const ctx = await context();
  const db = posDb();
  const index = await pricingIndex();
  await db.transaction('rw', [db.lines, db.lineModifiers], async () => {
    const line = await db.lines.get(lineId);
    if (!line || line.status !== 'draft') throw new Error('A fired line cannot change. Void it with a reason, or add a new line.');
    if (qty < 1) {
      await db.lineModifiers.where('orderLineId').equals(lineId).delete();
      // An unfired draft never left this tablet: clearing it is not a void, and nothing is recorded.
      await db.lines.delete(lineId);
      return;
    }
    const mods = await db.lineModifiers.where('orderLineId').equals(lineId).toArray();
    const price = resolvePrice(index, {
      variantId: line.productVariantId,
      qty,
      at: Date.now(),
      timeZone: ctx.timezone,
      modifiers: mods.map((m) => ({ name: m.name, priceDeltaCents: m.priceDeltaCents, qty: m.qty })),
    });
    await db.lines.update(lineId, { qty, unitPriceCents: price.unitPriceCents, lineTotalCents: price.lineTotalCents, priceDerivation: price.derivation });
  });
}

export async function setLineNote(lineId: string, note: string | null) {
  const ctx = await context();
  const db = posDb();
  const value = note?.trim() || null;
  await db.transaction('rw', [db.lines, db.outbox, db.meta], async () => {
    const line = await db.lines.get(lineId);
    if (!line) return;
    if (line.status === 'served' || line.status === 'voided') throw new Error('A poured line cannot take a note.');
    await db.lines.update(lineId, { note: value });
    if (line.status === 'pending') await enqueue(ctx, 'line.note', line.tabId, { v: 1, lineId, note: value });
  });
  afterCommit();
}

/**
 * Move a line between seats. A move, not a void and re-add: same id, same fire time, same derivation,
 * audited on the server as line.moved_seat with both seat ids. docs/05 section 2.5.
 */
export async function moveLine(lineId: string, to: SeatSelection) {
  const ctx = await context();
  const db = posDb();
  const toSeatId = to === 'shared' ? null : to;
  await db.transaction('rw', [db.lines, db.seats, db.outbox, db.meta], async () => {
    const line = await db.lines.get(lineId);
    if (!line || line.tabSeatId === toSeatId) return;
    if (toSeatId) {
      const seat = await db.seats.get(toSeatId);
      if (!seat || seat.status !== 'active') throw new Error(`Seat ${seat?.seatNo ?? ''} was settled. Add this to another seat or to Shared.`);
    }
    await db.lines.update(lineId, { tabSeatId: toSeatId });
    if (line.status !== 'draft') {
      await enqueue(ctx, 'line.move', line.tabId, { v: 1, lineId, tabId: line.tabId, fromSeatId: line.tabSeatId, toSeatId });
    }
  });
  afterCommit();
}

export async function voidLine(input: { lineId: string; reason: string; approvalToken: string | null }) {
  const ctx = await context();
  const check = checkReason(input.reason);
  if (!check.ok) throw new Error(check.message);
  const db = posDb();
  await db.transaction('rw', [db.lines, db.outbox, db.meta], async () => {
    const line = await db.lines.get(input.lineId);
    if (!line) return;
    if (line.status === 'voided') return;
    if (line.status === 'served' && !input.approvalToken) throw new Error('This line was poured. A supervisor approves the void with their PIN.');
    await db.lines.update(input.lineId, { status: 'voided', voidedBy: ctx.session.staffId, voidedAt: Date.now(), voidReason: check.reason });
    await enqueue(ctx, 'line.void', line.tabId, { v: 1, lineId: input.lineId, reason: check.reason, approvalToken: input.approvalToken });
  });
  afterCommit();
}

/**
 * Fire the draft. Prices are resolved again at the fire instant, because price is fixed at fire time
 * and never recomputed at settlement. One outbox entry carries the order and every line, so the
 * server applies it as one transaction or not at all.
 */
export async function fireOrder(tabId: string): Promise<number> {
  const ctx = await context();
  const db = posDb();
  const index = await pricingIndex();
  let fired = 0;
  await db.transaction('rw', [db.orders, db.lines, db.lineModifiers, db.outbox, db.meta], async () => {
    const order = (await db.orders.where('tabId').equals(tabId).toArray()).find((o) => o.status === 'draft');
    if (!order) return;
    const lines = (await db.lines.where('orderId').equals(order.id).toArray()).filter((l) => l.status === 'draft');
    if (lines.length === 0) return;
    const firedAt = Date.now();
    const payloadLines = [];
    for (const line of lines) {
      const mods = await db.lineModifiers.where('orderLineId').equals(line.id).toArray();
      const price = resolvePrice(index, {
        variantId: line.productVariantId,
        qty: line.qty,
        at: firedAt,
        timeZone: ctx.timezone,
        modifiers: mods.map((m) => ({ name: m.name, priceDeltaCents: m.priceDeltaCents, qty: m.qty })),
      });
      await db.lines.update(line.id, {
        status: 'pending',
        unitPriceCents: price.unitPriceCents,
        lineTotalCents: price.lineTotalCents,
        priceDerivation: price.derivation,
      });
      payloadLines.push({
        lineId: line.id,
        tabSeatId: line.tabSeatId,
        productVariantId: line.productVariantId,
        qty: line.qty,
        unitPriceCents: toJSON(price.unitPriceCents),
        lineTotalCents: toJSON(price.lineTotalCents),
        priceDerivation: price.derivation,
        note: line.note,
        modifiers: mods.map((m) => ({ modifierId: m.modifierId, qty: m.qty, priceDeltaCents: toJSON(m.priceDeltaCents), linkedVariantId: m.linkedVariantId })),
        clientCreatedAt: line.clientCreatedAt,
      });
    }
    await db.orders.update(order.id, { status: 'fired', firedAt, firedBy: ctx.session.staffId });
    const [catalogueVersion, availabilityVersion] = await Promise.all([getMeta<number>(META.catalogueVersion), getMeta<number>(META.availabilityVersion)]);
    await enqueue(ctx, 'order.fire', tabId, {
      v: 1,
      orderId: order.id,
      tabId,
      firedAt,
      catalogueVersion: catalogueVersion ?? 0,
      availabilityVersion: availabilityVersion ?? 0,
      lines: payloadLines,
    });
    fired = lines.length;
  });
  afterCommit();
  return fired;
}

