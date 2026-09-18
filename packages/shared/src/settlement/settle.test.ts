import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canSignInOn, wrongSurfaceMessage } from '../identity/surfaces';
import { type Cents, cents, shillings, sum } from '../money';
import { placeLabel, tabLabel } from '../trade/places';
import { amountDue, billableLines, checkTenders, countedTotal, evenShares, expectedCash, quickCashAmounts } from './settle';

describe('places', () => {
  it('names tables and stools, and leaves anything else alone', () => {
    expect(placeLabel('T4')).toBe('Table 4');
    expect(placeLabel('S2')).toBe('Stool 2');
    expect(placeLabel('Garden')).toBe('Garden');
    expect(tabLabel({ tableLabel: 'T10' })).toBe('Table 10');
    expect(tabLabel({ name: 'Kevin birthday' })).toBe('Kevin birthday');
    expect(tabLabel({})).toBe('Walk up');
  });
});

describe('surfaces', () => {
  it('lets waiters on both, cashiers only at the counter, stock controllers on neither', () => {
    expect(canSignInOn('floor', 'waiter')).toBe(true);
    expect(canSignInOn('counter', 'waiter')).toBe(true);
    expect(canSignInOn('floor', 'cashier')).toBe(false);
    expect(canSignInOn('counter', 'cashier')).toBe(true);
    expect(canSignInOn('floor', 'manager')).toBe(false);
    expect(canSignInOn('counter', 'stock_controller')).toBe(false);
    expect(wrongSurfaceMessage('floor', 'cashier')).toContain('counter');
  });
});

describe('settlement', () => {
  it('bills only fired lines that are not voided and not on a bill already', () => {
    const lines = [
      { id: 'a', status: 'pending' as const },
      { id: 'b', status: 'served' as const },
      { id: 'c', status: 'voided' as const },
      { id: 'd', status: 'draft' as const },
      { id: 'e', status: 'served' as const },
    ];
    expect(billableLines(lines, new Set(['e'])).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('rounds the amount due once, half up to the shilling', () => {
    expect(amountDue(cents(70050))).toEqual({ due: 70100n, rounding: 50n });
    expect(amountDue(cents(70049))).toEqual({ due: 70000n, rounding: -49n });
  });

  it('splits what is left so the shares always add back to it (property)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 50_000_000n }), fc.integer({ min: 2, max: 12 }), (remaining, n) => {
        const shares = evenShares(cents(remaining), n);
        expect(sum(shares)).toBe(remaining);
      }),
    );
  });

  it('accepts tenders that meet the amount exactly and works out change on cash', () => {
    const due = shillings(4500);
    const ok = checkTenders(due, [
      { kind: 'cash', amountCents: shillings(2000), tenderedCents: shillings(2500) },
      { kind: 'mpesa', amountCents: shillings(2500), tenderedCents: null },
    ]);
    expect(ok).toMatchObject({ ok: true, changeCents: shillings(500) });
    expect(checkTenders(due, [{ kind: 'mpesa', amountCents: shillings(4000), tenderedCents: null }])).toMatchObject({ ok: false, code: 'TENDER_SHORT', still: shillings(500) });
    expect(checkTenders(due, [{ kind: 'card', amountCents: shillings(5000), tenderedCents: null }])).toMatchObject({ ok: false, code: 'TENDER_OVER' });
    expect(checkTenders(due, [{ kind: 'cash', amountCents: due, tenderedCents: shillings(4000) }])).toMatchObject({ ok: false, code: 'CASH_SHORT' });
  });

  it('counts a drawer by denomination', () => {
    expect(countedTotal({ '1000': 3, '500': 1, '50': 2, '1': 7 })).toBe(shillings(3607));
    expect(countedTotal({ '100': -2, '20': 1.5 })).toBe(shillings(20));
  });

  it('offers the notes a guest is likely to hand over', () => {
    expect(quickCashAmounts(shillings(1150))).toEqual([shillings(1150), shillings(1500), shillings(2000)]);
    expect(quickCashAmounts(shillings(2000))).toEqual([shillings(2000)]);
  });

  it('expects the float plus cash taken less drops', () => {
    const cash: Cents[] = [shillings(700), shillings(1500)];
    expect(expectedCash({ float: shillings(5000), cashTaken: cash, drops: [shillings(2000)] })).toBe(shillings(5200));
  });
});
