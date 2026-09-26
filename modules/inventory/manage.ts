import 'server-only';

import type { StockLocation, StockLocationKind } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import type { Recipe } from '@bliss/db/seed/catalogue';
import { DomainError } from '../_data/errors';
import { bumpAvailabilityVersion, bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import { inventoryTables } from './schema';
import { onHand } from './service';

/**
 * Managing what stock is made of and where it is kept: recipes, pour specs and stock locations.
 * docs/19, plan C1 and C4. A recipe changes how a sale depletes stock from the next line fired;
 * lines already fired keep the depletion they recorded.
 */

const createId = createUuidV7();

function record(actor: Actor, action: string, entityType: string, entityId: string, before: object | null, after: object | null, reason: string | null = null) {
  audit.record({ outletId: identity.outlet().id, actorStaffId: actor.staffId, action, entityType, entityId, before, after, reason, severity: reason ? 'notable' : 'info' });
}

/* --------------------------------------------------------------------- recipes */

export interface RecipeComponentInput {
  componentVariantId: string;
  /** Stock units of the component per serve: 0.05 of a bottle, 1 can. */
  qty: number;
  volumeMl: number | null;
  wastagePct: number;
}

/**
 * Write the recipe for a sold item: which stocked items one serve takes, and how much of each.
 * One recipe per item; saving again replaces its components.
 */
export function saveRecipe(input: { variantId: string; name: string; components: readonly RecipeComponentInput[]; actor: Actor }): Recipe {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing recipes');
  const t = inventoryTables();
  const variant = catalogue.variantById(input.variantId);
  if (!variant || variant.status !== 'active') throw new DomainError('Choose an item that is on the menu.');
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) throw new DomainError('A recipe name is 2 to 60 characters.');
  if (input.components.length === 0) throw new DomainError('A recipe takes at least one stocked item.');
  if (input.components.length > 12) throw new DomainError('Keep a recipe to 12 items.');
  const seen = new Set<string>();
  const components = input.components.map((c) => {
    const component = catalogue.variantById(c.componentVariantId);
    const stock = component ? catalogue.stockVariantFor(component.id) : null;
    if (!component || !stock || stock.stockVariantId !== component.id) throw new DomainError('Each part of a recipe is a stocked item, such as a bottle or a can.');
    if (component.id === variant.id) throw new DomainError('A recipe cannot take the item it makes.');
    if (seen.has(component.id)) throw new DomainError(`${component.name} is in the recipe twice.`);
    seen.add(component.id);
    if (!Number.isFinite(c.qty) || c.qty <= 0 || c.qty > 50) throw new DomainError(`How much ${component.name} one serve takes is more than 0 and at most 50.`);
    if (!Number.isFinite(c.wastagePct) || c.wastagePct < 0 || c.wastagePct > 50) throw new DomainError('Wastage is from 0 to 50 per cent.');
    const volumeMl = c.volumeMl === null ? null : Math.round(c.volumeMl);
    if (volumeMl !== null && (volumeMl < 1 || volumeMl > 5000)) throw new DomainError('A measure in ml is from 1 to 5,000.');
    return { componentVariantId: component.id, qty: Math.round(c.qty * 10_000) / 10_000, volumeMl, wastagePct: c.wastagePct };
  });

  const existing = t.recipes.find((r) => r.productVariantId === variant.id);
  if (existing) {
    const before = { name: existing.name, components: existing.components, status: existing.status ?? 'active' };
    Object.assign(existing, { name, components, status: 'active' as const });
    bumpAvailabilityVersion();
    bumpCatalogueVersion();
    record(input.actor, 'recipe.updated', 'recipe', existing.id, before, { name, components });
    return existing;
  }
  const recipe: Recipe = { id: createId(), productVariantId: variant.id, name, components, status: 'active' };
  t.recipes.push(recipe);
  bumpAvailabilityVersion();
  bumpCatalogueVersion();
  record(input.actor, 'recipe.created', 'recipe', recipe.id, null, { name, item: variant.name, components });
  return recipe;
}

/** Remove a recipe: the item then depletes as a plain pour of its own product again. */
export function archiveRecipe(input: { id: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing recipes');
  const recipe = inventoryTables().recipes.find((r) => r.id === input.id);
  if (!recipe || recipe.status === 'archived') throw new DomainError('That recipe is no longer in use.');
  recipe.status = 'archived';
  bumpAvailabilityVersion();
  bumpCatalogueVersion();
  record(actor, 'recipe.archived', 'recipe', recipe.id, { status: 'active' }, { status: 'archived' }, reason);
}

/** The measure a serve pours, and how far a count may drift from it before it is called out. */
export function savePourSpec(input: { variantId: string; nominalVolumeMl: number; tolerancePct: number; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing pour specs');
  const variant = catalogue.variantById(input.variantId);
  if (!variant || variant.kind !== 'serve') throw new DomainError('A pour spec belongs to a serve, such as a tot.');
  if (!Number.isInteger(input.nominalVolumeMl) || input.nominalVolumeMl < 1 || input.nominalVolumeMl > 1000) throw new DomainError('A measure is a whole number of ml from 1 to 1,000.');
  if (!Number.isFinite(input.tolerancePct) || input.tolerancePct < 0 || input.tolerancePct > 25) throw new DomainError('Tolerance is from 0 to 25 per cent.');
  const t = inventoryTables();
  const existing = t.pourSpecs.find((p) => p.productVariantId === variant.id);
  const after = { nominalVolumeMl: input.nominalVolumeMl, tolerancePct: input.tolerancePct };
  if (existing) {
    const before = { nominalVolumeMl: existing.nominalVolumeMl, tolerancePct: existing.tolerancePct };
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    Object.assign(existing, after);
    record(input.actor, 'pour_spec.updated', 'product_variant', variant.id, before, after);
  } else {
    t.pourSpecs.push({ productVariantId: variant.id, ...after });
    record(input.actor, 'pour_spec.created', 'product_variant', variant.id, null, after);
  }
  bumpCatalogueVersion();
}

/* ------------------------------------------------------------------- locations */

const KINDS: readonly StockLocationKind[] = ['store', 'service', 'retail'];

/** Add a place stock is kept (the store room, the bar shelf), or rename one. */
export function saveLocation(input: { id?: string | null; name: string; kind: StockLocationKind; actor: Actor }): StockLocation {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'changing stock locations');
  const t = inventoryTables();
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) throw new DomainError('A location name is 2 to 40 characters.');
  if (!KINDS.includes(input.kind)) throw new DomainError('Choose a store room, a service point or retail.');
  const clash = t.locations.find((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== input.id && l.status === 'active');
  if (clash) throw new DomainError(`There is already a location called ${clash.name}.`);
  if (!input.id) {
    const location: StockLocation = { id: createId(), outletId: identity.outlet().id, name, kind: input.kind, isDefaultReceipt: false, isDefaultSale: false, status: 'active' };
    t.locations.push(location);
    record(input.actor, 'location.created', 'stock_location', location.id, null, { name, kind: location.kind });
    return location;
  }
  const location = t.locations.find((l) => l.id === input.id);
  if (!location) throw new DomainError('That location is no longer here.');
  const before = { name: location.name, kind: location.kind };
  if (before.name === name && before.kind === input.kind) return location;
  Object.assign(location, { name, kind: input.kind });
  record(input.actor, 'location.updated', 'stock_location', location.id, before, { name, kind: input.kind });
  return location;
}

/** Make a location where deliveries land, or where the floor sells from. One of each. */
export function setDefaultLocation(input: { id: string; use: 'receipt' | 'sale'; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'changing stock locations');
  const t = inventoryTables();
  const location = t.locations.find((l) => l.id === input.id && l.status === 'active');
  if (!location) throw new DomainError('Choose a location that is in use.');
  const key = input.use === 'receipt' ? 'isDefaultReceipt' : 'isDefaultSale';
  if (location[key]) return;
  const before = t.locations.find((l) => l[key]);
  for (const l of t.locations) if (l[key] && l.id !== location.id) l[key] = false;
  location[key] = true;
  bumpAvailabilityVersion();
  record(input.actor, input.use === 'receipt' ? 'location.default_receipt' : 'location.default_sale', 'stock_location', location.id, { location: before?.name ?? null }, { location: location.name });
}

/** Stop using a location. It must hold nothing, and it cannot be a default. */
export function setLocationStatus(input: { id: string; status: 'active' | 'archived'; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.count.commit', 'changing stock locations');
  const location = inventoryTables().locations.find((l) => l.id === input.id);
  if (!location) throw new DomainError('That location is no longer here.');
  if (location.status === input.status) return;
  if (input.status === 'archived') {
    if (location.isDefaultReceipt || location.isDefaultSale) throw new DomainError(`${location.name} is where ${location.isDefaultSale ? 'the floor sells from' : 'deliveries land'}. Choose another default first.`);
    const holding = catalogue.stockVariants().filter((v) => Math.abs(onHand(v.id, location.id)) > 1e-6);
    if (holding.length > 0) throw new DomainError(`${location.name} still holds ${holding.length} ${holding.length === 1 ? 'item' : 'items'}. Move or count them out first.`);
  }
  const before = { status: location.status };
  location.status = input.status;
  record(actor, input.status === 'archived' ? 'location.archived' : 'location.restored', 'stock_location', location.id, before, { status: location.status }, reason);
}
