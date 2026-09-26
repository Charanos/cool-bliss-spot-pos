import 'server-only';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import type { OrderStockItem, OrderSupplier } from '../_parts/order-form';

/** What the order form needs: every active supplier with the items they carry, and every stocked item. */
export function orderFormData(): { suppliers: OrderSupplier[]; stock: OrderStockItem[] } {
  return {
    suppliers: procurement
      .suppliers()
      .filter((s) => s.status === 'active')
      .map((s) => ({ id: s.id, name: s.name, minOrderCents: s.minOrderCents, leadTimeDays: s.leadTimeDays, items: procurement.supplierProducts(s.id).map((sp) => ({ variantId: sp.productVariantId, packSize: sp.packSize, costCents: sp.lastCostCents })) })),
    stock: catalogue.stockVariants().map((v) => ({ id: v.id, name: v.name, avgCostCents: inventory.averageCost(v.id) })),
  };
}
