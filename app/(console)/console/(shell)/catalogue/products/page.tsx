import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import { ViewHeader } from '../../_components/workspace';
import { type ProductRow, ProductsTable } from './products-table';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage() {
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const base = pricingManage.defaultList();
  const baseItems = base ? pricing.itemsFor(base.id) : [];
  const variants = catalogue.variants();

  const rows: ProductRow[] = catalogue.products().map((p) => {
    const category = catalogue.categoryById(p.categoryId);
    const own = variants.filter((v) => v.productId === p.id && v.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
    const prices = own.map((v) => baseItems.find((i) => i.productVariantId === v.id)?.priceCents).filter((x): x is NonNullable<typeof x> => x !== undefined);
    const sealed = own.find((v) => v.kind === 'sealed');
    const stock = sealed ? catalogue.stockVariantFor(sealed.id) : null;
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      category: category?.name ?? '',
      colour: category?.colourToken ?? 'steel',
      imageKey: p.imageKey,
      containerVolumeMl: p.containerVolumeMl,
      abv: p.abv,
      defaultSupplierId: p.defaultSupplierId,
      serves: own.map((v) => v.name.replace(p.name, '').trim() || v.name),
      fromPrice: prices.length > 0 ? prices.reduce((a, b) => (b < a ? b : a)) : null,
      threshold: p.lowStockThreshold,
      thresholdIsDefault: p.lowStockThreshold === null,
      effectiveThreshold: p.lowStockThreshold ?? outlet.lowStockDefault,
      tracked: category?.trackStock ?? false,
      supplier: procurement.supplierById(p.defaultSupplierId)?.name ?? null,
      onHand: stock ? Math.round(inventory.onHand(stock.stockVariantId) * 100) / 100 : null,
      unit: p.containerVolumeMl ? 'btl' : 'units',
      status: p.status,
    };
  });

  return (
    <>
      <ViewHeader page="/console/catalogue/products" />
      <ProductsTable
        rows={rows}
        categories={catalogue.categories().filter((c) => c.status === 'active').map((c) => ({ value: c.id, label: c.name }))}
        suppliers={procurement.suppliers().filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.name }))}
        canEdit={identity.can(actor.staffId, 'price.write')}
      />
    </>
  );
}
