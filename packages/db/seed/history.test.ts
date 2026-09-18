import { add, sum } from '@bliss/shared/money';
import { describe, expect, it } from 'vitest';
import { buildDataset } from './history';

/** Invariants from docs/05-flows-and-channels.md section 6, checked against the generated history. */
describe('generated history', () => {
  const started = performance.now();
  const data = buildDataset(Date.UTC(2026, 8, 16, 18, 30));
  const elapsed = performance.now() - started;

  it('generates quickly enough to serve a development Console', () => {
    expect(elapsed).toBeLessThan(8000);
    expect(data.lines.length).toBeGreaterThan(5000);
  });

  it('keeps every seat line on a seat of its own tab (invariant 2)', () => {
    const seatTab = new Map(data.seats.map((s) => [s.id, s.tabId]));
    for (const line of data.lines) {
      if (line.tabSeatId) expect(seatTab.get(line.tabSeatId)).toBe(line.tabId);
    }
  });

  it('settles every bill with tenders covering its rounded total (invariant 7)', () => {
    const byBill = new Map<string, bigint>();
    for (const t of data.tenders) byBill.set(t.billId, (byBill.get(t.billId) ?? 0n) + t.amountCents);
    for (const bill of data.bills) {
      const rounded = add(bill.totalCents, bill.roundingCents);
      expect((byBill.get(bill.id) ?? 0n) >= rounded).toBe(true);
    }
  });

  it('reconciles an even split exactly to the tab (ADR-009)', () => {
    const groups = new Map<string, typeof data.bills>();
    for (const b of data.bills) if (b.splitGroupId) groups.set(b.splitGroupId, [...(groups.get(b.splitGroupId) ?? []), b]);
    for (const [, bills] of groups) {
      const tabId = bills[0]!.tabId;
      const tabTotal = sum(data.lines.filter((l) => l.tabId === tabId && l.status !== 'voided').map((l) => l.lineTotalCents));
      expect(sum(bills.map((b) => b.totalCents))).toBe(tabTotal);
    }
  });

  it('gives every void a reason of at least ten characters and an actor (invariant 10)', () => {
    for (const line of data.lines.filter((l) => l.status === 'voided')) {
      expect(line.voidReason?.length ?? 0).toBeGreaterThanOrEqual(10);
      expect(line.voidedBy).toBeTruthy();
    }
    for (const hold of data.holds) expect(hold.reason.length).toBeGreaterThanOrEqual(10);
    for (const m of data.movements.filter((x) => x.movementType.startsWith('write_off') || x.movementType === 'count_adjustment')) {
      expect(m.reason?.length ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it('never leaves a stock unit below zero on the ledger at the bar', () => {
    const onHand = new Map<string, number>();
    for (const m of data.movements) {
      const k = `${m.productVariantId}|${m.stockLocationId}`;
      onHand.set(k, (onHand.get(k) ?? 0) + m.qtyDelta);
    }
    const negatives = [...onHand.values()].filter((q) => q < -0.5);
    expect(negatives.length).toBe(0);
  });
});
