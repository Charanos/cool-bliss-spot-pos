import type { OrderLine, TenderKind } from '../domain';
import { type Cents, ZERO, add, allocate, compare, isNegative, multiplyByQty, roundToShilling, roundUpTo, shillings, subtract, sum } from '../money';

/**
 * Settlement arithmetic shared by the Counter and the server. docs/05 sections 1.5, 2.6 and 2.7,
 * docs/14 sections 6 and 7. The device computes to show; the server computes again to decide.
 */

/** A line can go on a bill when it was fired, is not voided, and is not on a bill already. */
export function billableLines<L extends Pick<OrderLine, 'id' | 'status'>>(lines: readonly L[], billedLineIds: ReadonlySet<string>): L[] {
  return lines.filter((l) => (l.status === 'pending' || l.status === 'served') && !billedLineIds.has(l.id));
}

export function linesTotal(lines: readonly Pick<OrderLine, 'lineTotalCents'>[]): Cents {
  return sum(lines.map((l) => l.lineTotalCents));
}

/** Rounded once, at tender, half up to the shilling. docs/01 R5. */
export function amountDue(subtotal: Cents): { due: Cents; rounding: Cents } {
  const { rounded, rounding } = roundToShilling(subtotal);
  return { due: rounded, rounding };
}

/** Even split: what is left, across seats, with the extra cents on the first shares. docs/05 2.7. */
export function evenShares(remaining: Cents, count: number): Cents[] {
  return allocate(remaining, count);
}

export interface TenderInput {
  kind: TenderKind;
  amountCents: Cents;
  tenderedCents: Cents | null;
}

export type TenderCheck = { ok: true; changeCents: Cents; still: Cents } | { ok: false; code: 'TENDER_SHORT' | 'TENDER_OVER' | 'CASH_SHORT'; message: string; still: Cents };

/** Tenders must meet the amount due exactly. Only cash can be handed over in excess, as change. */
export function checkTenders(due: Cents, tenders: readonly TenderInput[]): TenderCheck {
  const recorded = sum(tenders.map((t) => t.amountCents));
  const still = subtract(due, recorded);
  const order = compare(recorded, due);
  if (order < 0) return { ok: false, code: 'TENDER_SHORT', message: 'The tenders do not cover the amount due yet.', still };
  if (order > 0) return { ok: false, code: 'TENDER_OVER', message: 'The tenders come to more than the amount due. Record change on the cash tender instead.', still };
  let change = ZERO;
  for (const t of tenders) {
    if (t.kind !== 'cash' || t.tenderedCents === null) continue;
    const diff = subtract(t.tenderedCents, t.amountCents);
    if (isNegative(diff)) return { ok: false, code: 'CASH_SHORT', message: 'The cash handed over is less than the cash tender.', still };
    change = add(change, diff);
  }
  return { ok: true, changeCents: change, still };
}

/** Kenyan notes and coins, largest first, for counting a float or a drawer. */
export const DENOMINATIONS: readonly { key: string; label: string; value: Cents; kind: 'note' | 'coin' }[] = [
  { key: '1000', label: '1,000', value: shillings(1000), kind: 'note' },
  { key: '500', label: '500', value: shillings(500), kind: 'note' },
  { key: '200', label: '200', value: shillings(200), kind: 'note' },
  { key: '100', label: '100', value: shillings(100), kind: 'note' },
  { key: '50', label: '50', value: shillings(50), kind: 'note' },
  { key: '20', label: '20', value: shillings(20), kind: 'coin' },
  { key: '10', label: '10', value: shillings(10), kind: 'coin' },
  { key: '5', label: '5', value: shillings(5), kind: 'coin' },
  { key: '1', label: '1', value: shillings(1), kind: 'coin' },
];

export function countedTotal(counts: Readonly<Record<string, number>>): Cents {
  return sum(DENOMINATIONS.map((d) => multiplyByQty(d.value, Math.max(0, Math.floor(counts[d.key] ?? 0)))));
}

/** The notes a cashier is likely to be handed: exact, then up to the next 500, 1,000 and 2,000. */
export function quickCashAmounts(due: Cents): Cents[] {
  const out: Cents[] = [due];
  for (const step of [shillings(500), shillings(1000), shillings(2000)]) {
    const next = roundUpTo(due, step);
    if (!out.includes(next)) out.push(next);
  }
  return out.slice(0, 4);
}

/** Expected cash in a drawer. docs/14 section 7. Withheld from every response until the count is in. */
export function expectedCash(input: { float: Cents; cashTaken: readonly Cents[]; drops: readonly Cents[] }): Cents {
  return subtract(add(input.float, sum(input.cashTaken)), sum(input.drops));
}
