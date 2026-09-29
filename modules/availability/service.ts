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

  // Something served and handed back, like a shisha pot: what can go out is what is not already out.
  if (product.unitsInHouse) {
    const free = Math.max(0, product.unitsInHouse - inUse(product.id));
    const result = evaluateAvailability({ hasActiveHold: held.has(variantId), variantActive: variant.status === 'active', categoryActive: category.status === 'active', tracked: true, qtyAvailable: free, threshold: 1 });
    return { ...result, threshold: 1 };
  }

  const recipe = inventory.recipeFor(variantId);
  let qty = UNTRACKED_QTY;
  let threshold = outletDefault;
  let tracked = category.trackStock;
  let hasActiveHold = held.has(variantId);
  let uncounted = false;

  if (recipe) {
    for (const c of recipe.components) if (held.has(c.componentVariantId)) hasActiveHold = true;
  }
  if (recipe && recipe.components.some((c) => isKept(c.componentVariantId))) {
    tracked = true;
    qty = Math.min(
      ...recipe.components.map((c) => {
        if (held.has(c.componentVariantId)) hasActiveHold = true;
        // A part kept in stock stops the drink when it runs out, and so does one never counted or
        // received: stock that was never recorded is not there to pour. Parts not kept in stock do not.
        if (!isKept(c.componentVariantId)) return UNTRACKED_QTY;
        if (!inventory.stockRecorded(c.componentVariantId)) {
          uncounted = true;
          return 0;
        }
        return servesFromStock(inventory.onHand(c.componentVariantId), c.qty);
      }),
    );
    threshold = Math.max(LAST_FEW_SERVES + 1, outletDefault);
  } else if (tracked) {
    const stock = catalogue.stockVariantFor(variantId);
    // Stock never received or counted is not on the shelf: it cannot be sold until a delivery or a
    // count records it. The Console lists it as not counted yet.
    if (stock && held.has(stock.stockVariantId)) hasActiveHold = true;
    if (stock && !inventory.stockRecorded(stock.stockVariantId)) {
      qty = 0;
      uncounted = true;
    }
    else if (stock) {
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
  // Finished because nothing was ever recorded, not because it ran out: say so, so the bar counts it.
  if (uncounted && result.state === 'finished' && result.reason === 'stock') return { ...result, reason: 'not_counted', threshold };
  return { ...result, threshold };
}

/** Whether a variant's stock is kept: its product is active in a category that tracks stock. */
function isKept(variantId: string): boolean {
  const product = catalogue.productOfVariant(variantId);
  return Boolean(product && catalogue.categoryById(product.categoryId)?.trackStock && !product.unitsInHouse);
}

/** Tabs still at their table: open, being settled or paid but not yet cleared. */
const AT_TABLE = new Set(['open', 'part_settled', 'settling', 'settled']);

/**
 * How many of a product are out on tables now: fired lines, not voided, on tabs not yet cleared. A
 * pot is back when its table is cleared, the moment the table is free for the next guests.
 */
export function inUse(productId: string): number {
  const d = dataset();
  const variants = new Set(catalogue.variants().filter((v) => v.productId === productId).map((v) => v.id));
  const live = new Set(d.tabs.filter((t) => AT_TABLE.has(t.status) && !t.clearedAt).map((t) => t.id));
  let n = 0;
  for (const l of d.lines) if (variants.has(l.productVariantId) && live.has(l.tabId) && (l.status === 'pending' || l.status === 'served')) n += l.qty;
  return n;
}

/** Whether anything on the menu is counted by what is out rather than by stock. */
export function hasUnitsInHouse(): boolean {
  return catalogue.products().some((p) => Boolean(p.unitsInHouse));
}

/**
 * Raised when the rules that derive the map change in code, not in the data: every device holds a
 * version it was given, so a new generation makes each fetch the map once more under the new rules.
 * 2: the handover's placeholder stock no longer finishes an item after one sale.
 * 3: stock never counted or received is not on the shelf, so it does not sell.
 */
const RULES_GENERATION = 3;

/** The derived map for every sellable variant, with the version a device compares before pushing. */
export function map(): { version: number; computedAt: number; entries: AvailabilityEntry[] } {
  const computedAt = Date.now();
  const version = RULES_GENERATION * 1_000_000_000 + dataset().availabilityVersion;
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
