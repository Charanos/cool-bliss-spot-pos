import 'server-only';

import type { PriceListItem } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, formatKes, isNegative } from '@bliss/shared/money';
import { type PricingIndex, createPricingIndex, tryResolvePrice } from '@bliss/shared/pricing';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import { pricingTables } from './schema';

export function priceLists() {
  return pricingTables().priceLists;
}

/** Current items only. A replaced price stays in the table, archived, so history can be read back. */
export function itemsFor(listId: string) {
  return pricingTables().items.filter((i) => i.priceListId === listId && i.status === 'active');
}

export function rules() {
  return pricingTables().rules;
}

let cached: { version: number; items: PriceListItem[]; index: PricingIndex } | null = null;

export function index(): PricingIndex {
  const t = pricingTables();
  const version = catalogue.version();
  if (!cached || cached.version !== version || cached.items !== t.items) {
    cached = {
      version,
      items: t.items,
      index: createPricingIndex({
        products: catalogue.products(),
        variants: catalogue.variants(),
        priceLists: t.priceLists,
        priceListItems: t.items.filter((i) => i.status === 'active'),
        priceRules: t.rules,
      }),
    };
  }
  return cached.index;
}

const nextId = createUuidV7();

/**
 * N-03: change a price on a list. The old item is archived and a new one written, so a line fired
 * before the change keeps its stored derivation and the list's history stays readable. An overlay
 * list, such as happy hour, can also stop covering a variant: priceCents null archives its item.
 * Every price change is audited with before, after and a reason. docs/01 R10.
 */
export function setPrice(input: { listId: string; variantId: string; priceCents: Cents | null; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const list = t.priceLists.find((l) => l.id === input.listId && l.status === 'active');
  if (!list) throw new Error('That price list is not active.');
  const variant = catalogue.variantById(input.variantId);
  if (!variant) throw new Error('That item is not in the catalogue.');
  if (input.priceCents !== null && isNegative(input.priceCents)) throw new Error('A price cannot be below zero.');
  const current = t.items.find((i) => i.priceListId === list.id && i.productVariantId === variant.id && i.status === 'active') ?? null;
  if (input.priceCents === null && list.kind === 'base') throw new Error('Every item needs a base price. Archive the item instead.');
  if (current && input.priceCents !== null && current.priceCents === input.priceCents) throw new Error(`${variant.name} is already ${formatKes(input.priceCents)} on ${list.name}.`);
  if (!current && input.priceCents === null) throw new Error(`${list.name} does not price ${variant.name}.`);

  if (current) current.status = 'archived';
  const next: PriceListItem | null =
    input.priceCents === null
      ? null
      : { id: nextId(), priceListId: list.id, productVariantId: variant.id, priceCents: input.priceCents, minQty: current?.minQty ?? null, status: 'active' };
  if (next) t.items.push(next);
  bumpCatalogueVersion();
  audit.record({
    outletId: list.outletId,
    actorStaffId: actor.staffId,
    action: 'price.changed',
    entityType: 'price_list_item',
    entityId: next?.id ?? current!.id,
    before: current ? { list: list.name, variant: variant.name, priceCents: current.priceCents.toString() } : null,
    after: next ? { list: list.name, variant: variant.name, priceCents: next.priceCents.toString() } : null,
    reason,
    severity: 'notable',
  });
  return next;
}

/** The price a guest would pay for one unit right now, with the rule that set it. */
export function currentPrice(variantId: string, at = Date.now()) {
  return tryResolvePrice(index(), { variantId, qty: 1, at, timeZone: identity.outlet().timezone });
}

/** Everything a Floor device needs to resolve prices offline with the same pure function. */
export function snapshot() {
  const t = pricingTables();
  return { priceLists: t.priceLists, priceListItems: t.items, priceRules: t.rules };
}
