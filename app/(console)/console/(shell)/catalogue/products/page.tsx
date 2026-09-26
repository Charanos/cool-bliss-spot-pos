import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import { type ProductRow, ProductsTable } from './products-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  const outlet = identity.outlet();
  const base = pricing.priceLists().find((l) => l.kind === 'base');
  const baseItems = base ? pricing.itemsFor(base.id) : [];
  const variants = catalogue.variants();

  const rows: ProductRow[] = catalogue.products().map((p) => {
    const category = catalogue.categoryById(p.categoryId);
    const own = variants.filter((v) => v.productId === p.id && v.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
    const prices = own.map((v) => baseItems.find((i) => i.productVariantId === v.id)?.priceCents).filter((x): x is NonNullable<typeof x> => x !== undefined);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      categoryId: p.categoryId,
      category: category?.name ?? '',
      colour: category?.colourToken ?? 'steel',
      imageKey: p.imageKey,
      container: p.containerVolumeMl,
      serves: own.map((v) => v.name.replace(p.name, '').trim() || v.name),
      fromPrice: prices.length > 0 ? prices.reduce((a, b) => (b < a ? b : a)) : null,
      threshold: p.lowStockThreshold,
      thresholdIsDefault: p.lowStockThreshold === null,
      effectiveThreshold: p.lowStockThreshold ?? outlet.lowStockDefault,
      tracked: category?.trackStock ?? false,
      supplier: procurement.supplierById(p.defaultSupplierId)?.name ?? null,
      status: p.status,
    };
  });

  return (
    <>
      <ViewHeader page="/console/catalogue/products" />
      <ProductsTable rows={rows} categories={catalogue.categories().map((c) => ({ value: c.id, label: c.name }))} />
    </>
  );
}
