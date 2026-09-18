import type {
  DerivationStep,
  EpochMs,
  Id,
  PriceList,
  PriceListItem,
  PriceRule,
  Product,
  ProductVariant,
} from '../domain';
import { type Cents, ZERO, add, allocate, compare, multiplyByQty, multiplyByRate, scale, subtract, sum } from '../money/cents';
import { formatFigure } from '../money/format';
import { describeRuleWindow, ruleCoversInstant } from './time-rules';

/**
 * The deterministic pricing pipeline, docs/01-product-spec.md R4:
 *
 *   base price list -> serve size -> active time rule -> modifiers -> quantity
 *     -> line discount -> bill discount share
 *
 * A pure function over plain data, so the Floor resolves a price instantly for the tile and the
 * server resolves it again as the authority, running identical code. The derivation is stored on
 * the line, which is how a bill from three months ago is explained without recomputing anything.
 *
 * Price is fixed at fire time. Callers pass the fire instant, never the settlement instant.
 */

export interface PricingCatalogue {
  products: readonly Pick<Product, 'id' | 'categoryId' | 'status'>[];
  variants: readonly Pick<ProductVariant, 'id' | 'productId' | 'kind' | 'serveVolumeMl' | 'isDefault' | 'status'>[];
  priceLists: readonly PriceList[];
  priceListItems: readonly PriceListItem[];
  priceRules: readonly PriceRule[];
}

export interface PricingIndex {
  readonly catalogue: PricingCatalogue;
  readonly variantById: ReadonlyMap<Id, PricingCatalogue['variants'][number]>;
  readonly productById: ReadonlyMap<Id, PricingCatalogue['products'][number]>;
  readonly itemsByList: ReadonlyMap<Id, ReadonlyMap<Id, readonly PriceListItem[]>>;
  readonly defaultServeByProduct: ReadonlyMap<Id, PricingCatalogue['variants'][number]>;
}

export function createPricingIndex(catalogue: PricingCatalogue): PricingIndex {
  const variantById = new Map(catalogue.variants.map((v) => [v.id, v]));
  const productById = new Map(catalogue.products.map((p) => [p.id, p]));
  const itemsByList = new Map<Id, Map<Id, PriceListItem[]>>();
  for (const item of catalogue.priceListItems) {
    if (item.status !== 'active') continue;
    let byVariant = itemsByList.get(item.priceListId);
    if (!byVariant) {
      byVariant = new Map();
      itemsByList.set(item.priceListId, byVariant);
    }
    const list = byVariant.get(item.productVariantId) ?? [];
    list.push(item);
    byVariant.set(item.productVariantId, list);
  }
  const defaultServeByProduct = new Map<Id, PricingCatalogue['variants'][number]>();
  for (const v of catalogue.variants) {
    if (v.kind === 'serve' && v.isDefault && v.serveVolumeMl) defaultServeByProduct.set(v.productId, v);
  }
  return { catalogue, variantById, productById, itemsByList, defaultServeByProduct };
}

export type LineDiscount =
  | { kind: 'rate'; basisPoints: number; label: string }
  | { kind: 'amount'; cents: Cents; label: string };

export interface ModifierCharge {
  name: string;
  priceDeltaCents: Cents;
  qty: number;
}

export interface ResolvePriceInput {
  variantId: Id;
  qty: number;
  /** The fire instant. */
  at: EpochMs;
  timeZone: string;
  /** The zone's default price list, if it has one. */
  basePriceListId?: Id | null;
  modifiers?: readonly ModifierCharge[];
  lineDiscount?: LineDiscount | null;
  billDiscountShareCents?: Cents | null;
}

export interface ResolvedPrice {
  /** Base, serve size, time rule and modifiers applied, per unit. */
  unitPriceCents: Cents;
  /** Unit price times quantity, less line discount and bill discount share. */
  lineTotalCents: Cents;
  derivation: DerivationStep[];
  appliedRuleId: Id | null;
  appliedRuleName: string | null;
}

export class PriceNotFoundError extends Error {
  readonly code = 'PRICE_NOT_FOUND';
  constructor(readonly variantId: Id) {
    super(`No active price for variant ${variantId}`);
  }
}

const money = (c: Cents) => formatFigure(c);

function listIsEffective(list: PriceList, at: EpochMs): boolean {
  if (list.status !== 'active') return false;
  if (list.effectiveFrom !== null && at < list.effectiveFrom) return false;
  if (list.effectiveTo !== null && at >= list.effectiveTo) return false;
  return true;
}

/** The item for a variant on a list, honouring case pricing: the largest min_qty not above qty. */
function itemFor(index: PricingIndex, listId: Id, variantId: Id, qty: number): PriceListItem | null {
  const items = index.itemsByList.get(listId)?.get(variantId);
  if (!items || items.length === 0) return null;
  let best: PriceListItem | null = null;
  for (const item of items) {
    const threshold = item.minQty ?? 0;
    if (threshold > qty) continue;
    if (!best || threshold > (best.minQty ?? 0)) best = item;
  }
  return best;
}

interface ListPrice {
  price: Cents;
  steps: DerivationStep[];
}

/** A price from one list, directly or through the product's default serve and a volume ratio. */
function priceFromList(index: PricingIndex, list: PriceList, variantId: Id, qty: number): ListPrice | null {
  const direct = itemFor(index, list.id, variantId, qty);
  if (direct) {
    return {
      price: direct.priceCents,
      steps: [{ label: list.name, input: 'price list', op: 'lookup', output: money(direct.priceCents) }],
    };
  }
  const variant = index.variantById.get(variantId);
  if (!variant || variant.kind !== 'serve' || !variant.serveVolumeMl) return null;
  const serve = index.defaultServeByProduct.get(variant.productId);
  if (!serve || serve.id === variant.id || !serve.serveVolumeMl) return null;
  const serveItem = itemFor(index, list.id, serve.id, qty);
  if (!serveItem) return null;
  const numerator = BigInt(Math.round(variant.serveVolumeMl * 100));
  const denominator = BigInt(Math.round(serve.serveVolumeMl * 100));
  const scaled = scale(serveItem.priceCents, numerator, denominator);
  return {
    price: scaled,
    steps: [
      { label: list.name, input: 'price list', op: 'lookup default serve', output: money(serveItem.priceCents) },
      {
        label: 'Serve size',
        input: `${money(serveItem.priceCents)} per ${serve.serveVolumeMl}ml`,
        op: `x ${variant.serveVolumeMl}/${serve.serveVolumeMl}`,
        output: money(scaled),
      },
    ],
  };
}

function ruleTargetsVariant(index: PricingIndex, rule: PriceRule, variantId: Id): boolean {
  if (rule.appliesTo === 'all') return true;
  if (rule.appliesTo === 'variant') return rule.targetIds.includes(variantId);
  const variant = index.variantById.get(variantId);
  if (!variant) return false;
  if (rule.appliesTo === 'product') return rule.targetIds.includes(variant.productId);
  const product = index.productById.get(variant.productId);
  return product ? rule.targetIds.includes(product.categoryId) : false;
}

/** Rules covering an instant, highest priority first. Ties break by id for determinism. */
export function activeRules(index: PricingIndex, at: EpochMs, timeZone: string): PriceRule[] {
  return index.catalogue.priceRules
    .filter((r) => ruleCoversInstant(r, at, timeZone))
    .sort((a, b) => (b.priority - a.priority) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function resolvePrice(index: PricingIndex, input: ResolvePriceInput): ResolvedPrice {
  const { variantId, at, timeZone } = input;
  const qty = input.qty;
  if (!Number.isInteger(qty) || qty < 1) throw new RangeError(`Quantity must be a whole number of at least 1, received ${qty}`);
  const variant = index.variantById.get(variantId);
  if (!variant) throw new PriceNotFoundError(variantId);

  const derivation: DerivationStep[] = [];

  // 1 and 2. Base price list, then serve size.
  const baseLists = index.catalogue.priceLists
    .filter((l) => l.kind === 'base' && listIsEffective(l, at))
    .sort((a, b) => {
      if (a.id === input.basePriceListId) return -1;
      if (b.id === input.basePriceListId) return 1;
      return (b.priority - a.priority) || (a.id < b.id ? -1 : 1);
    });
  let base: ListPrice | null = null;
  for (const list of baseLists) {
    base = priceFromList(index, list, variantId, qty);
    if (base) break;
  }
  if (!base) throw new PriceNotFoundError(variantId);
  derivation.push(...base.steps);
  let unit = base.price;

  // 3. Active time rule. The first covering rule, by priority, with a price for this variant wins.
  let appliedRule: PriceRule | null = null;
  const listById = new Map(index.catalogue.priceLists.map((l) => [l.id, l]));
  for (const rule of activeRules(index, at, timeZone)) {
    if (!ruleTargetsVariant(index, rule, variantId)) continue;
    const overlay = listById.get(rule.priceListId);
    if (!overlay || !listIsEffective(overlay, at)) continue;
    const overlayPrice = priceFromList(index, overlay, variantId, qty);
    if (!overlayPrice) continue;
    derivation.push({
      label: rule.name,
      input: money(unit),
      op: `time rule ${describeRuleWindow(rule)}`,
      output: money(overlayPrice.price),
    });
    unit = overlayPrice.price;
    appliedRule = rule;
    break;
  }

  // Modifiers change the unit price: a mixer carries its own delta.
  for (const mod of input.modifiers ?? []) {
    if (mod.priceDeltaCents === ZERO) continue;
    const delta = multiplyByQty(mod.priceDeltaCents, mod.qty);
    const next = add(unit, delta);
    derivation.push({ label: mod.name, input: money(unit), op: `+ ${money(delta)}`, output: money(next) });
    unit = next;
  }

  let total = multiplyByQty(unit, qty);
  derivation.push({ label: 'Quantity', input: money(unit), op: `x ${qty}`, output: money(total) });

  // 4. Line discount.
  const discount = input.lineDiscount;
  if (discount) {
    const amount = discount.kind === 'rate' ? multiplyByRate(total, discount.basisPoints) : discount.cents;
    const next = subtract(total, amount);
    const op = discount.kind === 'rate' ? `- ${(discount.basisPoints / 100).toString()}%` : `- ${money(amount)}`;
    derivation.push({ label: discount.label, input: money(total), op, output: money(next) });
    total = next;
  }

  // 5. Bill discount share, allocated beforehand so shares sum to the bill discount exactly.
  const share = input.billDiscountShareCents;
  if (share && share !== ZERO) {
    const next = subtract(total, share);
    derivation.push({ label: 'Bill discount share', input: money(total), op: `- ${money(share)}`, output: money(next) });
    total = next;
  }

  return {
    unitPriceCents: unit,
    lineTotalCents: total,
    derivation,
    appliedRuleId: appliedRule?.id ?? null,
    appliedRuleName: appliedRule?.name ?? null,
  };
}

/** Resolve without throwing, for rendering a tile whose price is missing from the snapshot. */
export function tryResolvePrice(index: PricingIndex, input: ResolvePriceInput): ResolvedPrice | null {
  try {
    return resolvePrice(index, input);
  } catch (error) {
    if (error instanceof PriceNotFoundError) return null;
    throw error;
  }
}

/**
 * Allocate a bill level discount across lines in proportion to their totals, largest remainder,
 * so the sum of allocations equals the bill discount exactly (R4).
 */
export function allocateBillDiscount(lineTotals: readonly Cents[], discount: Cents): Cents[] {
  if (lineTotals.length === 0) return [];
  const subtotal = sum(lineTotals);
  if (compare(discount, subtotal) > 0) throw new RangeError('A bill discount cannot exceed the bill subtotal');
  return allocate(discount, lineTotals.map((t) => (t < 0n ? 0n : BigInt(t))));
}
