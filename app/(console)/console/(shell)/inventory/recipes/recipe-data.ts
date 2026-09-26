import 'server-only';
import { type Cents, ZERO, add, multiplyByQuantity } from '@bliss/shared/money';
import type { Recipe } from '@bliss/db/seed/catalogue';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';

export interface RecipePart {
  componentVariantId: string;
  name: string;
  productId: string | null;
  qty: number;
  volumeMl: number | null;
  wastagePct: number;
  cost: Cents;
}

/** A recipe with what each part costs at average cost, allowing for wastage, and the serve's base price. */
export function costedRecipe(r: Recipe) {
  const parts: RecipePart[] = r.components.map((c) => {
    const variant = catalogue.variantById(c.componentVariantId);
    const each = inventory.averageCost(c.componentVariantId);
    return {
      componentVariantId: c.componentVariantId,
      name: variant?.name ?? 'Item no longer stocked',
      productId: variant?.productId ?? null,
      qty: c.qty,
      volumeMl: c.volumeMl,
      wastagePct: c.wastagePct,
      cost: multiplyByQuantity(each, c.qty * (1 + c.wastagePct / 100)),
    };
  });
  const cost = parts.reduce((acc, p) => add(acc, p.cost), ZERO);
  const base = pricingManage.defaultList();
  const price = base ? (pricing.itemsFor(base.id).find((i) => i.productVariantId === r.productVariantId)?.priceCents ?? null) : null;
  const variant = catalogue.variantById(r.productVariantId);
  return { id: r.id, name: r.name, variantId: r.productVariantId, variantName: variant?.name ?? 'An item no longer on the menu', productId: variant?.productId ?? null, parts, cost, price };
}
