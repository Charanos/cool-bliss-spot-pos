import { ZERO, isPositive, scale, subtract, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import { describe, expect, it } from 'vitest';
import * as identity from '../identity/service';
import * as settlement from '../settlement/service';
import * as trade from '../trade/service';
import { performance } from './performance';
import * as reporting from './service';

/**
 * Reporting shows only what Bliss records. These hold the figures to each other: Performance, Sales
 * and the Overview agree, and a sale with no recorded cost never reads as pure margin.
 */

const range = () => {
  const to = reporting.clock().lastNight;
  const from = addDays(to, -6);
  return { from, to, previous: { from: addDays(from, -7), to: addDays(from, -1) } };
};

describe('performance', () => {
  it('settles to the same figure as the sales report, and rings up what the lines say', () => {
    const { from, to, previous } = range();
    const report = performance(from, to, previous);
    const summary = reporting.salesSummary(from, to, previous);
    expect(report.sales.settled).toBe(summary.netSales);
    expect(report.sales.bills).toBe(summary.bills);
    expect(report.sales.rungUp).toBe(sum(trade.linesBetween(from, to).map((l) => l.lineTotalCents)));
  });

  it('adds its categories up to the whole', () => {
    const { from, to, previous } = range();
    const report = performance(from, to, previous);
    expect(sum(report.categories.map((c) => c.sales))).toBe(report.sales.rungUp);
    expect(sum(report.categories.map((c) => c.cost))).toBe(report.margin.cost);
    expect(sum(report.categories.map((c) => c.uncosted))).toBe(report.margin.uncosted);
  });

  it('takes VAT out before margin, the same way the overview does', () => {
    const { from, to, previous } = range();
    const report = performance(from, to, previous);
    expect(report.margin.revenueExVat).toBe(reporting.exVat(report.sales.rungUp));
    expect(report.margin.grossProfit).toBe(subtract(report.margin.revenueExVat, report.margin.cost));
  });

  it('records the VAT inside each settled bill', () => {
    const outlet = identity.outlet();
    const bills = settlement.billsBetween(range().from, range().to).filter((b) => b.status === 'settled');
    expect(bills.length).toBeGreaterThan(0);
    for (const b of bills.slice(0, 50)) {
      expect(b.taxCents).toBe(outlet.pricesTaxInclusive ? scale(b.subtotalCents, BigInt(outlet.taxRateBps), BigInt(10_000 + outlet.taxRateBps)) : ZERO);
    }
  });

  it('names no invented figure: nothing about rent, wages or a fiscal queue', () => {
    const report = performance(range().from, range().to, range().previous) as unknown as Record<string, unknown>;
    const keys = JSON.stringify(Object.keys(report)) + JSON.stringify(Object.keys(report.sales as object));
    expect(keys).not.toMatch(/rent|wage|payroll|etims|kra|opex|ebitda/i);
  });
});

describe('uncosted sales', () => {
  it('have no margin rather than a margin of 100%', () => {
    const { from, to } = range();
    const food = reporting.salesByCategory(from, to).find((c) => c.name === 'Food');
    expect(food && isPositive(food.value)).toBe(true);
    expect(food?.marginBps).toBeNull();
    const movers = reporting.topMovers(from, to, 50);
    const costed = movers.filter((m) => m.marginBps !== null);
    expect(costed.length).toBeGreaterThan(0);
    for (const m of costed) expect(m.marginBps).toBeLessThan(10_000);
  });
});
