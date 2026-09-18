'use client';

import type { BillLine } from '@bliss/db/seed/types';
import type { Bill, BillScope, Tender, TenderKind } from '@bliss/shared/domain';
import { type Cents, ZERO, isPositive, multiplyByQty, scale, subtract, sum, toJSON } from '@bliss/shared/money';
import { checkReason } from '@bliss/shared/reason';
import { amountDue, billableLines, checkTenders } from '@bliss/shared/settlement';
import { businessDate } from '@bliss/shared/time';
import { api } from './api';
import { type DrawerRow, posDb } from './db';
import { newId } from './ids';
import { afterCommit, context, enqueue } from './mutations';

/**
 * Counter mutations. docs/14 section 5. Local first, like the Floor: pouring, settling, a quick sale,
 * opening the drawer and a cash drop render on this device at once and travel in the outbox. Only
 * the drawer count and close go straight to the server, because the expected figure must not exist
 * on the device before the count is locked.
 *
 * Bliss records tenders. It makes no call to any payment provider and never claims a payment succeeded.
 */

/* ------------------------------------------------------------------ pour */

export async function pourLines(tabId: string, lineIds: string[]) {
  if (lineIds.length === 0) return;
  const ctx = await context();
  const db = posDb();
  const now = Date.now();
  await db.transaction('rw', [db.lines, db.outbox, db.meta], async () => {
    const lines = (await db.lines.bulkGet(lineIds)).filter((l): l is NonNullable<typeof l> => Boolean(l) && l!.status === 'pending');
    if (lines.length === 0) return;
    await db.lines.bulkUpdate(lines.map((l) => ({ key: l.id, changes: { status: 'served' as const, servedAt: now, servedBy: ctx.session.staffId } })));
    await enqueue(ctx, 'line.serve', tabId, { v: 1, tabId, lineIds: lines.map((l) => l.id), servedAt: now });
  });
  afterCommit();
}

/* ---------------------------------------------------------------- settle */

export interface TenderDraft {
  id: string;
  kind: TenderKind;
  amount: Cents;
  /** Cash only: what the guest handed over. */
  tendered: Cents | null;
  reference: string | null;
}

export function draftTender(kind: TenderKind, amount: Cents, tendered: Cents | null, reference: string | null): TenderDraft {
  return { id: newId(null), kind, amount, tendered: kind === 'cash' ? tendered : null, reference: kind === 'cash' ? null : reference?.trim() || null };
}

export interface SettleInput {
  scope: BillScope;
  tabId: string | null;
  tabSeatId: string | null;
  lineIds: string[];
  items: { productVariantId: string; qty: number; unitPriceCents: Cents; name: string }[];
  split: { groupId: string; index: number; count: number } | null;
  subtotal: Cents;
  tenders: TenderDraft[];
}

export async function openDrawerOnThisDevice(): Promise<DrawerRow | null> {
  const ctx = await context();
  return (await posDb().drawers.where('deviceId').equals(ctx.device.id).filter((d) => d.status !== 'closed').first()) ?? null;
}

/**
 * Settle a bill. The bill, its lines snapshotted with seat number and label, its tenders, and the seat
 * and tab state change together on this device, and one outbox entry carries them to the server,
 * which works the total out again before accepting it.
 */
export async function settle(input: SettleInput): Promise<string> {
  const ctx = await context();
  const db = posDb();
  const { due, rounding } = amountDue(input.subtotal);
  const check = checkTenders(
    due,
    input.tenders.map((t) => ({ kind: t.kind, amountCents: t.amount, tenderedCents: t.tendered })),
  );
  if (!check.ok) throw new Error(check.message);
  if (input.tenders.some((t) => t.kind === 'cash') && !(await openDrawerOnThisDevice())) {
    throw new Error('Open the drawer before taking cash. M-Pesa and card can be recorded without it.');
  }

  const billId = newId(ctx.device.id);
  const now = Date.now();
  const drawer = await openDrawerOnThisDevice();

  await db.transaction('rw', [db.bills, db.billLines, db.tenders, db.lines, db.seats, db.tabs, db.variants, db.outbox, db.meta], async () => {
    const lines = input.lineIds.length > 0 ? (await db.lines.bulkGet(input.lineIds)).filter((l): l is NonNullable<typeof l> => Boolean(l)) : [];
    const seats = input.tabId ? await db.seats.where('tabId').equals(input.tabId).toArray() : [];
    const variants = new Map((await db.variants.bulkGet(lines.map((l) => l.productVariantId))).filter(Boolean).map((v) => [v!.id, v!.name]));
    const billNumber = ((await db.bills.orderBy('settledAt').last())?.billNumber ?? 0) + 1;

    const bill: Bill = {
      id: billId,
      outletId: ctx.outletId,
      businessDate: businessDate(now, ctx.timezone, ctx.cutover),
      tabId: input.tabId,
      tabSeatId: input.tabSeatId,
      billNumber,
      scope: input.scope,
      splitGroupId: input.split?.groupId ?? null,
      subtotalCents: input.subtotal,
      discountCents: ZERO,
      // A provisional figure at the outlet's 16% VAT, inclusive. The server writes the authoritative bill and
      // this row is replaced on the next pull.
      taxCents: scale(input.subtotal, 1_600n, 11_600n),
      totalCents: input.subtotal,
      roundingCents: rounding,
      status: 'settled',
      settledAt: now,
      settledBy: ctx.session.staffId,
      deviceId: ctx.device.id,
    };
    await db.bills.add(bill);

    const billLines: BillLine[] = [
      ...lines.map((l) => {
        const seat = seats.find((s) => s.id === l.tabSeatId);
        return { id: `${billId}:${l.id}`, billId, orderLineId: l.id, productVariantId: l.productVariantId, description: variants.get(l.productVariantId) ?? 'Item', seatNo: seat?.seatNo ?? null, seatLabel: seat?.label ?? null, qty: l.qty, unitPriceCents: l.unitPriceCents, lineTotalCents: l.lineTotalCents };
      }),
      ...input.items.map((item, i) => ({ id: `${billId}:q${i}`, billId, orderLineId: null, productVariantId: item.productVariantId, description: item.name, seatNo: null, seatLabel: null, qty: item.qty, unitPriceCents: item.unitPriceCents, lineTotalCents: multiplyByQty(item.unitPriceCents, item.qty) })),
    ];
    await db.billLines.bulkAdd(billLines);

    const tenders: Tender[] = input.tenders.map((t) => ({
      id: t.id,
      billId,
      kind: t.kind,
      amountCents: t.amount,
      tenderedCents: t.tendered,
      changeCents: t.kind === 'cash' && t.tendered !== null ? subtract(t.tendered, t.amount) : null,
      reference: t.reference,
      createdBy: ctx.session.staffId,
      deviceId: ctx.device.id,
      createdAt: now,
    }));
    await db.tenders.bulkAdd(tenders);

    // What the server will do, done here first, so the tab list and the Floor's own copy move now.
    if (input.tabId) {
      const active = seats.filter((s) => s.status === 'active').sort((a, b) => a.seatNo - b.seatNo);
      const settledSeat = input.scope === 'seat' ? input.tabSeatId : input.scope === 'even_split' ? (active[0]?.id ?? null) : null;
      if (settledSeat) await db.seats.update(settledSeat, { status: 'settled', settledBillId: billId, settledAt: now });
      const billed = new Set((await db.billLines.toArray()).map((l) => l.orderLineId).filter((x): x is string => Boolean(x)));
      const remaining = billableLines(await db.lines.where('tabId').equals(input.tabId).toArray(), billed).length;
      const splitOpen = input.split ? (await db.bills.filter((b) => b.splitGroupId === input.split!.groupId).count()) < input.split.count : false;
      if (remaining === 0 && !splitOpen) {
        await db.tabs.update(input.tabId, { status: 'settled', closedAt: now });
        for (const s of active) if (s.id !== settledSeat) await db.seats.update(s.id, { status: 'settled', settledBillId: billId, settledAt: now });
      } else {
        await db.tabs.update(input.tabId, { status: 'part_settled' });
      }
    }

    await enqueue(ctx, 'bill.settle', input.tabId ?? billId, {
      v: 1,
      billId,
      scope: input.scope,
      tabId: input.tabId,
      tabSeatId: input.tabSeatId,
      lineIds: input.lineIds,
      items: input.items.map((i) => ({ productVariantId: i.productVariantId, qty: i.qty, unitPriceCents: toJSON(i.unitPriceCents) })),
      split: input.split,
      subtotalCents: toJSON(input.subtotal),
      roundingCents: toJSON(rounding),
      dueCents: toJSON(due),
      tenders: tenders.map((t) => ({
        tenderId: t.id,
        kind: t.kind,
        amountCents: toJSON(t.amountCents),
        tenderedCents: t.tenderedCents === null ? null : toJSON(t.tenderedCents),
        changeCents: t.changeCents === null ? null : toJSON(t.changeCents),
        reference: t.reference,
      })),
      drawerSessionId: drawer?.id ?? null,
      settledAt: now,
    });
  });
  afterCommit();
  return billId;
}

/* ---------------------------------------------------------------- drawer */

export async function openDrawer(float: Cents): Promise<void> {
  const ctx = await context();
  if (await openDrawerOnThisDevice()) throw new Error('A drawer is already open on this counter.');
  const db = posDb();
  const sessionId = newId(ctx.device.id);
  const now = Date.now();
  await db.transaction('rw', [db.drawers, db.outbox, db.meta], async () => {
    await db.drawers.add({ id: sessionId, businessDate: businessDate(now, ctx.timezone, ctx.cutover), deviceId: ctx.device.id, openedBy: ctx.session.staffId, openedAt: now, openingFloatCents: float, status: 'open', drops: [], cashBills: 0 });
    await enqueue(ctx, 'drawer.open', sessionId, { v: 1, sessionId, floatCents: toJSON(float), openedAt: now });
  });
  afterCommit();
}

export async function dropCash(amount: Cents, reason: string): Promise<void> {
  const ctx = await context();
  if (!isPositive(amount)) throw new Error('Enter the amount going to the safe.');
  const check = checkReason(reason);
  if (!check.ok) throw new Error(check.message);
  const drawer = await openDrawerOnThisDevice();
  if (!drawer || drawer.status !== 'open') throw new Error('The drawer is not open on this counter.');
  const db = posDb();
  const movementId = newId(ctx.device.id);
  const now = Date.now();
  await db.transaction('rw', [db.drawers, db.outbox, db.meta], async () => {
    await db.drawers.update(drawer.id, { drops: [...drawer.drops, { id: movementId, amountCents: amount, reason: check.reason, occurredAt: now, createdBy: ctx.session.staffId }] });
    await enqueue(ctx, 'drawer.drop', drawer.id, { v: 1, movementId, sessionId: drawer.id, amountCents: toJSON(amount), reason: check.reason, at: now });
  });
  afterCommit();
}

export interface OpenTabBlock {
  tabId: string;
  label: string;
  tabNumber: number | null;
  waiter: string;
  total: Cents;
  seats: { seatNo: number; settled: boolean }[];
}

type DrawerResponse<T> = ({ ok: true } & T) | { ok: false; message: string; code?: string };

async function drawerCall<T>(body: Record<string, unknown>): Promise<T> {
  const ctx = await context();
  // The drawer close refuses to run on stale data: everything waiting in the outbox goes first.
  const pending = await posDb().outbox.where('status').anyOf('pending', 'inflight').count();
  if (pending > 0 && body.action !== 'preflight') throw new Error('This counter still has changes to send. Wait for Synced, then count the drawer.');
  const { body: result } = await api.post<DrawerResponse<T>>('/api/dev/counter/drawer', { ...body, deviceId: ctx.device.id, staffId: ctx.session.staffId });
  if (!result.ok) throw new Error(result.message);
  return result;
}

export async function drawerPreflight(): Promise<OpenTabBlock[]> {
  return (await drawerCall<{ openTabs: OpenTabBlock[] }>({ action: 'preflight' })).openTabs;
}

/** Lock the count. Only the reply carries the expected figure, and it is stored now that it may exist. */
export async function countDrawer(sessionId: string, counted: Cents): Promise<{ view: DrawerRow; needsReason: boolean; threshold: Cents }> {
  const result = await drawerCall<{ view: DrawerRow; needsReason: boolean; threshold: Cents }>({ action: 'count', sessionId, countedCents: toJSON(counted) });
  await posDb().drawers.put(result.view);
  return result;
}

export async function closeDrawer(sessionId: string, reason: string | null): Promise<DrawerRow> {
  const { view } = await drawerCall<{ view: DrawerRow }>({ action: 'close', sessionId, reason });
  await posDb().drawers.put(view);
  return view;
}

export function cashTakenOnBills(tenders: readonly Tender[]): Cents {
  return sum(tenders.filter((t) => t.kind === 'cash').map((t) => t.amountCents));
}
