import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import { type ReorderGroup, ReorderView } from './reorder-view';

export const metadata: Metadata = { title: 'Reorder' };

/** N-15: what to order, grouped by the supplier who delivers it, ready to become purchase orders. */
export default function ReorderPage() {
  const suggestions = procurement.reorderSuggestions();
  const bySupplier = new Map<string, ReorderGroup>();
  for (const s of suggestions) {
    const supplier = procurement.supplierById(s.supplierId);
    const key = supplier?.id ?? 'none';
    const variant = catalogue.variantById(s.variantId)!;
    const product = catalogue.productById(variant.productId)!;
    const sp = procurement.supplierProducts(supplier?.id).find((x) => x.productVariantId === s.variantId);
    const group =
      bySupplier.get(key) ??
      ({
        supplierId: supplier?.id ?? null,
        name: supplier?.name ?? 'No default supplier',
        contact: supplier?.contactName ?? null,
        leadTimeDays: supplier?.leadTimeDays ?? null,
        minOrder: supplier?.minOrderCents ?? null,
        lines: [],
      } satisfies ReorderGroup);
    group.lines.push({
      variantId: s.variantId,
      name: variant.name,
      category: catalogue.categoryById(product.categoryId)?.name ?? '',
      imageKey: product.imageKey,
      onHand: s.onHand,
      onOrder: s.onOrder,
      reorderPoint: s.reorderPoint,
      velocity: s.velocityPerDay,
      daysCover: s.daysCover,
      suggestedQty: s.suggestedQty,
      packSize: sp?.packSize ?? 1,
      unitCost: sp?.lastCostCents ?? inventory.averageCost(s.variantId),
      finished: s.onHand <= 0,
    });
    bySupplier.set(key, group);
  }
  const groups = [...bySupplier.values()].sort((a, b) => (a.supplierId === null ? 1 : b.supplierId === null ? -1 : a.name.localeCompare(b.name)));
  return <ReorderView groups={groups} />;
}
