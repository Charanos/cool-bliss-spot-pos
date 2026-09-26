'use server';

import { z } from 'zod';
import * as catalogue from '@/modules/catalogue/service';
import * as pricing from '@/modules/pricing/service';
import { type ActionResult, id, kes, reason, runAction, wholeNumber } from '../_lib/action';

/** Catalogue and pricing actions. */

export async function setPrice(raw: { listId: string; variantId: string; price: string | null; reason: string }): Promise<ActionResult> {
  const schema = z.object({ listId: id('price list'), variantId: id('item'), price: kes('the price').nullable(), reason });
  return runAction(schema, raw, (input, actor) => {
    pricing.setPrice({ listId: input.listId, variantId: input.variantId, priceCents: input.price, reason: input.reason, actor });
  });
}

export async function updateStockSettings(raw: { productId: string; lowStockThreshold: number | null; reorderPoint: number; reorderQty: number; leadTimeDays: number }): Promise<ActionResult> {
  const schema = z.object({
    productId: id('product'),
    lowStockThreshold: wholeNumber('The low stock point').nullable(),
    reorderPoint: wholeNumber('The reorder point'),
    reorderQty: wholeNumber('The reorder quantity'),
    leadTimeDays: wholeNumber('The lead time', 90),
  });
  return runAction(schema, raw, (input, actor) => {
    catalogue.updateStockSettings({ ...input, actor });
  });
}
