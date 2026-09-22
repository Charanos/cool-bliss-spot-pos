import { z } from 'zod';

/**
 * Outbox payloads, versioned and validated on both sides. docs/02-system-architecture.md section 6.
 *
 * Money travels as a string of integer cents. Ids are client generated UUIDv7 and double as the
 * idempotency key. A payload shape change bumps its version rather than mutating in place.
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'UUIDv7');
const id = z.string().min(1);
const centsString = z.string().regex(/^-?\d+$/, 'integer cents as a string');
const reason = z.string().trim().min(10, 'Reason needs at least 10 characters.');

export const derivationStep = z.object({ label: z.string(), input: z.string(), op: z.string(), output: z.string() });

export const tabOpenPayload = z.object({
  v: z.literal(1),
  tabId: uuid,
  serviceTableId: id.nullable(),
  zoneId: id,
  name: z.string().max(40).nullable(),
  guestCount: z.number().int().min(1).max(40),
  seats: z.array(z.object({ seatId: uuid, seatNo: z.number().int().min(1) })).min(1),
  openedAt: z.number().int(),
});

export const seatAddPayload = z.object({ v: z.literal(1), tabId: id, seatId: uuid, seatNo: z.number().int().min(1) });
export const seatLabelPayload = z.object({ v: z.literal(1), tabId: id, seatId: id, label: z.string().max(24).nullable() });
export const seatRemovePayload = z.object({ v: z.literal(1), tabId: id, seatId: id });

export const firedLine = z.object({
  lineId: uuid,
  tabSeatId: id.nullable(),
  productVariantId: id,
  qty: z.number().int().min(1),
  unitPriceCents: centsString,
  lineTotalCents: centsString,
  priceDerivation: z.array(derivationStep),
  note: z.string().max(140).nullable(),
  modifiers: z.array(
    z.object({ modifierId: id, qty: z.number().int().min(1), priceDeltaCents: centsString, linkedVariantId: id.nullable() }),
  ),
  clientCreatedAt: z.number().int(),
});

export const orderFirePayload = z.object({
  v: z.literal(1),
  orderId: uuid,
  tabId: id,
  firedAt: z.number().int(),
  catalogueVersion: z.number().int(),
  availabilityVersion: z.number().int(),
  lines: z.array(firedLine).min(1),
});

export const lineMovePayload = z.object({ v: z.literal(1), lineId: id, tabId: id, fromSeatId: id.nullable(), toSeatId: id.nullable() });
export const lineNotePayload = z.object({ v: z.literal(1), lineId: id, note: z.string().max(140).nullable() });
export const lineVoidPayload = z.object({
  v: z.literal(1),
  lineId: id,
  reason,
  /** Present when the line was already poured and a supervisor approved in the dialog. */
  approvalToken: z.string().nullable(),
});
export const tabMovePayload = z.object({ v: z.literal(1), tabId: id, fromTableId: id.nullable(), toTableId: id });
export const tabHandoverPayload = z.object({ v: z.literal(1), tabIds: z.array(id).min(1), toStaffId: id });

/**
 * The guests have left. docs/16 section 8. A settled tab lets go of its table; an open tab with
 * nothing on it closes, with a reason; `undo` puts a cleared tab back on its table if nobody has
 * sat down there since.
 */
export const tabClearPayload = z.object({
  v: z.literal(1),
  tabId: id,
  at: z.number().int(),
  undo: z.boolean().default(false),
  reason: reason.nullable().default(null),
});

/** The guests want to pay: the Counter sees the tab first. `undo` takes the ask back. */
export const tabBillPayload = z.object({ v: z.literal(1), tabId: id, at: z.number().int(), undo: z.boolean().default(false) });

/** The waiter set the round down at the table. `undo` takes the mark back. */
export const orderDeliverPayload = z.object({ v: z.literal(1), orderId: id, tabId: id, at: z.number().int(), undo: z.boolean().default(false) });

/* ------------------------------------------------------------- the Counter, docs/14 */

/** The counter pours lines. Idempotent: a line already poured stays as it was. */
export const lineServePayload = z.object({ v: z.literal(1), tabId: id, lineIds: z.array(id).min(1), servedAt: z.number().int() });

export const tenderKind = z.enum(['cash', 'mpesa', 'card', 'account', 'comp']);

export const tenderPayload = z.object({
  tenderId: uuid,
  kind: tenderKind,
  amountCents: centsString,
  /** Cash only: what the guest handed over. */
  tenderedCents: centsString.nullable(),
  changeCents: centsString.nullable(),
  /** Typed by the cashier. Bliss records it and does not check it. */
  reference: z.string().trim().max(64).nullable(),
});

export const billSettlePayload = z.object({
  v: z.literal(1),
  billId: uuid,
  scope: z.enum(['tab', 'seat', 'even_split', 'quick_sale']),
  tabId: id.nullable(),
  tabSeatId: id.nullable(),
  /** Order lines this bill takes. Empty for a quick sale and for every even split share after the first. */
  lineIds: z.array(id),
  /** Quick sale only: sealed variants sold without a tab, priced by the device, repriced by the server. */
  items: z.array(z.object({ productVariantId: id, qty: z.number().int().min(1).max(99), unitPriceCents: centsString })),
  split: z.object({ groupId: uuid, index: z.number().int().min(0), count: z.number().int().min(2).max(40) }).nullable(),
  subtotalCents: centsString,
  roundingCents: centsString,
  dueCents: centsString,
  tenders: z.array(tenderPayload).min(1).max(8),
  drawerSessionId: id.nullable(),
  settledAt: z.number().int(),
});

export const drawerOpenPayload = z.object({ v: z.literal(1), sessionId: uuid, floatCents: centsString, openedAt: z.number().int() });

export const drawerDropPayload = z.object({ v: z.literal(1), movementId: uuid, sessionId: id, amountCents: centsString, reason, at: z.number().int() });

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
export type OutboxPayload<K extends OutboxKind> = z.infer<(typeof outboxPayloads)[K]>;

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
