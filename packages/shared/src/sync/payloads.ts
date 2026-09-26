import * as z from 'zod/mini';

/**
 * Outbox payloads, versioned and validated on both sides. docs/02-system-architecture.md section 6.
 *
 * Money travels as a string of integer cents. Ids are client generated UUIDv7 and double as the
 * idempotency key. A payload shape change bumps its version rather than mutating in place.
 *
 * Written with zod/mini, the tree-shakable build: the tablets validate before they queue, and the
 * full build would put 55KB of schema library in the Floor and Counter bundles. Same schemas, same
 * messages, a functional form.
 */

const uuid = z.string().check(z.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'UUIDv7'));
const id = z.string().check(z.minLength(1));
const centsString = z.string().check(z.regex(/^-?\d+$/, 'integer cents as a string'));
const reason = z.string().check(z.trim(), z.minLength(10, 'Reason needs at least 10 characters.'));
const int = (min?: number, max?: number) =>
  z.number().check(z.int(), ...(min === undefined ? [] : [z.gte(min)]), ...(max === undefined ? [] : [z.lte(max)]));
const text = (max: number) => z.string().check(z.maxLength(max));
const list = <T extends z.core.SomeType>(item: T, min?: number, max?: number) =>
  z.array(item).check(...(min === undefined ? [] : [z.minLength(min)]), ...(max === undefined ? [] : [z.maxLength(max)]));
const v1 = z.literal(1);

export const derivationStep = z.object({ label: z.string(), input: z.string(), op: z.string(), output: z.string() });

export const tabOpenPayload = z.object({
  v: v1,
  tabId: uuid,
  serviceTableId: z.nullable(id),
  zoneId: id,
  name: z.nullable(text(40)),
  guestCount: int(1, 40),
  seats: list(z.object({ seatId: uuid, seatNo: int(1) }), 1),
  openedAt: int(),
});

export const seatAddPayload = z.object({ v: v1, tabId: id, seatId: uuid, seatNo: int(1) });
export const seatLabelPayload = z.object({ v: v1, tabId: id, seatId: id, label: z.nullable(text(24)) });
export const seatRemovePayload = z.object({ v: v1, tabId: id, seatId: id });

export const firedLine = z.object({
  lineId: uuid,
  tabSeatId: z.nullable(id),
  productVariantId: id,
  qty: int(1),
  unitPriceCents: centsString,
  lineTotalCents: centsString,
  priceDerivation: z.array(derivationStep),
  note: z.nullable(text(140)),
  modifiers: z.array(z.object({ modifierId: id, qty: int(1), priceDeltaCents: centsString, linkedVariantId: z.nullable(id) })),
  clientCreatedAt: int(),
});

export const orderFirePayload = z.object({
  v: v1,
  orderId: uuid,
  tabId: id,
  firedAt: int(),
  catalogueVersion: int(),
  availabilityVersion: int(),
  lines: list(firedLine, 1),
});

export const lineMovePayload = z.object({ v: v1, lineId: id, tabId: id, fromSeatId: z.nullable(id), toSeatId: z.nullable(id) });
export const lineNotePayload = z.object({ v: v1, lineId: id, note: z.nullable(text(140)) });
export const lineVoidPayload = z.object({
  v: v1,
  lineId: id,
  reason,
  /** Present when the line was already poured and a supervisor approved in the dialog. */
  approvalToken: z.nullable(z.string()),
});
export const tabMovePayload = z.object({ v: v1, tabId: id, fromTableId: z.nullable(id), toTableId: id });
export const tabHandoverPayload = z.object({ v: v1, tabIds: list(id, 1), toStaffId: id });

/**
 * The guests have left. docs/16 section 8. A settled tab lets go of its table; an open tab with
 * nothing on it closes, with a reason; `undo` puts a cleared tab back on its table if nobody has
 * sat down there since.
 */
export const tabClearPayload = z.object({
  v: v1,
  tabId: id,
  at: int(),
  undo: z._default(z.boolean(), false),
  reason: z._default(z.nullable(reason), null),
});

/** The guests want to pay: the Counter sees the tab first. `undo` takes the ask back. */
export const tabBillPayload = z.object({ v: v1, tabId: id, at: int(), undo: z._default(z.boolean(), false) });

/** The waiter set the round down at the table. `undo` takes the mark back. */
export const orderDeliverPayload = z.object({ v: v1, orderId: id, tabId: id, at: int(), undo: z._default(z.boolean(), false) });

/* ------------------------------------------------------------- the Counter, docs/14 */

/** The counter pours lines. Idempotent: a line already poured stays as it was. */
export const lineServePayload = z.object({ v: v1, tabId: id, lineIds: list(id, 1), servedAt: int() });

export const tenderKind = z.enum(['cash', 'mpesa', 'card', 'account', 'comp']);

export const tenderPayload = z.object({
  tenderId: uuid,
  kind: tenderKind,
  amountCents: centsString,
  /** Cash only: what the guest handed over. */
  tenderedCents: z.nullable(centsString),
  changeCents: z.nullable(centsString),
  /** Typed by the cashier. Bliss records it and does not check it. */
  reference: z.nullable(z.string().check(z.trim(), z.maxLength(64))),
});

export const billSettlePayload = z.object({
  v: v1,
  billId: uuid,
  scope: z.enum(['tab', 'seat', 'even_split', 'quick_sale']),
  tabId: z.nullable(id),
  tabSeatId: z.nullable(id),
  /** Order lines this bill takes. Empty for a quick sale and for every even split share after the first. */
  lineIds: z.array(id),
  /** Quick sale only: sealed variants sold without a tab, priced by the device, repriced by the server. */
  items: z.array(z.object({ productVariantId: id, qty: int(1, 99), unitPriceCents: centsString })),
  split: z.nullable(z.object({ groupId: uuid, index: int(0), count: int(2, 40) })),
  subtotalCents: centsString,
  roundingCents: centsString,
  dueCents: centsString,
  tenders: list(tenderPayload, 1, 8),
  drawerSessionId: z.nullable(id),
  settledAt: int(),
});

export const drawerOpenPayload = z.object({ v: v1, sessionId: uuid, floatCents: centsString, openedAt: int() });

export const drawerDropPayload = z.object({ v: v1, movementId: uuid, sessionId: id, amountCents: centsString, reason, at: int() });

export const outboxPayloads = {
  'line.serve': lineServePayload,
  'bill.settle': billSettlePayload,
  'drawer.open': drawerOpenPayload,
  'drawer.drop': drawerDropPayload,
  'tab.open': tabOpenPayload,
  'seat.add': seatAddPayload,
  'seat.label': seatLabelPayload,
  'seat.remove': seatRemovePayload,
  'order.fire': orderFirePayload,
  'line.move': lineMovePayload,
  'line.note': lineNotePayload,
  'line.void': lineVoidPayload,
  'tab.move': tabMovePayload,
  'tab.handover': tabHandoverPayload,
  'tab.clear': tabClearPayload,
  'order.deliver': orderDeliverPayload,
  'tab.bill': tabBillPayload,
} as const;

export type OutboxKind = keyof typeof outboxPayloads;
export type OutboxPayload<K extends OutboxKind> = z.output<(typeof outboxPayloads)[K]>;

export type OutboxStatus = 'pending' | 'inflight' | 'acked' | 'rejected';

export interface OutboxEntry<K extends OutboxKind = OutboxKind> {
  /** UUIDv7, the idempotency key. */
  id: string;
  /** Monotonic per device. */
  seq: number;
  deviceId: string;
  staffId: string;
  kind: K;
  /** The tab id. A rejection blocks this aggregate only. */
  aggregateId: string;
  payload: OutboxPayload<K>;
  clientAt: number;
  attempts: number;
  status: OutboxStatus;
  rejectionCode?: string;
  /** The server's sentence for the refusal, shown to the person who has to deal with it. */
  rejectionDetail?: string;
  ackedAt?: number;
}

export function validatePayload<K extends OutboxKind>(kind: K, payload: unknown): OutboxPayload<K> {
  return outboxPayloads[kind].parse(payload) as OutboxPayload<K>;
}

/** Rejection codes the server returns, from the conflict table. */
export type RejectionCode =
  | 'STALE_SNAPSHOT'
  | 'TAB_ALREADY_SETTLED'
  | 'BILL_ALREADY_SETTLED'
  | 'SEAT_ALREADY_SETTLED'
  | 'SEAT_HAS_LINES'
  | 'DEVICE_REVOKED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'LINE_ALREADY_BILLED'
  | 'LINE_VOIDED'
  | 'APPROVAL_REQUIRED'
  | 'BILL_TOTAL_MISMATCH'
  | 'TENDER_MISMATCH'
  | 'DRAWER_NOT_OPEN'
  | 'DRAWER_ALREADY_OPEN'
  | 'WRONG_SURFACE'
  | 'TAB_NOT_SETTLED'
  | 'TABLE_TAKEN';

/** Plain sentences for rejection codes, for the device that has to explain one. docs/08 section 6. */
export const REJECTION_COPY: Record<RejectionCode, string> = {
  STALE_SNAPSHOT: 'The menu changed while this device was offline. It has refreshed; try again.',
  TAB_ALREADY_SETTLED: 'This tab was already settled on another device.',
  BILL_ALREADY_SETTLED: 'This bill was already settled.',
  SEAT_ALREADY_SETTLED: 'That seat was settled before this change arrived.',
  SEAT_HAS_LINES: 'That seat still has lines on it.',
  DEVICE_REVOKED: 'This device was withdrawn. Its changes are kept for a manager to recover.',
  VALIDATION_FAILED: 'This change was not in a shape the server accepts.',
  NOT_FOUND: 'The tab or line this change was for no longer exists.',
  LINE_ALREADY_BILLED: 'A line on this bill was already settled on another bill.',
  LINE_VOIDED: 'A line on this bill was voided before it was settled.',
  APPROVAL_REQUIRED: 'A poured line needs a supervisor to approve the void.',
  BILL_TOTAL_MISMATCH: 'The bill total changed before it was settled. Open the tab again to see the current total.',
  TENDER_MISMATCH: 'The tenders did not add up to the amount due.',
  DRAWER_NOT_OPEN: 'Cash needs an open drawer on this device.',
  DRAWER_ALREADY_OPEN: 'A drawer is already open on this device.',
  WRONG_SURFACE: 'This change belongs to another kind of device.',
  TAB_NOT_SETTLED: 'That table still has something to pay, so it cannot be cleared yet.',
  TABLE_TAKEN: 'New guests are already at that table, so the old tab stays cleared.',
};
