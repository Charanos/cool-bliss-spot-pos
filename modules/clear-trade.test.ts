import { buildDataset } from '@bliss/db/seed/history';
import { describe, expect, it } from 'vitest';
import { TRADE_COLLECTIONS, applyClearTrade, isTradeMovement, planClearTrade } from './_data/clear-trade';

/**
 * Clearing trade after a trial run: every tab, bill, shift and drawer goes, the stock the sales took
 * goes back, and the outlet as set up stays exactly as it was.
 */
describe('clearing trade', () => {
  it('takes the trade, puts the stock back, and keeps the outlet', () => {
    const data = buildDataset(Date.now(), 7);
    expect(data.tabs.length).toBeGreaterThan(0);
    const kept = { staff: data.staff.length, tables: data.tables.length, zones: data.zones.length, products: data.products.length, devices: data.devices.length, priceListItems: data.priceListItems.length, counts: data.counts.length };
    const onHand = (variantId: string) => data.movements.filter((m) => m.productVariantId === variantId).reduce((n, m) => n + m.qtyDelta, 0);
    const sold = data.movements.find((m) => m.movementType === 'sale')!.productVariantId;
    const withoutSales = data.movements.filter((m) => m.productVariantId === sold && !isTradeMovement(m)).reduce((n, m) => n + m.qtyDelta, 0);
    const epoch = data.epoch;

    const plan = planClearTrade(data);
    applyClearTrade(data, plan, 'cleared:test');

    for (const c of TRADE_COLLECTIONS) expect((data as unknown as Record<string, unknown[]>)[c]).toHaveLength(0);
    expect(data.movements.some(isTradeMovement)).toBe(false);
    expect(onHand(sold)).toBeCloseTo(withoutSales, 4);
    for (const b of data.stockBatches) {
      expect(b.remainingQty).toBeGreaterThanOrEqual(0);
      expect(b.remainingQty).toBeLessThanOrEqual(b.initialQty);
    }
    expect({ staff: data.staff.length, tables: data.tables.length, zones: data.zones.length, products: data.products.length, devices: data.devices.length, priceListItems: data.priceListItems.length, counts: data.counts.length }).toEqual(kept);
    expect(data.epoch).not.toBe(epoch);
    expect(plan.summary.tabs).toBeGreaterThan(0);
  });
});
