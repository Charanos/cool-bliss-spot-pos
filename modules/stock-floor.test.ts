import { describe, expect, it } from 'vitest';
import { ownerActor } from '../test/actors';
import * as catalogue from './catalogue/service';
import * as inventory from './inventory/service';
import * as inventoryManage from './inventory/manage';

/**
 * Stock never reads below zero. A sale is recorded in full, because it happened; what the record
 * lacked is brought from the store first, and anything still missing is put back as sold beyond the
 * record and flagged for a count.
 */
describe('stock never below zero', () => {
  const owner = ownerActor();
  const sealed = () => catalogue.stockVariants().find((v) => inventory.onHand(v.id) > 3 && catalogue.variantById(v.id)?.kind === 'sealed')!;
  const bar = () => inventory.locations().find((l) => l.isDefaultSale) ?? inventory.locations().find((l) => l.kind === 'service')!;

  it('selling more than there is leaves zero, never less, and flags a count', () => {
    const v = sealed();
    const total = inventory.onHand(v.id);
    inventory.recordSale({ lineId: 'floor-oversell', productVariantId: v.id, qty: Math.ceil(total) + 3, modifiers: [], actor: owner });
    for (const l of inventory.locations()) expect(inventory.onHand(v.id, l.id)).toBeGreaterThanOrEqual(0);
    expect(inventory.onHand(v.id)).toBe(0);
    expect(inventory.needsCount(v.id)).toBe(true);
  });

  it('takes from the store before calling anything missing', () => {
    const v = catalogue.stockVariants().find((x) => {
      const store = inventory.locations().find((l) => l.id !== bar().id && inventory.onHand(x.id, l.id) > 2);
      return store && inventory.onHand(x.id, bar().id) >= 0;
    })!;
    const before = inventory.onHand(v.id);
    const atBar = inventory.onHand(v.id, bar().id);
    inventory.recordSale({ lineId: 'floor-restock', productVariantId: v.id, qty: atBar + 1, modifiers: [], actor: owner });
    // One came from the store, so nothing was missing: the total simply fell by what was sold.
    expect(inventory.onHand(v.id)).toBeCloseTo(before - atBar - 1, 4);
    expect(inventory.onHand(v.id, bar().id)).toBe(0);
    expect(inventory.needsCount(v.id)).toBe(false);
  });

  it('brings balances already below zero back to zero', () => {
    const v = sealed();
    inventory.recordMovement({ variantId: v.id, locationId: bar().id, qtyDelta: -(inventory.onHand(v.id, bar().id) + 4), type: 'sale', sourceType: 'order_line', sourceId: 'old-oversell', reason: null, actor: owner });
    expect(inventory.onHand(v.id, bar().id)).toBeLessThan(0);
    expect(inventory.belowZeroCount()).toBeGreaterThan(0);
    inventory.coverNegatives(owner);
    expect(inventory.belowZeroCount()).toBe(0);
    expect(inventory.onHand(v.id, bar().id)).toBe(0);
  });

  it('sets every stock-kept drink to one figure for a trial run, and leaves shisha and food alone', () => {
    const moved = inventoryManage.setTrialStock({ qty: 10, reason: 'Trial run with the staff before handover', actor: owner });
    expect(moved).toBeGreaterThan(0);
    for (const v of catalogue.stockVariants()) {
      const product = catalogue.productById(v.productId)!;
      const category = catalogue.categoryById(product.categoryId)!;
      if (product.status !== 'active' || !category.trackStock || product.unitsInHouse) continue;
      expect(inventory.onHand(v.id)).toBe(10);
      expect(inventory.stockRecorded(v.id)).toBe(true);
    }
    expect(inventory.belowZeroCount()).toBe(0);
  });
});
