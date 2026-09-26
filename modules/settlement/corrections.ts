import 'server-only';

import type { Tender } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, add, compare, formatKes, isPositive, negate, subtract, sum } from '@bliss/shared/money';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { holdsTable } from '@bliss/shared/trade';
import { touch } from '../_data/changes';
import { DomainError } from '../_data/errors';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as tradeCommands from '../trade/commands';
import * as trade from '../trade/service';
import { settlementTables } from './schema';
import { billLines, openDrawerFor, refundedLineIds } from './service';

/**
 * Putting a settled bill right, from the Console. docs/19, plan C3. Two different things:
 *
 *  void     the bill was settled wrongly (the wrong tender, the wrong split, the wrong tab). It is
 *           set aside and its lines go back on the tab to be settled again. Stock does not move,
 *           because the drinks were still poured. The cash it took leaves the drawer's expected
 *           figure, so this is only possible while that drawer is still open.
 *  refund   the guest is given money back for lines they paid for. The bill stays, with a negative
 *           tender against it; a cash refund is paid out of a drawer that is open now. Returned
 *           stock goes back on the shelf only when it can be sold again.
 *
 * Both need `refund.approve`, a reason, and are recorded as sensitive in the audit trail.
 */

const createId = createUuidV7();

const COLLECTED = new Set(['settled', 'partially_refunded']);

function billOrThrow(billId: string) {
  const bill = settlementTables().bills.find((b) => b.id === billId);
  if (!bill) throw new DomainError('That bill does not exist.');
  return bill;
}

/** Set a wrongly settled bill aside: its lines go back on the tab, open again, to be settled right. */
export function voidBill(input: { billId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'refund.approve', 'voiding bills');
  const t = settlementTables();
  const bill = billOrThrow(input.billId);
  if (bill.status === 'voided') return;
  if (bill.status !== 'settled') throw new DomainError(`Bill ${bill.billNumber} has had money given back. Refund the rest instead of voiding it.`);
  if (bill.scope === 'even_split') throw new DomainError(`Bill ${bill.billNumber} is one share of an even split. Refund it instead.`);

  // Cash it took must still be in a drawer nobody has counted, or the count would be wrong.
  const tenders = t.tenders.filter((x) => x.billId === bill.id);
  const tookCash = tenders.some((x) => x.kind === 'cash' && isPositive(x.amountCents));
  const drawer = openDrawerFor(bill.deviceId);
  if (tookCash && (!drawer || drawer.status !== 'open' || drawer.openedAt > (bill.settledAt ?? 0))) {
    throw new DomainError(`The drawer that took the cash for bill ${bill.billNumber} has been counted. Refund the bill instead.`);
  }

  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  if (tab && tab.serviceTableId && tab.status === 'settled' && !holdsTable(tab)) throw new DomainError(`The table for bill ${bill.billNumber} has been cleared since. Refund the bill instead.`);

  bill.status = 'voided';
  bill.voidedAt = Date.now();
  bill.voidedBy = actor.staffId;
  bill.voidReason = reason;
  touch('bills', bill.id);

  if (tab) {
    tradeCommands.reopenAfterBillVoid(tab.id, bill.id);
  } else {
    // A quick sale has no tab to go back to: the sale did not happen, so its stock returns.
    for (const line of billLines(bill.id)) inventory.reverseSale({ lineId: line.id, actor });
  }

  audit.record({
    outletId: bill.outletId,
    actorStaffId: actor.staffId,
    action: 'bill.voided',
    entityType: 'bill',
    entityId: bill.id,
    before: { status: 'settled', totalCents: bill.totalCents.toString() },
    after: { status: 'voided', tabReopened: Boolean(tab), approverId: actor.staffId },
    reason,
    severity: 'sensitive',
  });
}

export type RefundMethod = 'cash' | 'mpesa' | 'card';

export interface RefundInput {
  billId: string;
  /** Bill lines given back. Each can be refunded once. */
  billLineIds: readonly string[];
  method: RefundMethod;
  /** For cash: the open drawer session the money comes out of. */
  drawerSessionId: string | null;
  /** For M-Pesa or card: the reversal's reference. */
  reference: string | null;
  /** Put the items back in stock: only when they can be sold again, such as a sealed bottle. */
  restock: boolean;
  reason: string;
  requestId?: string | null;
  actor: Actor;
}

/** Give a guest money back for lines on a settled bill. Returns what was refunded. */
export function refundBill(input: RefundInput): { refundedCents: Cents } {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'refund.approve', 'refunding bills');
  const t = settlementTables();
  const bill = billOrThrow(input.billId);

  if (input.requestId) {
    const again = t.tenders.find((x) => x.id === input.requestId);
    if (again) return { refundedCents: negate(again.amountCents) };
  }
  if (!COLLECTED.has(bill.status)) throw new DomainError(bill.status === 'refunded' ? `Bill ${bill.billNumber} has been refunded in full.` : `Bill ${bill.billNumber} is ${bill.status}, so there is nothing to refund.`);

  const lines = billLines(bill.id);
  const already = refundedLineIds(bill.id);
  const chosen = [...new Set(input.billLineIds)].map((id) => lines.find((l) => l.id === id));
  if (chosen.length === 0) throw new DomainError('Choose at least one line to refund.');
  for (const line of chosen) {
    if (!line) throw new DomainError('One of the lines chosen is not on this bill.');
    if (already.has(line.id)) throw new DomainError(`${line.description} was refunded already.`);
  }
  const picked = chosen as NonNullable<(typeof chosen)[number]>[];

  // An even split share holds no lines: its whole share is what can be given back.
  const amount = picked.length > 0 ? sum(picked.map((l) => l.lineTotalCents)) : ZERO;
  const left = subtract(bill.totalCents, bill.refundedCents ?? ZERO);
  if (!isPositive(amount)) throw new DomainError('Those lines came to nothing, so there is nothing to give back.');
  if (compare(amount, left) > 0) throw new DomainError(`Only ${formatKes(left)} of bill ${bill.billNumber} is left to refund.`);

  const reference = input.reference?.trim() || null;
  let deviceId = 'console';
  if (input.method === 'cash') {
    const session = t.drawerSessions.find((s) => s.id === input.drawerSessionId);
    if (!session || session.status !== 'open') throw new DomainError('Choose a drawer that is open now, to pay the cash from.');
    deviceId = session.deviceId;
    t.cashMovements.push({ id: createId(), drawerSessionId: session.id, kind: 'payout', amountCents: amount, reason: `Refund on bill ${bill.billNumber}: ${reason}`, createdBy: actor.staffId, deviceId, occurredAt: Date.now() });
    touch('drawerSessions', session.id);
  } else if (!reference || reference.length < 4) {
    throw new DomainError(input.method === 'mpesa' ? 'Enter the M-Pesa reversal code.' : 'Enter the card reversal reference.');
  }

  const tender: Tender = {
    id: input.requestId || createId(),
    billId: bill.id,
    kind: input.method,
    amountCents: negate(amount),
    tenderedCents: null,
    changeCents: null,
    reference,
    createdBy: actor.staffId,
    deviceId,
    createdAt: Date.now(),
    refundOfLineIds: picked.map((l) => l.id),
  };
  t.tenders.push(tender);
  const statusBefore = bill.status;
  const refundedBefore = bill.refundedCents ?? ZERO;
  bill.refundedCents = add(bill.refundedCents ?? ZERO, amount);
  bill.status = compare(bill.refundedCents, bill.totalCents) >= 0 ? 'refunded' : 'partially_refunded';
  touch('bills', bill.id);
  touch('tenders', tender.id);

  if (input.restock) for (const line of picked) inventory.reverseSale({ lineId: line.orderLineId ?? line.id, actor });

  audit.record({
    outletId: bill.outletId,
    actorStaffId: actor.staffId,
    action: 'bill.refunded',
    entityType: 'bill',
    entityId: bill.id,
    before: { status: statusBefore, refundedCents: refundedBefore.toString() },
    after: { status: bill.status, refundCents: amount.toString(), method: input.method, lines: picked.map((l) => l.description), restocked: input.restock, approverId: actor.staffId },
    reason,
    severity: 'sensitive',
  });
  return { refundedCents: amount };
}

/** Drawers open right now that a cash refund can be paid from. */
export function openDrawers() {
  return settlementTables().drawerSessions.filter((s) => s.status === 'open');
}

/** A manager's note on a closed drawer's variance: seen, and what was done about it. */
export function acknowledgeDrawer(input: { sessionId: string; note: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned({ reason: input.note, actor: input.actor });
  identity.assertCan(actor.staffId, 'drawer.close', 'reviewing drawers');
  const session = settlementTables().drawerSessions.find((s) => s.id === input.sessionId);
  if (!session) throw new DomainError('That drawer session does not exist.');
  if (session.status !== 'closed') throw new DomainError('A drawer is reviewed once it has been counted and closed.');
  if (session.reviewedAt) throw new DomainError('That drawer has been reviewed already.');
  session.reviewedBy = actor.staffId;
  session.reviewedAt = Date.now();
  session.reviewNote = reason;
  touch('drawerSessions', session.id);
  audit.record({ outletId: session.outletId, actorStaffId: actor.staffId, action: 'drawer.reviewed', entityType: 'drawer_session', entityId: session.id, before: null, after: { varianceCents: session.varianceCents?.toString() ?? null }, reason, severity: 'notable' });
}
