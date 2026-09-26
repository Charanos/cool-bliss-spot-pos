import 'server-only';

import { DomainError } from '../_data/errors';

import type { Category, Product, ProductVariant } from '@bliss/shared/domain';
import type { Actor } from '@bliss/shared/reason';
import { bumpAvailabilityVersion, bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import { catalogueTables } from './schema';

export function version(): number {
  return catalogueTables().version;
}

export function categories(): Category[] {
  return [...catalogueTables().categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function products(): Product[] {
  return catalogueTables().products;
}

export function variants(): ProductVariant[] {
  return catalogueTables().variants;
}

let indexCache: { source: Product[]; size: number; products: Map<string, Product>; variants: Map<string, ProductVariant>; categories: Map<string, Category> } | null = null;

function index() {
  const t = catalogueTables();
  // Keyed on the table itself, so a regenerated dataset or an added variant never reads a stale map.
  if (!indexCache || indexCache.source !== t.products || indexCache.size !== t.products.length + t.variants.length + t.categories.length) {
    indexCache = {
      source: t.products,
      size: t.products.length + t.variants.length + t.categories.length,
      products: new Map(t.products.map((p) => [p.id, p])),
      variants: new Map(t.variants.map((v) => [v.id, v])),
      categories: new Map(t.categories.map((c) => [c.id, c])),
    };
  }
  return indexCache;
}

export const productById = (id: string) => index().products.get(id) ?? null;
export const variantById = (id: string) => index().variants.get(id) ?? null;
export const categoryById = (id: string) => index().categories.get(id) ?? null;

export function productOfVariant(variantId: string): Product | null {
  const variant = variantById(variantId);
  return variant ? productById(variant.productId) : null;
}

export function categoryOfVariant(variantId: string): Category | null {
  const product = productOfVariant(variantId);
  return product ? categoryById(product.categoryId) : null;
}

/**
 * The stock-keeping variant a sellable variant depletes, and by how much per serve. A serve depletes
 * its product's sealed variant by its depletion factor; a sealed variant depletes itself. Untracked
 * categories, such as kitchen plates, have no stock variant.
 */
export function stockVariantFor(variantId: string): { stockVariantId: string; factor: number } | null {
  const variant = variantById(variantId);
  if (!variant) return null;
  const category = categoryOfVariant(variantId);
  if (!category?.trackStock) return null;
  if (variant.kind === 'sealed') return { stockVariantId: variant.id, factor: 1 };
  const sealed = variants().find((v) => v.productId === variant.productId && v.kind === 'sealed');
  return sealed ? { stockVariantId: sealed.id, factor: variant.depletionFactor } : null;
}

/** Variants that hold stock: the rows a count, a receipt and the Stock view are about. */
export function stockVariants(): ProductVariant[] {
  return variants().filter((v) => v.kind === 'sealed' && categoryOfVariant(v.id)?.trackStock);
}

export function modifierGroupsFor(variantId: string) {
  const t = catalogueTables();
  return t.variantModifierGroups
    .filter((x) => x.productVariantId === variantId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((x) => {
      const group = t.modifierGroups.find((g) => g.id === x.modifierGroupId)!;
      return { group, modifiers: t.modifiers.filter((m) => m.modifierGroupId === group.id).sort((a, b) => a.sortOrder - b.sortOrder) };
    });
}

export function modifierGroups() {
  const t = catalogueTables();
  return t.modifierGroups.map((group) => ({
    group,
    modifiers: t.modifiers.filter((m) => m.modifierGroupId === group.id),
    variantCount: t.variantModifierGroups.filter((x) => x.modifierGroupId === group.id).length,
  }));
}

export function imageUrl(key: string | null, width = 320, height = 176): string | null {
  if (!key) return null;
  return `https://images.unsplash.com/photo-${key}?auto=format&fit=crop&w=${width}&h=${height}&q=70`;
}

/** The versioned snapshot a Floor device caches for offline trading. */
export function snapshot() {
  const t = catalogueTables();
  return {
    version: t.version,
    categories: t.categories,
    products: t.products,
    variants: t.variants,
    modifierGroups: t.modifierGroups,
    modifiers: t.modifiers,
    variantModifierGroups: t.variantModifierGroups,
  };
}

export interface StockSettingsInput {
  productId: string;
  lowStockThreshold: number | null;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  actor: Actor;
}

/**
 * N-04: the low stock threshold per product, so the floor warns at the right point, with the reorder
 * settings that drive suggestions. A threshold of null falls back to the outlet default.
 */
export function updateStockSettings(input: StockSettingsInput): Product {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing catalogue settings');
  const product = catalogueTables().products.find((p) => p.id === input.productId);
  if (!product) throw new DomainError('That product is not in the catalogue.');
  const whole = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0);
  if (!whole(input.lowStockThreshold) || !whole(input.reorderPoint) || !whole(input.reorderQty) || !whole(input.leadTimeDays)) {
    throw new DomainError('Use whole numbers of zero or more.');
  }
  if (input.reorderQty === 0) throw new DomainError('Reorder quantity needs to be at least one.');
  const before = { lowStockThreshold: product.lowStockThreshold, reorderPoint: product.reorderPoint, reorderQty: product.reorderQty, leadTimeDays: product.leadTimeDays };
  const after = { lowStockThreshold: input.lowStockThreshold, reorderPoint: input.reorderPoint, reorderQty: input.reorderQty, leadTimeDays: input.leadTimeDays };
  if (JSON.stringify(before) === JSON.stringify(after)) return product;
  Object.assign(product, after);
  bumpCatalogueVersion();
  // The threshold changes what the floor shows as low, so availability moves too.
  if (before.lowStockThreshold !== after.lowStockThreshold) bumpAvailabilityVersion();
  audit.record({ outletId: product.outletId, actorStaffId: input.actor.staffId, action: 'product.stock_settings', entityType: 'product', entityId: product.id, before, after, reason: null, severity: 'info' });
  return product;
}

export function modifierById(id: string) {
  return catalogueTables().modifiers.find((m) => m.id === id) ?? null;
}
