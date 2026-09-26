import { type Cents, ZERO, add, compare, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import { Card, CardFooter, CardGroup, CardMedia, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';
import { IconBottle, IconCash, IconPrinter, IconTag } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { assetUrl } from '@/lib/assets';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { CategoryActions } from './category-actions';

export async function generateMetadata({ params }: { params: Promise<{ categoryId: string }> }): Promise<Metadata> {
  const { categoryId } = await params;
  return { title: catalogue.categoryById(categoryId)?.name ?? 'Category' };
}

const ROUTING: Record<string, string> = { bar: 'Prints at the bar', kitchen: 'Prints in the kitchen', none: 'Prints nowhere' };
const DAYS = 28;

/** A category: its tab on the floor, what it sells, and what those products took. */
export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const category = catalogue.categoryById(categoryId);
  if (!category) notFound();
  const actor = await identity.currentConsoleActor();
  const products = catalogue.products().filter((p) => p.categoryId === category.id);
  const onSale = products.filter((p) => p.status === 'active');
  const base = pricingManage.defaultList();
  const baseItems = base ? pricing.itemsFor(base.id) : [];
  const to = reporting.clock().lastNight;
  const from = addDays(to, -DAYS + 1);
  const lines = trade.linesBetween(from, to).filter((l) => catalogue.productOfVariant(l.productVariantId)?.categoryId === category.id);
  const takings = sum(lines.map((l) => l.lineTotalCents));
  const byProduct = new Map<string, Cents>();
  for (const l of lines) {
    const p = catalogue.productOfVariant(l.productVariantId)!;
    byProduct.set(p.id, add(byProduct.get(p.id) ?? ZERO, l.lineTotalCents));
  }
  const position = catalogue.categories().filter((c) => c.status === 'active').findIndex((c) => c.id === category.id) + 1;

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={category.name} />
      <DetailHeader
        back={{ href: '/console/catalogue/categories', label: 'Categories' }}
        title={
          <span className="flex items-center gap-12">
            <span aria-hidden="true" className={cx('h-control-md w-4 rounded-sm', categoryEdgeClass(category.colourToken))} />
            {category.name}
          </span>
        }
        status={<StatusChip status={category.status === 'active' ? 'active' : 'retired'} label={category.status === 'active' ? `Tab ${position} on the floor` : 'Archived'} />}
        meta={<MetaRow items={[{ icon: IconPrinter, value: ROUTING[category.routingTarget] }, { value: category.trackStock ? 'Stock counted' : 'Stock not counted' }]} />}
        actions={<CategoryActions category={{ id: category.id, name: category.name, colour: category.colourToken, routingTarget: category.routingTarget, trackStock: category.trackStock }} active={category.status === 'active'} canEdit={identity.can(actor.staffId, 'price.write')} />}
      />

      <MetricGrid columns={3}>
        <Metric label="On sale" icon={IconBottle} value={String(onSale.length)} detail={products.length > onSale.length ? `${products.length - onSale.length} archived` : 'None archived'} />
        <Metric label={`Takings, ${DAYS} days`} icon={IconCash} tone="poured" value={<Money value={takings} size="num-kpi" decimals="whole" />} detail={`${lines.reduce((n, l) => n + l.qty, 0)} sold`} href="/console/reports/performance" />
        <Metric label="Priced on base" icon={IconTag} value={`${onSale.filter((p) => catalogue.variants().some((v) => v.productId === p.id && baseItems.some((i) => i.productVariantId === v.id))).length} of ${onSale.length}`} detail={base ? `On ${base.name}` : 'No base list'} />
      </MetricGrid>

      <CardGroup title="Products" description="Busiest first over the last four weeks." gridClassName="pad:grid-cols-2 desktop:grid-cols-4">
        {products.length === 0 ? (
          <EmptyState title="Nothing in this category yet" body="Add a product and choose this category for it." />
        ) : (
          [...products]
            .sort((a, b) => compare(byProduct.get(b.id) ?? ZERO, byProduct.get(a.id) ?? ZERO) || a.name.localeCompare(b.name))
            .map((p) => {
              const own = catalogue.variants().filter((v) => v.productId === p.id && v.status === 'active');
              return (
                <Card key={p.id} as="article" interactive className="group">
                  <CardMedia src={assetUrl(p.imageKey, 480, 320)} title={p.name} subtitle={p.sku} href={`/console/catalogue/products/${p.id}`} meta={p.status === 'archived' ? <StatusChip status="retired" label="Archived" /> : null} />
                  <CardStats columns={2}>
                    <Stat label="Sold as">{own.length}</Stat>
                    <Stat label={`${DAYS} days`}>
                      <Money value={byProduct.get(p.id) ?? ZERO} currency={false} size="num-md" decimals="whole" />
                    </Stat>
                  </CardStats>
                  <CardFooter>
                    <span className="truncate text-body-sm text-ink-muted">{own.map((v) => v.name.replace(p.name, '').trim() || v.name).join(', ') || 'Not sold yet'}</span>
                  </CardFooter>
                </Card>
              );
            })
        )}
      </CardGroup>
    </div>
  );
}
