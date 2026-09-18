import 'server-only';

import { type AvailabilityResult, LAST_FEW_SERVES, evaluateAvailability, servesFromStock } from '@bliss/shared/availability';
import type { AvailabilityEntry } from '@bliss/shared/domain';
import { dataset } from '../_data/source';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';

/**
 * The availability module, ADR-008. "Can I sell this right now" is one question with one answer,
 * derived from stock on hand, holds, variant status and category status, in that order.
 *
 * Holds are placed on a stock variant, so a hold on Smirnoff 750ml stops the tot, the double, the
 * bottle and the Smirnoff and Coke recipe that uses it.
 */

const UNTRACKED_QTY = 999;

export function evaluate(variantId: string): AvailabilityResult & { threshold: number } {
  const variant = catalogue.variantById(variantId);
  const product = variant ? catalogue.productById(variant.productId) : null;
  const category = product ? catalogue.categoryById(product.categoryId) : null;
  const held = new Set(inventory.activeHolds().map((h) => h.productVariantId));
  const outletDefault = identity.outlet().lowStockDefault;

  if (!variant || !product || !category) {
    return { state: 'finished', reason: 'variant_status', qtyAvailable: 0, threshold: 0 };
  }

  const recipe = inventory.recipeFor(variantId);
  let qty = UNTRACKED_QTY;
  let threshold = outletDefault;
  let tracked = category.trackStock;
  let hasActiveHold = held.has(variantId);

  if (recipe) {
    tracked = true;
    qty = Math.min(
      ...recipe.components.map((c) => {
        if (held.has(c.componentVariantId)) hasActiveHold = true;
        return servesFromStock(inventory.onHand(c.componentVariantId), c.qty);
      }),
    );
    threshold = Math.max(LAST_FEW_SERVES + 1, outletDefault);
  } else if (tracked) {
    const stock = catalogue.stockVariantFor(variantId);
    if (stock) {
      if (held.has(stock.stockVariantId)) hasActiveHold = true;
      const units = inventory.onHand(stock.stockVariantId);
      qty = variant.kind === 'serve' ? servesFromStock(units, stock.factor) : Math.floor(units + 1e-9);
      const productThreshold = product.lowStockThreshold ?? outletDefault;
      threshold = variant.kind === 'serve' ? Math.round(productThreshold / stock.factor) : productThreshold;
    }
  }

  const result = evaluateAvailability({
    hasActiveHold,
    variantActive: variant.status === 'active',
    categoryActive: category.status === 'active',
    tracked,
    qtyAvailable: qty,
    threshold,
  });
  return { ...result, threshold };
}

/** The derived map for every sellable variant, with the version a device compares before pushing. */
export function map(): { version: number; computedAt: number; entries: AvailabilityEntry[] } {
  const computedAt = Date.now();
  const version = dataset().availabilityVersion;
  const entries = catalogue.variants().map((v) => {
    const r = evaluate(v.id);
    return { productVariantId: v.id, state: r.state, qtyAvailable: r.qtyAvailable, threshold: r.threshold, reason: r.reason, computedAt, version };
  });
  return { version, computedAt, entries };
}

export function counts() {
  const tally = { available: 0, low: 0, last_few: 0, finished: 0, on_hold: 0 };
  for (const e of map().entries) {
    if (e.state === 'finished' && e.reason === 'hold') tally.on_hold += 1;
    else tally[e.state] += 1;
  }
  return tally;
}
