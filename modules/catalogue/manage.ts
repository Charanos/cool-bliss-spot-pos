import 'server-only';

import type { CatalogueStatus, Category, CategoryColourToken, Modifier, ModifierGroup, Product, ProductVariant, RoutingTarget, VariantKind } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, isNegative } from '@bliss/shared/money';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { DomainError } from '../_data/errors';
import { bumpAvailabilityVersion, bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import { catalogueTables } from './schema';

/**
 * Managing the menu: categories, products, the ways each is sold, and modifiers. docs/19, plan C1.
 *
 * Every command checks `price.write` (the menu permission), validates in words a manager reads,
 * writes in place so the store records exactly the rows it touched, bumps the catalogue version so
 * every tablet pulls the change, and leaves an audit entry with before and after. Nothing that a
 * past bill refers to is ever deleted: it is archived, and the floor stops offering it.
 */

const createId = createUuidV7();

const COLOURS: readonly CategoryColourToken[] = ['glacier', 'ember', 'leaf', 'iris', 'rose', 'steel', 'brass', 'jade'];
const ROUTES: readonly RoutingTarget[] = ['bar', 'kitchen', 'none'];

function name(value: string, what: string, max = 60): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) throw new DomainError(`${what} needs at least two characters.`);
  if (clean.length > max) throw new DomainError(`${what} is at most ${max} characters.`);
  return clean;
}

function optional(value: string | null | undefined, max: number, what: string): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!clean) return null;
  if (clean.length > max) throw new DomainError(`${what} is at most ${max} characters.`);
  return clean;
}

function whole(value: number | null, what: string, { min = 0, max = 100_000 } = {}): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) throw new DomainError(`${what} needs to be a whole number from ${min} to ${max.toLocaleString('en-KE')}.`);
  return value;
}

function outletId(): string {
  return identity.outlet().id;
}

function changed(before: object, after: object): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function record(actor: Actor, action: string, entityType: string, entityId: string, before: object | null, after: object | null, reason: string | null = null, severity: 'info' | 'notable' = 'info') {
  audit.record({ outletId: outletId(), actorStaffId: actor.staffId, action, entityType, entityId, before, after, reason, severity });
}

function menuChanged({ availability = false } = {}) {
  bumpCatalogueVersion();
  if (availability) bumpAvailabilityVersion();
}

/* ------------------------------------------------------------------ categories */

export interface CategoryInput {
  id?: string | null;
  name: string;
  colourToken: CategoryColourToken;
  routingTarget: RoutingTarget;
  trackStock: boolean;
  actor: Actor;
}

/** Add a category, or change one. A new category goes to the end of the floor's tabs. */
export function saveCategory(input: CategoryInput): Category {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const clean = name(input.name, 'A category name', 40);
  if (!COLOURS.includes(input.colourToken)) throw new DomainError('Choose one of the eight category colours.');
  if (!ROUTES.includes(input.routingTarget)) throw new DomainError('Choose where orders in this category print: the bar, the kitchen, or nowhere.');
  const clash = t.categories.find((c) => c.name.toLowerCase() === clean.toLowerCase() && c.id !== input.id && c.status === 'active');
  if (clash) throw new DomainError(`There is already a category called ${clash.name}.`);

  if (!input.id) {
    const category: Category = {
      id: createId(),
      outletId: outletId(),
      parentId: null,
      name: clean,
      sortOrder: Math.max(0, ...t.categories.map((c) => c.sortOrder)) + 1,
      routingTarget: input.routingTarget,
      colourToken: input.colourToken,
      trackStock: input.trackStock,
      status: 'active',
    };
    t.categories.push(category);
    menuChanged();
    record(input.actor, 'category.created', 'category', category.id, null, { name: category.name, colour: category.colourToken, routing: category.routingTarget, trackStock: category.trackStock });
    return category;
  }

  const category = t.categories.find((c) => c.id === input.id);
  if (!category) throw new DomainError('That category is no longer in the catalogue.');
  const before = { name: category.name, colour: category.colourToken, routing: category.routingTarget, trackStock: category.trackStock };
  const after = { name: clean, colour: input.colourToken, routing: input.routingTarget, trackStock: input.trackStock };
  if (!changed(before, after)) return category;
  Object.assign(category, { name: clean, colourToken: input.colourToken, routingTarget: input.routingTarget, trackStock: input.trackStock });
  menuChanged({ availability: before.trackStock !== after.trackStock });
  record(input.actor, 'category.updated', 'category', category.id, before, after);
  return category;
}

/** Move a category one place earlier or later on the floor's tabs. */
export function moveCategory(input: { id: string; direction: 'up' | 'down'; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const ordered = catalogueTables()
    .categories.filter((c) => c.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const at = ordered.findIndex((c) => c.id === input.id);
  if (at < 0) throw new DomainError('That category is no longer on the menu.');
  const to = input.direction === 'up' ? at - 1 : at + 1;
  if (to < 0 || to >= ordered.length) return;
  const a = ordered[at]!;
  const b = ordered[to]!;
  const [sa, sb] = [a.sortOrder, b.sortOrder];
  a.sortOrder = sb === sa ? sa + (input.direction === 'up' ? -1 : 1) : sb;
  b.sortOrder = sa;
  menuChanged();
  record(input.actor, 'category.moved', 'category', a.id, { position: at + 1 }, { position: to + 1 });
}

/** Take a category off the menu, or bring it back. It must be empty of products on sale first. */
export function setCategoryStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const category = t.categories.find((c) => c.id === input.id);
  if (!category) throw new DomainError('That category is no longer in the catalogue.');
  if (category.status === input.status) return;
  if (input.status === 'archived') {
    const onSale = t.products.filter((p) => p.categoryId === category.id && p.status === 'active').length;
    if (onSale > 0) throw new DomainError(`${category.name} still has ${onSale} ${onSale === 1 ? 'product' : 'products'} on sale. Move or archive them first.`);
  }
  const before = { status: category.status };
  category.status = input.status;
  menuChanged({ availability: true });
  record(actor, input.status === 'archived' ? 'category.archived' : 'category.restored', 'category', category.id, before, { status: category.status }, reason, 'notable');
}

/* -------------------------------------------------------------------- products */

export interface ProductInput {
  id?: string | null;
  categoryId: string;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  containerVolumeMl: number | null;
  abv: number | null;
  defaultSupplierId: string | null;
  imageKey: string | null;
  actor: Actor;
}

export interface NewProductInput extends ProductInput {
  /** The first way it is sold: a sealed bottle or can, or a serve poured from one. */
  firstVariant: { name: string; kind: VariantKind; serveVolumeMl: number | null; depletionFactor: number };
  /** Its price on the base list, so it can be sold the moment it is added. */
  basePriceCents: Cents;
  requestId?: string | null;
}

function productFields(input: ProductInput, t: ReturnType<typeof catalogueTables>, suppliers: readonly { id: string; status: string }[]) {
  const category = t.categories.find((c) => c.id === input.categoryId && c.status === 'active');
  if (!category) throw new DomainError('Choose a category that is on the menu.');
  const sku = input.sku.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(sku)) throw new DomainError('A SKU is 2 to 32 letters, numbers and dashes, such as SPR-GLB-750.');
  const skuClash = t.products.find((p) => p.sku === sku && p.id !== input.id);
  if (skuClash) throw new DomainError(`${skuClash.name} already uses the SKU ${sku}.`);
  const barcode = optional(input.barcode, 32, 'A barcode');
  if (barcode && !/^[0-9]{6,32}$/.test(barcode)) throw new DomainError('A barcode is digits only.');
  if (input.defaultSupplierId && !suppliers.some((s) => s.id === input.defaultSupplierId && s.status === 'active')) throw new DomainError('Choose a supplier that is still active.');
  const imageKey = optional(input.imageKey, 200, 'The photograph');
  // A photo is one this server's uploader issued, or a catalogue asset key: never an address typed in.
  if (imageKey && !/^\/api\/uploads\/[A-Za-z0-9_-]{8,64}\.(jpg|png|webp)$/.test(imageKey) && !/^\d{10,}-[0-9a-f]{12}$/.test(imageKey)) throw new DomainError('Upload the photograph again.');
  const abv = input.abv === null ? null : Number(input.abv);
  if (abv !== null && (!Number.isFinite(abv) || abv < 0 || abv > 96)) throw new DomainError('Alcohol by volume is between 0 and 96 per cent.');
  return {
    categoryId: category.id,
    name: name(input.name, 'A product name', 60),
    brand: optional(input.brand, 40, 'A brand'),
    sku,
    barcode,
    containerVolumeMl: whole(input.containerVolumeMl, 'The bottle size in ml', { min: 1, max: 20_000 }),
    abv,
    defaultSupplierId: input.defaultSupplierId || null,
    imageKey,
  };
}

function variantFields(input: { name: string; kind: VariantKind; serveVolumeMl: number | null; depletionFactor: number }, containerMl: number | null) {
  if (input.kind !== 'sealed' && input.kind !== 'serve') throw new DomainError('Choose whether it is sold sealed or by the serve.');
  const serveVolumeMl = input.kind === 'serve' ? whole(input.serveVolumeMl, 'The serve in ml', { min: 1, max: 5_000 }) : null;
  let depletionFactor = input.kind === 'sealed' ? 1 : Number(input.depletionFactor);
  // A serve from a known bottle: the share of the bottle is the serve over the bottle.
  if (input.kind === 'serve' && serveVolumeMl && containerMl && (!depletionFactor || depletionFactor <= 0)) depletionFactor = serveVolumeMl / containerMl;
  if (!Number.isFinite(depletionFactor) || depletionFactor <= 0 || depletionFactor > 1) throw new DomainError('How much of a bottle a serve takes is more than 0 and at most 1.');
  return { name: name(input.name, 'The name of how it is sold', 40), kind: input.kind, serveVolumeMl, depletionFactor: Math.round(depletionFactor * 10_000) / 10_000 };
}

/**
 * Add a product with the first way it is sold and its base price, so the floor can sell it at the
 * next sync. `onPrice` writes the base price through Pricing, which owns price history.
 */
export function createProduct(input: NewProductInput, suppliers: readonly { id: string; status: string }[], onPrice: (variantId: string) => void): Product {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  if (input.requestId) {
    const again = t.products.find((p) => (p as Product & { requestId?: string }).requestId === input.requestId);
    if (again) return again;
  }
  if (isNegative(input.basePriceCents)) throw new DomainError('A price cannot be below zero.');
  const fields = productFields(input, t, suppliers);
  const variant = variantFields(input.firstVariant, fields.containerVolumeMl);
  const outlet = identity.outlet();
  const product: Product & { requestId?: string | null } = {
    id: createId(),
    outletId: outlet.id,
    ...fields,
    isSoldSealed: variant.kind === 'sealed',
    isSoldByServe: variant.kind === 'serve',
    lowStockThreshold: null,
    reorderPoint: 0,
    reorderQty: 1,
    leadTimeDays: 2,
    status: 'active',
    requestId: input.requestId ?? null,
  };
  t.products.push(product);
  const first: ProductVariant = { id: createId(), outletId: outlet.id, productId: product.id, ...variant, barcode: null, isDefault: true, sortOrder: 1, status: 'active' };
  t.variants.push(first);
  onPrice(first.id);
  menuChanged({ availability: true });
  record(input.actor, 'product.created', 'product', product.id, null, { name: product.name, sku: product.sku, category: product.categoryId, soldAs: first.name }, null, 'notable');
  return product;
}

/** Change a product's name, category, codes, bottle, supplier or photograph. */
export function updateProduct(input: ProductInput & { id: string }, suppliers: readonly { id: string; status: string }[]): Product {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const product = t.products.find((p) => p.id === input.id);
  if (!product) throw new DomainError('That product is no longer in the catalogue.');
  const fields = productFields(input, t, suppliers);
  const before = { categoryId: product.categoryId, name: product.name, brand: product.brand, sku: product.sku, barcode: product.barcode, containerVolumeMl: product.containerVolumeMl, abv: product.abv, defaultSupplierId: product.defaultSupplierId, imageKey: product.imageKey };
  if (!changed(before, fields)) return product;
  Object.assign(product, fields);
  menuChanged({ availability: before.categoryId !== fields.categoryId });
  record(input.actor, 'product.updated', 'product', product.id, before, fields);
  return product;
}

/** Take a product off sale everywhere, or bring it back. History keeps it. */
export function setProductStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const product = t.products.find((p) => p.id === input.id);
  if (!product) throw new DomainError('That product is no longer in the catalogue.');
  if (product.status === input.status) return;
  if (input.status === 'active') {
    const category = t.categories.find((c) => c.id === product.categoryId);
    if (category?.status !== 'active') throw new DomainError(`${category?.name ?? 'Its category'} is archived. Bring the category back first, or move the product.`);
  }
  const before = { status: product.status };
  product.status = input.status;
  menuChanged({ availability: true });
  record(actor, input.status === 'archived' ? 'product.archived' : 'product.restored', 'product', product.id, before, { status: product.status }, reason, 'notable');
}

/* -------------------------------------------------------------------- variants */

export interface VariantInput {
  id?: string | null;
  productId: string;
  name: string;
  kind: VariantKind;
  serveVolumeMl: number | null;
  depletionFactor: number;
  barcode: string | null;
  isDefault: boolean;
  actor: Actor;
}

/** Add a way a product is sold (a tot, a double, the bottle), or change one. */
export function saveVariant(input: VariantInput, onPrice?: (variantId: string) => void): ProductVariant {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const product = t.products.find((p) => p.id === input.productId);
  if (!product) throw new DomainError('That product is no longer in the catalogue.');
  const fields = variantFields(input, product.containerVolumeMl);
  const barcode = optional(input.barcode, 32, 'A barcode');
  const siblings = t.variants.filter((v) => v.productId === product.id && v.status === 'active');
  const clash = siblings.find((v) => v.name.toLowerCase() === fields.name.toLowerCase() && v.id !== input.id);
  if (clash) throw new DomainError(`${product.name} is already sold as ${clash.name}.`);
  if (fields.kind === 'sealed' && siblings.some((v) => v.kind === 'sealed' && v.id !== input.id)) throw new DomainError(`${product.name} already has a sealed way to sell it; stock counts against one.`);

  let variant: ProductVariant;
  let before: object | null = null;
  if (!input.id) {
    if (!onPrice) throw new DomainError('A new way to sell it needs a price.');
    variant = { id: createId(), outletId: product.outletId, productId: product.id, ...fields, barcode, isDefault: false, sortOrder: Math.max(0, ...siblings.map((v) => v.sortOrder)) + 1, status: 'active' };
    t.variants.push(variant);
    onPrice(variant.id);
  } else {
    const found = t.variants.find((v) => v.id === input.id && v.productId === product.id);
    if (!found) throw new DomainError('That way of selling it is no longer in the catalogue.');
    variant = found;
    before = { name: variant.name, kind: variant.kind, serveVolumeMl: variant.serveVolumeMl, depletionFactor: variant.depletionFactor, barcode: variant.barcode, isDefault: variant.isDefault };
    if (!changed(before, { ...fields, barcode, isDefault: input.isDefault })) return variant;
    Object.assign(variant, fields, { barcode });
  }
  if (input.isDefault && !variant.isDefault) {
    for (const v of siblings) v.isDefault = v.id === variant.id;
    variant.isDefault = true;
  }
  product.isSoldSealed = t.variants.some((v) => v.productId === product.id && v.status === 'active' && v.kind === 'sealed');
  product.isSoldByServe = t.variants.some((v) => v.productId === product.id && v.status === 'active' && v.kind === 'serve');
  menuChanged({ availability: true });
  record(input.actor, before ? 'variant.updated' : 'variant.created', 'product_variant', variant.id, before, { product: product.name, name: variant.name, kind: variant.kind, serveVolumeMl: variant.serveVolumeMl, depletionFactor: variant.depletionFactor });
  return variant;
}

/** Stop selling a product one way, or start again. Its last active way cannot go. */
export function setVariantStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const variant = t.variants.find((v) => v.id === input.id);
  if (!variant) throw new DomainError('That way of selling it is no longer in the catalogue.');
  if (variant.status === input.status) return;
  const product = t.products.find((p) => p.id === variant.productId)!;
  if (input.status === 'archived') {
    const others = t.variants.filter((v) => v.productId === variant.productId && v.id !== variant.id && v.status === 'active');
    if (others.length === 0) throw new DomainError(`That is the only way ${product.name} is sold. Archive the product instead.`);
    if (variant.kind === 'sealed' && others.some((v) => v.kind === 'serve')) throw new DomainError(`The serves of ${product.name} pour from the ${variant.name}. Archive them first.`);
    if (variant.isDefault) others[0]!.isDefault = true;
    variant.isDefault = false;
  }
  const before = { status: variant.status };
  variant.status = input.status;
  menuChanged({ availability: true });
  record(actor, input.status === 'archived' ? 'variant.archived' : 'variant.restored', 'product_variant', variant.id, before, { status: variant.status, product: product.name }, reason, 'notable');
}

/* ------------------------------------------------------------------- modifiers */

export interface ModifierOptionInput {
  id?: string | null;
  name: string;
  priceDeltaCents: Cents;
  linkedVariantId: string | null;
}

export interface ModifierGroupInput {
  id?: string | null;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: readonly ModifierOptionInput[];
  actor: Actor;
}

/**
 * Add a group of modifiers (mixers, ice, garnish) with its options, or change one. Options left out
 * of the list are archived, since a fired line may name them.
 */
export function saveModifierGroup(input: ModifierGroupInput): ModifierGroup {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const groupName = name(input.name, 'A modifier group name', 40);
  const minSelect = whole(input.minSelect, 'The fewest a waiter must choose', { max: 20 })!;
  const maxSelect = whole(input.maxSelect, 'The most a waiter may choose', { min: 1, max: 20 })!;
  if (minSelect > maxSelect) throw new DomainError('The fewest to choose cannot be more than the most.');
  if (input.options.length === 0) throw new DomainError('A modifier group needs at least one option.');
  if (input.options.length > 40) throw new DomainError('Keep a modifier group to 40 options.');
  const seen = new Set<string>();
  const options = input.options.map((o) => {
    const optionName = name(o.name, 'An option name', 40);
    if (seen.has(optionName.toLowerCase())) throw new DomainError(`${optionName} is in the list twice.`);
    seen.add(optionName.toLowerCase());
    if (isNegative(o.priceDeltaCents)) throw new DomainError('An option can add to the price, never take from it. Use a discount instead.');
    if (o.linkedVariantId && !t.variants.some((v) => v.id === o.linkedVariantId && v.status === 'active')) throw new DomainError(`The stock item linked to ${optionName} is not on the menu.`);
    return { ...o, name: optionName };
  });

  let group: ModifierGroup;
  let before: object | null = null;
  if (!input.id) {
    group = { id: createId(), outletId: outletId(), name: groupName, minSelect, maxSelect, isRequired: minSelect > 0, sortOrder: Math.max(0, ...t.modifierGroups.map((g) => g.sortOrder)) + 1, status: 'active' };
    t.modifierGroups.push(group);
  } else {
    const found = t.modifierGroups.find((g) => g.id === input.id);
    if (!found) throw new DomainError('That modifier group is no longer in the catalogue.');
    group = found;
    before = { name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, options: t.modifiers.filter((m) => m.modifierGroupId === group.id && m.status === 'active').map((m) => m.name) };
    Object.assign(group, { name: groupName, minSelect, maxSelect, isRequired: minSelect > 0 });
  }

  const current = t.modifiers.filter((m) => m.modifierGroupId === group.id);
  const kept = new Set<string>();
  options.forEach((o, i) => {
    const existing = o.id ? current.find((m) => m.id === o.id) : undefined;
    if (existing) {
      kept.add(existing.id);
      Object.assign(existing, { name: o.name, priceDeltaCents: o.priceDeltaCents, linkedVariantId: o.linkedVariantId, sortOrder: i + 1, status: 'active' as const });
    } else {
      const modifier: Modifier = { id: createId(), modifierGroupId: group.id, name: o.name, priceDeltaCents: o.priceDeltaCents, linkedVariantId: o.linkedVariantId, sortOrder: i + 1, status: 'active' };
      t.modifiers.push(modifier);
      kept.add(modifier.id);
    }
  });
  for (const m of current) if (!kept.has(m.id) && m.status === 'active') m.status = 'archived';

  menuChanged();
  record(input.actor, before ? 'modifier_group.updated' : 'modifier_group.created', 'modifier_group', group.id, before, { name: group.name, minSelect, maxSelect, options: options.map((o) => o.name) });
  return group;
}

/** Choose which items offer a modifier group. */
export function setModifierGroupItems(input: { groupId: string; variantIds: readonly string[]; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing the menu');
  const t = catalogueTables();
  const group = t.modifierGroups.find((g) => g.id === input.groupId);
  if (!group) throw new DomainError('That modifier group is no longer in the catalogue.');
  const wanted = new Set(input.variantIds);
  for (const id of wanted) if (!t.variants.some((v) => v.id === id)) throw new DomainError('One of the items chosen is no longer in the catalogue.');
  // A link is never deleted, since the store keeps every row it has written: it is marked removed,
  // and linking the same pair again brings that row back.
  const links = t.variantModifierGroups.filter((x) => x.modifierGroupId === group.id);
  const before = links.filter((x) => !x.removed).map((x) => x.productVariantId);
  if (!changed([...before].sort(), [...wanted].sort())) return;
  for (const link of links) {
    const keep = wanted.has(link.productVariantId);
    if (keep && link.removed) link.removed = false;
    if (!keep && !link.removed) link.removed = true;
  }
  for (const id of wanted) {
    if (links.some((x) => x.productVariantId === id)) continue;
    const order = t.variantModifierGroups.filter((x) => x.productVariantId === id && !x.removed).length + 1;
    t.variantModifierGroups.push({ productVariantId: id, modifierGroupId: group.id, sortOrder: order });
  }
  menuChanged();
  record(input.actor, 'modifier_group.items', 'modifier_group', group.id, { items: before.length }, { items: wanted.size });
}

/** Take a modifier group off the menu, or bring it back. */
export function setModifierGroupStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing the menu');
  const group = catalogueTables().modifierGroups.find((g) => g.id === input.id);
  if (!group) throw new DomainError('That modifier group is no longer in the catalogue.');
  if (group.status === input.status) return;
  const before = { status: group.status };
  group.status = input.status;
  menuChanged();
  record(actor, input.status === 'archived' ? 'modifier_group.archived' : 'modifier_group.restored', 'modifier_group', group.id, before, { status: group.status }, reason, 'notable');
}
