import { formatQty } from '@bliss/shared/format';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft, IconHistory } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import { StockSettingsForm } from './stock-settings-form';

export const metadata: Metadata = { title: 'Product' };

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

  return (
    <>
      <div className="mb-16 flex flex-wrap items-center justify-between gap-16">
        <ButtonLink href="/console/catalogue/products" variant="ghost" icon={IconArrowLeft} className="-ml-12">
          Products
        </ButtonLink>
        {sealed ? (
          <ButtonLink href={`/console/inventory/movements?variant=${sealed.id}&range=28`} variant="secondary" icon={IconHistory}>
            View movements
          </ButtonLink>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-24 border-b border-hairline pb-20">
        {product.imageKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- the product photograph from the asset store
          <img src={catalogue.imageUrl(product.imageKey, 240, 240) ?? ''} alt="" className="size-[96px] shrink-0 rounded-md object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-12 text-title text-ink">
            {product.name}
            <StatusChip status={product.status === 'active' ? 'active' : 'retired'} label={product.status === 'active' ? 'On sale' : 'Archived'} />
          </h2>
          <p className="mt-4 text-body text-ink-muted">
            {[category?.name, product.brand, `SKU ${product.sku}`, product.containerVolumeMl ? `${product.containerVolumeMl}ml` : null, product.abv ? `${product.abv}% ABV` : null, supplier ? `from ${supplier.name}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {sealed && onHand !== null ? (
          <dl className="flex gap-32">
            <div className="flex flex-col items-end gap-4">
              <dt className="text-label text-ink-subtle">On hand</dt>
              <dd className="font-mono tabular text-num-lg text-ink">{formatQty(onHand, 2)}</dd>
            </div>
            {cost ? (
              <div className="flex flex-col items-end gap-4">
                <dt className="text-label text-ink-subtle">Average cost</dt>
                <dd>
                  <Money value={cost} size="num-lg" />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="mt-24 grid grid-cols-1 gap-40 desktop:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <RevealSection aria-labelledby="product-serves">
          <h3 id="product-serves" className="text-subtitle text-ink">
            Sold as
          </h3>
          <p className="mt-2 text-body-sm text-ink-muted">Each serve takes its share of the bottle. A 30ml tot of a 750ml bottle takes 0.04 of it.</p>
          <div role="table" aria-label="Serves and prices" className="mt-12">
            <div role="row" className="grid gap-16 border-b border-hairline py-8" style={{ gridTemplateColumns: `minmax(160px,1.4fr) 80px 90px 70px repeat(${lists.length}, 110px)` }}>
              {['Serve', 'Pour', 'Of bottle', 'State', ...lists.map((l) => l.name)].map((h, i) => (
                <span key={`${h}-${i}`} role="columnheader" className={i === 0 || i === 3 ? 'text-label text-ink-subtle' : 'text-right text-label text-ink-subtle'}>
                  {h}
                </span>
              ))}
            </div>
            {variants.map((v) => {
              const state = availability.evaluate(v.id);
              return (
                <div key={v.id} role="row" className="grid min-h-row items-center gap-16 border-b border-rule" style={{ gridTemplateColumns: `minmax(160px,1.4fr) 80px 90px 70px repeat(${lists.length}, 110px)` }}>
                  <span role="cell" className="min-w-0">
                    <span className="block truncate text-body text-ink">{v.name}</span>
                    <span className="block text-body-sm text-ink-subtle">{v.kind === 'sealed' ? 'Sealed' : 'By the serve'}</span>
                  </span>
                  <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                    {v.serveVolumeMl ? `${v.serveVolumeMl}ml` : '··'}
                  </span>
                  <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                    {formatQty(v.depletionFactor, 4)}
                  </span>
                  <span role="cell">{state.state === 'available' ? <span className="text-body-sm text-ink-subtle">Available</span> : <StatusChip status={state.reason === 'hold' ? 'on_hold' : state.state} />}</span>
                  {lists.map((l) => {
                    const item = pricing.itemsFor(l.id).find((i) => i.productVariantId === v.id);
                    return (
                      <span key={l.id} role="cell" className="text-right">
                        {item ? <Money value={item.priceCents} currency={false} decimals="whole" tone={l.kind === 'base' ? 'default' : 'accent'} /> : <span className="font-mono tabular text-num text-ink-subtle">··</span>}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {usedIn.length > 0 ? (
            <div className="mt-32">
              <h3 className="text-subtitle text-ink">Used in</h3>
              <ul className="mt-8">
                {usedIn.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-16 border-b border-rule py-8">
                    <span className="text-body text-ink">{r.name}</span>
                    <span className="font-mono tabular text-num-sm text-ink-muted">
                      {r.components
                        .filter((c) => variants.some((v) => v.id === c.componentVariantId))
                        .map((c) => `${formatQty(c.qty, 3)} per serve`)
                        .join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </RevealSection>

        <RevealSection aria-labelledby="product-stock">
          <h3 id="product-stock" className="text-subtitle text-ink">
            Stock settings
          </h3>
          {category?.trackStock ? (
            <StockSettingsForm
              productId={product.id}
              outletDefault={outlet.lowStockDefault}
              initial={{ lowStockThreshold: product.lowStockThreshold, reorderPoint: product.reorderPoint, reorderQty: product.reorderQty, leadTimeDays: product.leadTimeDays }}
              unit={product.containerVolumeMl && variants.some((v) => v.kind === 'serve') ? 'bottles' : 'units'}
            />
          ) : (
            <p className="mt-8 text-body text-ink-muted">{category?.name ?? 'This category'} is not stock tracked, so the floor never shows it as low or finished.</p>
          )}
        </RevealSection>
      </div>
    </>
  );
}
