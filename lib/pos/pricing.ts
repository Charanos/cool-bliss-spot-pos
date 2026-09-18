'use client';

import { type PricingIndex, createPricingIndex } from '@bliss/shared/pricing';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { META, posDb, getMeta } from './db';

let cache: { version: number; index: PricingIndex } | null = null;

/** The same pure pricing pipeline the server runs, over the cached snapshot. docs/05 section 2.2. */
export async function pricingIndex(): Promise<PricingIndex> {
  const db = posDb();
  const version = (await getMeta<number>(META.catalogueVersion)) ?? -1;
  if (cache && cache.version === version) return cache.index;
  const [products, variants, priceLists, priceListItems, priceRules] = await Promise.all([
    db.products.toArray(),
    db.variants.toArray(),
    db.priceLists.toArray(),
    db.priceListItems.toArray(),
    db.priceRules.toArray(),
  ]);
  const index = createPricingIndex({ products, variants, priceLists, priceListItems, priceRules });
  cache = { version, index };
  return index;
}

export function usePricingIndex(): PricingIndex | undefined {
  const version = useLiveQuery(() => getMeta<number>(META.catalogueVersion), []);
  const index = useLiveQuery(() => (version === undefined ? undefined : pricingIndex()), [version]);
  return useMemo(() => index, [index]);
}
