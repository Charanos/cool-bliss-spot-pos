'use server';

import { z } from 'zod';
import { DomainError } from '@/modules/_data/errors';
import * as manage from '@/modules/catalogue/manage';
import * as inventoryManage from '@/modules/inventory/manage';
import * as pricing from '@/modules/pricing/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as procurement from '@/modules/procurement/service';
import { type ActionResult, id, kes, optionalText, reason, requestId, runAction, wholeNumber } from '../_lib/action';

/**
 * The menu: categories, products and how each is sold, modifiers, price lists, time rules and
 * recipes. Each action parses its input here and leaves every rule to the module services.
 */

const MENU = ['/console/catalogue', '/console/pricing', '/console/inventory', '/console/overview'];

const status = z.enum(['active', 'archived'], { error: 'Choose whether it is in use or archived.' });
const colour = z.enum(['glacier', 'ember', 'leaf', 'iris', 'rose', 'steel', 'brass', 'jade'], { error: 'Choose a colour.' });
const route = z.enum(['bar', 'kitchen', 'none'], { error: 'Choose where orders print.' });
const kind = z.enum(['sealed', 'serve'], { error: 'Choose how it is sold.' });
const name = (what: string, max: number) => z.string({ error: `Enter ${what}.` }).max(max, `${what} is at most ${max} characters.`);
const decimal = (what: string) => z.number({ error: `Enter ${what} as a number.` }).finite(`Enter ${what} as a number.`);

/* ------------------------------------------------------------------ categories */

export async function saveCategory(raw: { id?: string | null; name: string; colourToken: string; routingTarget: string; trackStock: boolean }): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ id: id('category').nullable().optional(), name: name('a name', 40), colourToken: colour, routingTarget: route, trackStock: z.boolean() });
  return runAction(schema, raw, (input, actor) => ({ id: manage.saveCategory({ ...input, actor }).id }), { revalidate: MENU });
}

export async function moveCategory(raw: { id: string; direction: 'up' | 'down' }): Promise<ActionResult> {
  return runAction(z.object({ id: id('category'), direction: z.enum(['up', 'down']) }), raw, (input, actor) => manage.moveCategory({ ...input, actor }), { revalidate: MENU });
}

export async function setCategoryStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('category'), status, reason }), raw, (input, actor) => manage.setCategoryStatus({ ...input, actor }), { revalidate: MENU });
}

/* -------------------------------------------------------------------- products */

const productFields = {
  categoryId: id('category'),
  name: name('a name', 60),
  brand: optionalText(40, 'A brand'),
  sku: name('a SKU', 32),
  barcode: optionalText(32, 'A barcode'),
  containerVolumeMl: wholeNumber('The bottle size', 20_000).nullable(),
  abv: decimal('alcohol by volume').nullable(),
  defaultSupplierId: id('supplier').nullable(),
  imageKey: optionalText(200, 'The photograph'),
};

const activeSuppliers = () => procurement.suppliers().map((s) => ({ id: s.id, status: s.status }));

export async function createProduct(raw: {
  categoryId: string;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  containerVolumeMl: number | null;
  abv: number | null;
  defaultSupplierId: string | null;
  imageKey: string | null;
  firstVariant: { name: string; kind: 'sealed' | 'serve'; serveVolumeMl: number | null; depletionFactor: number };
  basePrice: string;
  requestId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    ...productFields,
    firstVariant: z.object({ name: name('how it is sold', 40), kind, serveVolumeMl: wholeNumber('The serve', 5_000).nullable(), depletionFactor: decimal('the share of a bottle') }),
    basePrice: kes('the price'),
    requestId,
  });
  return runAction(
    schema,
    raw,
    (input, actor) => {
      const base = pricingManage.defaultList();
      if (!base) throw new DomainError('There is no base price list to price it on. Add one in Pricing first.');
      const product = manage.createProduct({ ...input, basePriceCents: input.basePrice, requestId: input.requestId ?? null, actor }, activeSuppliers(), (variantId) => {
        pricing.setPrice({ listId: base.id, variantId, priceCents: input.basePrice, reason: 'The first price, set when it was added', actor });
      });
      return { id: product.id };
    },
    { revalidate: MENU },
  );
}

export async function updateProduct(raw: { id: string } & Record<string, unknown>): Promise<ActionResult> {
  const schema = z.object({ id: id('product'), ...productFields });
  return runAction(schema, raw, (input, actor) => void manage.updateProduct({ ...input, actor }, activeSuppliers()), { revalidate: MENU });
}

export async function setProductStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('product'), status, reason }), raw, (input, actor) => manage.setProductStatus({ ...input, actor }), { revalidate: MENU });
}

export async function saveVariant(raw: {
  id?: string | null;
  productId: string;
  name: string;
  kind: 'sealed' | 'serve';
  serveVolumeMl: number | null;
  depletionFactor: number;
  barcode: string | null;
  isDefault: boolean;
  price?: string | null;
}): Promise<ActionResult> {
  const schema = z.object({
    id: id('way of selling').nullable().optional(),
    productId: id('product'),
    name: name('how it is sold', 40),
    kind,
    serveVolumeMl: wholeNumber('The serve', 5_000).nullable(),
    depletionFactor: decimal('the share of a bottle'),
    barcode: optionalText(32, 'A barcode'),
    isDefault: z.boolean(),
    price: kes('the price').nullable().optional(),
  });
  return runAction(
    schema,
    raw,
    (input, actor) => {
      const base = pricingManage.defaultList();
      const price = input.price ?? null;
      manage.saveVariant(
        { ...input, actor },
        input.id || !base || price === null ? undefined : (variantId) => pricing.setPrice({ listId: base.id, variantId, priceCents: price, reason: 'The first price, set when it was added', actor }),
      );
    },
    { revalidate: MENU },
  );
}

export async function setVariantStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('way of selling'), status, reason }), raw, (input, actor) => manage.setVariantStatus({ ...input, actor }), { revalidate: MENU });
}

/* ------------------------------------------------------------------- modifiers */

export async function saveModifierGroup(raw: { id?: string | null; name: string; minSelect: number; maxSelect: number; options: { id?: string | null; name: string; priceDelta: string; linkedVariantId: string | null }[] }): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    id: id('modifier group').nullable().optional(),
    name: name('a name', 40),
    minSelect: wholeNumber('The fewest to choose', 20),
    maxSelect: wholeNumber('The most to choose', 20),
    options: z
      .array(z.object({ id: id('option').nullable().optional(), name: name('an option name', 40), priceDelta: kes('what it adds'), linkedVariantId: id('stock item').nullable() }))
      .min(1, 'Add at least one option.')
      .max(40, 'Keep a group to 40 options.'),
  });
  return runAction(
    schema,
    raw,
    (input, actor) => ({ id: manage.saveModifierGroup({ ...input, options: input.options.map((o) => ({ id: o.id ?? null, name: o.name, priceDeltaCents: o.priceDelta, linkedVariantId: o.linkedVariantId })), actor }).id }),
    { revalidate: MENU },
  );
}

export async function setModifierGroupItems(raw: { groupId: string; variantIds: string[] }): Promise<ActionResult> {
  return runAction(z.object({ groupId: id('modifier group'), variantIds: z.array(id('item')).max(500) }), raw, (input, actor) => manage.setModifierGroupItems({ ...input, actor }), { revalidate: MENU });
}

export async function setModifierGroupStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('modifier group'), status, reason }), raw, (input, actor) => manage.setModifierGroupStatus({ ...input, actor }), { revalidate: MENU });
}

/* ------------------------------------------------------------ lists and rules */

export async function savePriceList(raw: { id?: string | null; name: string; kind: 'base' | 'overlay'; priority: number }): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ id: id('price list').nullable().optional(), name: name('a name', 40), kind: z.enum(['base', 'overlay']), priority: wholeNumber('Priority', 1000) });
  return runAction(schema, raw, (input, actor) => ({ id: pricingManage.savePriceList({ ...input, actor }).id }), { revalidate: MENU });
}

export async function setPriceListStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('price list'), status, reason }), raw, (input, actor) => pricingManage.setPriceListStatus({ ...input, actor }), { revalidate: MENU });
}

export async function copyPrices(raw: { fromId: string; toId: string; onlyMissing: boolean; reason: string }): Promise<ActionResult<{ copied: number }>> {
  return runAction(z.object({ fromId: id('price list'), toId: id('price list'), onlyMissing: z.boolean(), reason }), raw, (input, actor) => pricingManage.copyPrices({ ...input, actor }), { revalidate: MENU });
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time, such as 17:00.');

export async function saveRule(raw: { id?: string | null; name: string; priceListId: string; daysOfWeek: number[]; startTime: string; endTime: string; priority: number }): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    id: id('time rule').nullable().optional(),
    name: name('a name', 40),
    priceListId: id('price list'),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Choose at least one day.').max(7),
    startTime: time,
    endTime: time,
    priority: wholeNumber('Priority', 1000),
  });
  return runAction(schema, raw, (input, actor) => ({ id: pricingManage.saveRule({ ...input, actor }).id }), { revalidate: MENU });
}

export async function setRuleStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('time rule'), status, reason }), raw, (input, actor) => pricingManage.setRuleStatus({ ...input, actor }), { revalidate: MENU });
}

/* --------------------------------------------------------------------- recipes */

export async function saveRecipe(raw: { variantId: string; name: string; components: { componentVariantId: string; qty: number; volumeMl: number | null; wastagePct: number }[] }): Promise<ActionResult> {
  const schema = z.object({
    variantId: id('item'),
    name: name('a name', 60),
    components: z
      .array(z.object({ componentVariantId: id('stock item'), qty: decimal('how much a serve takes'), volumeMl: wholeNumber('The measure', 5000).nullable(), wastagePct: decimal('wastage') }))
      .min(1, 'Add at least one stocked item.')
      .max(12, 'Keep a recipe to 12 items.'),
  });
  return runAction(schema, raw, (input, actor) => void inventoryManage.saveRecipe({ ...input, actor }), { revalidate: MENU });
}

export async function archiveRecipe(raw: { id: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('recipe'), reason }), raw, (input, actor) => inventoryManage.archiveRecipe({ ...input, actor }), { revalidate: MENU });
}

export async function savePourSpec(raw: { variantId: string; nominalVolumeMl: number; tolerancePct: number }): Promise<ActionResult> {
  return runAction(z.object({ variantId: id('serve'), nominalVolumeMl: wholeNumber('The measure', 1000), tolerancePct: decimal('the tolerance') }), raw, (input, actor) => inventoryManage.savePourSpec({ ...input, actor }), { revalidate: MENU });
}
