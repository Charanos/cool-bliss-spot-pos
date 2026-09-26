import 'server-only';
import type { PriceList } from '@bliss/shared/domain';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';
import type { PriceRow } from './price-list-view';

/** Every item on sale against one list: its base price, its price here, and its cost a serve. */
export function priceRows(list: PriceList, canSeeCost: boolean): PriceRow[] {
  const base = pricingManage.defaultList() ?? list;
  const baseItems = pricing.itemsFor(base.id);
  const listItems = pricing.itemsFor(list.id);
  return catalogue
    .variants()
    .filter((v) => v.status === 'active' && catalogue.productById(v.productId)?.status === 'active')
    .map((v) => {
      const product = catalogue.productById(v.productId)!;
      const stock = catalogue.stockVariantFor(v.id);
      const recipe = inventory.recipeFor(v.id);
      return {
        variantId: v.id,
        name: v.name,
        productId: product.id,
        categoryId: product.categoryId,
        category: catalogue.categoryById(product.categoryId)?.name ?? '',
        base: baseItems.find((i) => i.productVariantId === v.id)?.priceCents ?? null,
        price: listItems.find((i) => i.productVariantId === v.id)?.priceCents ?? null,
        cost: !canSeeCost || recipe || !stock ? null : inventory.valueAtCost(stock.stockVariantId, stock.factor),
      };
    })
    .filter((r) => list.kind === 'base' || r.price !== null || r.base !== null);
}
