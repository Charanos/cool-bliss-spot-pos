import { formatDate, formatQty } from '@bliss/shared/format';
import { ZERO, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ActionPill } from '@bliss/ui/components/console/action-pill';
import { Card, CardBody, CardHeader, CardMedia } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { Sparkline } from '@bliss/ui/components/console/sparkline';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBottle, IconCash, IconCategory, IconChartBar, IconHistory, IconScale } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { assetUrl } from '@/lib/assets';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ProductActions, VariantsCard, type VariantRow } from '../../_parts/product-record';
import { StockSettingsForm } from './stock-settings-form';

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  return { title: catalogue.productById(productId)?.name ?? 'Product' };
}

const DAYS = 14;

/**
 * A product and everything about it in one place: how it is sold and at what price on every list,
 * its stock and the lots it came in, who supplies it and at what cost, what it sold over the last
 * fortnight, and every record it touches, each a link.
 */
export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = catalogue.productById(productId);
  if (!product) notFound();
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'price.write');
  const canCost = identity.can(actor.staffId, 'cost.read');
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const category = catalogue.categoryById(product.categoryId);
  const variants = catalogue
    .variants()
    .filter((v) => v.productId === product.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const variantIds = new Set(variants.map((v) => v.id));
  const lists = pricing
    .priceLists()
    .filter((l) => l.status === 'active')
    .sort((a, b) => (a.kind === b.kind ? b.priority - a.priority : a.kind === 'base' ? -1 : 1));
  const sealed = variants.find((v) => v.kind === 'sealed' && v.status === 'active');
  const onHand = sealed ? inventory.onHand(sealed.id) : null;
  const unit = product.containerVolumeMl ? 'btl' : 'units';
  const supplier = procurement.supplierById(product.defaultSupplierId);
  const supplied = sealed ? procurement.supplierProducts().filter((sp) => sp.productVariantId === sealed.id) : [];
  const usedIn = inventory.recipes().filter((r) => r.components.some((c) => variantIds.has(c.componentVariantId)));
  const cost = sealed ? inventory.averageCost(sealed.id) : null;
  const threshold = product.lowStockThreshold ?? outlet.lowStockDefault;
  const holds = inventory.activeHolds().filter((h) => variantIds.has(h.productVariantId));
  const batches = sealed ? inventory.batchesForVariant(sealed.id).filter((b) => b.remainingQty > 0).sort((a, b) => (a.expiryDate ?? Infinity) - (b.expiryDate ?? Infinity)) : [];
  const openOrders = procurement
    .purchaseOrders()
    .filter((o) => (o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received') && procurement.purchaseOrderLines(o.id).some((l) => variantIds.has(l.productVariantId)));
  const deliveries = procurement
    .receipts()
    .filter((r) => procurement.receiptLines(r.id).some((l) => variantIds.has(l.productVariantId)))
    .slice(0, 4);

  // The last fortnight, day by day: how many sold, and what they brought in.
  const to = reporting.clock().lastNight;
  const days = Array.from({ length: DAYS }, (_, i) => addDays(to, i - DAYS + 1));
  const daily = days.map((d) => trade.linesBetween(d, d).filter((l) => variantIds.has(l.productVariantId)));
  const soldByDay = daily.map((lines) => lines.reduce((n, l) => n + l.qty, 0));
  const takings = sum(daily.flat().map((l) => l.lineTotalCents));
  const sold = soldByDay.reduce((a, b) => a + b, 0);
  const velocity = sealed ? inventory.velocityPerDay(sealed.id) : 0;
  const cover = onHand !== null && velocity > 0 ? onHand / velocity : null;

  const rows: VariantRow[] = variants.map((v) => {
    const state = availability.evaluate(v.id);
    return {
      id: v.id,
      name: v.name,
      kind: v.kind,
      serveVolumeMl: v.serveVolumeMl,
      depletionFactor: v.depletionFactor,
      barcode: v.barcode,
      isDefault: v.isDefault,
      status: v.status,
      state: state.state === 'available' ? null : state.reason === 'hold' ? 'on_hold' : state.state,
      prices: lists.map((l) => pricing.itemsFor(l.id).find((x) => x.productVariantId === v.id)?.priceCents ?? null),
    };
  });

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={product.name} />
      <DetailHeader
        back={{ href: '/console/catalogue/products', label: 'Products' }}
        title={product.name}
        status={<StatusChip status={product.status === 'active' ? 'active' : 'retired'} label={product.status === 'active' ? 'On sale' : 'Archived'} />}
        meta={
          <MetaRow
            items={[
              category ? { icon: IconCategory, value: <EntityLink kind="category" id={category.id} muted>{category.name}</EntityLink> } : null,
              product.brand ? { value: product.brand } : null,
              { label: 'SKU', value: product.sku },
              product.containerVolumeMl ? { icon: IconBottle, value: `${product.containerVolumeMl}ml` } : null,
              product.abv ? { value: `${product.abv}% ABV` } : null,
            ]}
          />
        }
        actions={
          <>
            {sealed ? (
              <ButtonLink href={`/console/inventory/movements?variant=${sealed.id}&range=28`} variant="ghost" icon={IconHistory}>
                Movements
              </ButtonLink>
            ) : null}
            <ProductActions
              product={{ id: product.id, categoryId: product.categoryId, name: product.name, brand: product.brand, sku: product.sku, barcode: product.barcode, containerVolumeMl: product.containerVolumeMl, abv: product.abv, defaultSupplierId: product.defaultSupplierId, imageKey: product.imageKey }}
              status={product.status}
              categories={catalogue.categories().filter((c) => c.status === 'active').map((c) => ({ value: c.id, label: c.name }))}
              suppliers={procurement.suppliers().filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.name }))}
              canEdit={canEdit}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-16 desktop:grid-cols-[minmax(280px,1fr)_minmax(0,3fr)]">
        <Card className="group">
          <CardMedia src={assetUrl(product.imageKey, 640, 360)} title={product.name} subtitle={category?.name} />
          <CardBody className="flex flex-col gap-8 pt-16">
            <span className="label-caps text-ink-subtle">Sold, last {DAYS} days</span>
            <Sparkline values={soldByDay} label={`${sold} sold over the last ${DAYS} days`} highlight="last" />
            <span className="flex items-baseline justify-between text-body-sm text-ink-muted">
              <span className="tabular">{formatQty(sold, 1)} sold</span>
              <Money value={takings} size="num-md" decimals="whole" />
            </span>
          </CardBody>
        </Card>
        <MetricGrid columns={3} className="desktop:grid-cols-3">
          <Metric
            label="On hand"
            icon={IconBottle}
            tone={onHand === null ? 'default' : onHand <= 0 ? 'stop' : onHand <= threshold ? 'attention' : 'default'}
            value={onHand === null ? 'Not kept' : `${formatQty(onHand, 2)}`}
            detail={onHand === null ? `${category?.name ?? 'Its category'} is not counted` : cover !== null ? `${unit}, about ${formatQty(cover, 1)} days at this pace` : `${unit}, low at ${threshold}`}
            href={sealed ? `/console/inventory/stock?q=${encodeURIComponent(product.name)}` : undefined}
          />
          <Metric label="Average cost" icon={IconScale} value={canCost && cost ? <Money value={cost} size="num-kpi" /> : 'Hidden'} detail={canCost ? 'Each, from deliveries' : 'Needs the cost permission'} />
          <Metric label={`Takings, ${DAYS} days`} icon={IconCash} tone="poured" value={<Money value={takings} size="num-kpi" decimals="whole" />} detail={`${formatQty(sold, 1)} sold`} href="/console/reports/performance" />
        </MetricGrid>
      </div>

      <VariantsCard productId={product.id} productName={product.name} variants={rows} lists={lists.map((l) => ({ id: l.id, name: l.name, kind: l.kind }))} canEdit={canEdit} />

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="product-supply">
            <CardHeader
              band
              level="h2"
              titleId="product-supply"
              title="Supply"
              subtitle={supplier ? <>Usually from <EntityLink kind="supplier" id={supplier.id}>{supplier.name}</EntityLink></> : 'No usual supplier set'}
              actions={supplier && canCost ? <ActionPill href={`/console/purchasing/orders/new?supplier=${supplier.id}${sealed ? `&item=${sealed.id}` : ''}`}>Order</ActionPill> : null}
            />
            {supplied.length === 0 && openOrders.length === 0 && deliveries.length === 0 ? (
              <CardBody className="pt-16">
                <p className="text-body-sm text-ink-muted">No supplier carries it yet, and nothing has been ordered or delivered.</p>
              </CardBody>
            ) : (
              <LedgerList label="Supply">
                {supplied.map((sp) => {
                  const s = procurement.supplierById(sp.supplierId);
                  const history = [...sp.history].sort((a, b) => a.at - b.at).map((h) => Number(h.costCents));
                  return (
                    <LedgerItem key={sp.id}>
                      <span className="flex items-center justify-between gap-16">
                        <span className="min-w-0">
                          <EntityLink kind="supplier" id={sp.supplierId} className="text-ui">
                            {s?.name ?? 'A supplier'}
                          </EntityLink>
                          <span className="block text-body-sm text-ink-subtle">
                            Pack of {sp.packSize}
                            {sp.supplierSku ? `, their code ${sp.supplierSku}` : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-16">
                          {history.length > 1 ? <Sparkline variant="line" values={history} label="Cost over its deliveries" className="w-72" /> : null}
                          {canCost ? <Money value={sp.lastCostCents} size="num-md" /> : null}
                        </span>
                      </span>
                    </LedgerItem>
                  );
                })}
                {openOrders.map((o) => (
                  <LedgerItem key={o.id} tone="low">
                    <span className="flex items-center justify-between gap-16">
                      <EntityLink kind="order" id={o.id} className="text-ui">
                        Order {o.poNumber}, {procurement.supplierById(o.supplierId)?.name}
                      </EntityLink>
                      <span className="text-body-sm text-ink-muted">{o.expectedAt ? `Due ${formatDate(o.expectedAt, tz)}` : 'On its way'}</span>
                    </span>
                  </LedgerItem>
                ))}
                {deliveries.map((r) => (
                  <LedgerItem key={r.id} tone="poured">
                    <span className="flex items-center justify-between gap-16">
                      <EntityLink kind="receipt" id={r.id} className="text-ui">
                        Delivery {r.grnNumber}, {procurement.supplierById(r.supplierId)?.name}
                      </EntityLink>
                      <span className="text-body-sm text-ink-muted">{formatDate(r.receivedAt, tz)}</span>
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            )}
          </Card>

          {batches.length > 0 ? (
            <Card aria-labelledby="product-batches">
              <CardHeader band level="h2" titleId="product-batches" title="Lots on hand" subtitle="What came in on each delivery, and what is left. The floor sells the one that expires first." />
              <LedgerList label="Lots">
                {batches.map((b) => (
                  <LedgerItem key={b.id}>
                    <span className="flex items-center justify-between gap-16">
                      <span className="min-w-0">
                        <span className="block text-ui text-ink">{b.batchNumber ?? 'No batch number'}</span>
                        <span className="block text-body-sm text-ink-subtle">
                          In {formatDate(b.receivedAt, tz)}
                          {b.expiryDate ? `, expires ${formatDate(b.expiryDate, tz)}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-12">
                        <InlineBar value={b.initialQty > 0 ? b.remainingQty / b.initialQty : 0} tone={b.expiryDate && b.expiryDate < Date.now() + 14 * 86_400_000 ? 'attention' : 'accent'} />
                        <span className="font-mono tabular text-num-md text-ink">
                          {formatQty(b.remainingQty, 2)} of {formatQty(b.initialQty, 2)}
                        </span>
                      </span>
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            </Card>
          ) : null}

          {usedIn.length > 0 ? (
            <Card aria-labelledby="product-used-in">
              <CardHeader band level="h2" titleId="product-used-in" title="Used in" subtitle="Recipes that take this product's stock." />
              <LedgerList label="Recipes">
                {usedIn.map((r) => (
                  <LedgerItem key={r.id}>
                    <span className="flex items-baseline justify-between gap-16">
                      <EntityLink kind="recipe" id={r.id} className="text-ui">
                        {r.name}
                      </EntityLink>
                      <span className="font-mono tabular text-num-md text-ink-muted">
                        {r.components
                          .filter((c) => variantIds.has(c.componentVariantId))
                          .map((c) => `${formatQty(c.qty, 3)} a serve`)
                          .join(', ')}
                      </span>
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-24">
          {holds.length > 0 ? (
            <Card tone="low" aria-labelledby="product-holds">
              <CardHeader band level="h2" titleId="product-holds" title="On hold" subtitle="The floor cannot sell these." actions={<ActionPill href="/console/inventory/holds">Holds</ActionPill>} />
              <LedgerList label="Holds">
                {holds.map((h) => (
                  <LedgerItem key={h.id} tone="low">
                    <span className="block text-ui text-ink">{catalogue.variantById(h.productVariantId)?.name}</span>
                    <span className="block text-body-sm text-ink-muted">
                      {h.reason}
                      {h.expectedBack ? `, back ${h.expectedBack}` : ''}
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            </Card>
          ) : null}

          <Card aria-labelledby="product-stock">
            <CardHeader band level="h2" titleId="product-stock" title="Stock settings" subtitle="When the floor warns, and when to reorder." icon={IconChartBar} />
            <CardBody className="pt-20">
              {category?.trackStock ? (
                <StockSettingsForm
                  productId={product.id}
                  outletDefault={outlet.lowStockDefault}
                  initial={{ lowStockThreshold: product.lowStockThreshold, reorderPoint: product.reorderPoint, reorderQty: product.reorderQty, leadTimeDays: product.leadTimeDays }}
                  unit={product.containerVolumeMl && variants.some((v) => v.kind === 'serve') ? 'bottles' : 'units'}
                />
              ) : (
                <p className="text-body-sm text-ink-muted">
                  <EntityLink kind="category" id={category?.id}>{category?.name ?? 'This category'}</EntityLink> is not stock tracked, so the floor never shows it as low or finished.
                </p>
              )}
            </CardBody>
          </Card>

          {cost && canCost && onHand !== null ? (
            <Card aria-labelledby="product-value">
              <CardHeader band level="h2" titleId="product-value" title="Value on hand" />
              <CardBody className="flex items-baseline justify-between pt-16">
                <span className="text-body-sm text-ink-muted">At average cost</span>
                <Money value={onHand > 0 ? inventory.valueAtCost(sealed!.id, onHand) : ZERO} size="num-lg" decimals="whole" />
              </CardBody>
            </Card>
          ) : null}

        </div>
      </div>
    </div>
  );
}
