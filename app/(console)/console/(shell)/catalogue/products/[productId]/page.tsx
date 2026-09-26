import { formatQty } from '@bliss/shared/format';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, MetaRow } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBottle, IconCategory, IconHistory, IconTruckDelivery } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import { ProductThumb } from '../../../_components/product-thumb';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { StockSettingsForm } from './stock-settings-form';

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  return { title: catalogue.productById(productId)?.name ?? 'Product' };
}

/**
 * N-02 and N-04: a product with its serves off one bottle, what each serve costs a guest on every
 * list, how much of the bottle each one takes, and the stock settings that drive the floor's warnings.
 */
export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = catalogue.productById(productId);
  if (!product) notFound();
  const outlet = identity.outlet();
  const category = catalogue.categoryById(product.categoryId);
  const variants = catalogue
    .variants()
    .filter((v) => v.productId === product.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const lists = pricing.priceLists().filter((l) => l.status === 'active').sort((a, b) => a.priority - b.priority);
  const sealed = variants.find((v) => v.kind === 'sealed');
  const onHand = sealed ? inventory.onHand(sealed.id) : null;
  const supplier = procurement.supplierById(product.defaultSupplierId);
  const usedIn = inventory.recipes().filter((r) => r.components.some((c) => variants.some((v) => v.id === c.componentVariantId)));
  const cost = sealed ? inventory.averageCost(sealed.id) : null;

  const title = product.name;
  const head = 'px-12 py-12 text-label text-ink-subtle';

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/catalogue/products', label: 'Products' }}
        title={
          <span className="flex items-center gap-16">
            <ProductThumb name={product.name} imageKey={product.imageKey} colour={category?.colourToken} size="md" />
            {title}
          </span>
        }
        status={<StatusChip status={product.status === 'active' ? 'active' : 'retired'} label={product.status === 'active' ? 'On sale' : 'Archived'} />}
        meta={
          <MetaRow
            items={[
              category ? { icon: IconCategory, value: category.name } : null,
              product.brand ? { value: product.brand } : null,
              { label: 'SKU', value: product.sku },
              product.containerVolumeMl ? { icon: IconBottle, value: `${product.containerVolumeMl}ml` } : null,
              product.abv ? { value: `${product.abv}% ABV` } : null,
              supplier ? { icon: IconTruckDelivery, value: supplier.name } : null,
            ]}
          />
        }
        actions={
          sealed ? (
            <ButtonLink href={`/console/inventory/movements?variant=${sealed.id}&range=28`} variant="secondary" icon={IconHistory}>
              Stock movements
            </ButtonLink>
          ) : null
        }
      />

      {sealed && onHand !== null ? (
        <MetricGrid columns={3}>
          <Metric label="In stock" value={formatQty(onHand, 2)} detail={product.containerVolumeMl && variants.some((v) => v.kind === 'serve') ? 'Bottles, across every location' : 'Units, across every location'} tone={onHand <= 0 ? 'stop' : 'default'} />
          <Metric label="Average cost" value={cost ? <Money value={cost} size="num-kpi" /> : 'None'} detail="Each, from deliveries" />
          <Metric label="Stock value" value={cost ? <Money value={inventory.valueAtCost(sealed.id, Math.max(0, onHand))} size="num-kpi" decimals="whole" /> : 'None'} detail="At average cost" />
        </MetricGrid>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="product-serves">
            <CardHeader band level="h2" titleId="product-serves" title="Sold as" subtitle="Each serve takes its share of the bottle: a 30ml tot of a 750ml bottle takes 0.04 of it." />
            <div className="scroll-x">
              <table className="w-full border-collapse">
                <caption className="sr-only">Serves and prices</caption>
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className={`${head} pl-20 text-left`}>
                      Serve
                    </th>
                    <th scope="col" className={`${head} text-right`}>
                      Pour
                    </th>
                    <th scope="col" className={`${head} text-right`}>
                      Of a bottle
                    </th>
                    <th scope="col" className={`${head} text-left`}>
                      State
                    </th>
                    {lists.map((l, i) => (
                      <th key={l.id} scope="col" className={`${head} text-right ${i === lists.length - 1 ? 'pr-20' : ''}`}>
                        {l.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const state = availability.evaluate(v.id);
                    return (
                      <tr key={v.id} className="border-b border-rule last:border-b-0">
                        <td className="py-12 pl-20 pr-12">
                          <span className="block truncate text-ui text-ink">{v.name}</span>
                          <span className="block text-body-sm text-ink-subtle">{v.kind === 'sealed' ? 'Sealed' : 'By the serve'}</span>
                        </td>
                        <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{v.serveVolumeMl ? `${v.serveVolumeMl}ml` : 'Whole'}</td>
                        <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(v.depletionFactor, 4)}</td>
                        <td className="px-12 py-12">{state.state === 'available' ? <span className="text-body-sm text-ink-subtle">Available</span> : <StatusChip status={state.reason === 'hold' ? 'on_hold' : state.state} />}</td>
                        {lists.map((l, i) => {
                          const item = pricing.itemsFor(l.id).find((x) => x.productVariantId === v.id);
                          return (
                            <td key={l.id} className={`px-12 py-12 text-right ${i === lists.length - 1 ? 'pr-20' : ''}`}>
                              {item ? <Money value={item.priceCents} currency={false} size="num-md" decimals="whole" tone={l.kind === 'base' ? 'default' : 'accent'} /> : <span className="text-body-sm text-ink-subtle">Not listed</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {usedIn.length > 0 ? (
            <Card aria-labelledby="product-used-in">
              <CardHeader band level="h2" titleId="product-used-in" title="Used in" subtitle="Recipes that take this product's stock." />
              <ul className="flex flex-col">
                {usedIn.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                    <span className="text-ui text-ink">{r.name}</span>
                    <span className="font-mono tabular text-num-md text-ink-muted">
                      {r.components
                        .filter((c) => variants.some((v) => v.id === c.componentVariantId))
                        .map((c) => `${formatQty(c.qty, 3)} a serve`)
                        .join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <Card aria-labelledby="product-stock">
          <CardHeader band level="h2" titleId="product-stock" title="Stock settings" subtitle="When the floor warns, and when to reorder." />
          <CardBody className="pt-20">
            {category?.trackStock ? (
              <StockSettingsForm
                productId={product.id}
                outletDefault={outlet.lowStockDefault}
                initial={{ lowStockThreshold: product.lowStockThreshold, reorderPoint: product.reorderPoint, reorderQty: product.reorderQty, leadTimeDays: product.leadTimeDays }}
                unit={product.containerVolumeMl && variants.some((v) => v.kind === 'serve') ? 'bottles' : 'units'}
              />
            ) : (
              <p className="text-body-sm text-ink-muted">{category?.name ?? 'This category'} is not stock tracked, so the floor never shows it as low or finished.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
