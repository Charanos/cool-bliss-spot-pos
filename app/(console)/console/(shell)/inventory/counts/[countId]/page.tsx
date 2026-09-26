import { formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { Callout, DetailHeader, MetaRow } from '@bliss/ui/components/console/section';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBuildingWarehouse, IconCalendar, IconClock, IconNote, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { CountBlind, CountReview } from './count-stages';

const KIND = { full: 'Full count', cycle: 'Cycle count', spot: 'Spot check' } as const;

export async function generateMetadata({ params }: { params: Promise<{ countId: string }> }): Promise<Metadata> {
  const { countId } = await params;
  const count = inventory.count(countId);
  return { title: count ? `${KIND[count.kind]}, ${formatIsoDate(count.businessDate)}` : 'Count' };
}

/**
 * A count, docs/10 N4 screens 2 and 3. Before review the page receives the blind view from the
 * inventory service, which has no expected quantity in it at all. Hiding it here would not be enough.
 */
export default async function CountPage({ params }: { params: Promise<{ countId: string }> }) {
  const { countId } = await params;
  const count = inventory.count(countId);
  if (!count) notFound();
  const tz = identity.outlet().timezone;
  const location = inventory.locations().find((l) => l.id === count.stockLocationId)?.name ?? 'A location';
  const view = inventory.countLines(count.id);
  const describe = (variantId: string) => {
    const variant = catalogue.variantById(variantId);
    const product = variant ? catalogue.productById(variant.productId) : null;
    const serve = catalogue.variants().some((v) => v.productId === product?.id && v.kind === 'serve');
    return { name: variant?.name ?? 'Item no longer stocked', category: product ? (catalogue.categoryById(product.categoryId)?.name ?? '') : '', unit: serve ? 'bottles' : 'units' };
  };
  const title = `${KIND[count.kind]}, ${location}`;

  const header = (
    <>
      <RecordCrumb label={KIND[count.kind]} />
      <DetailHeader
        back={{ href: '/console/inventory/counts', label: 'Counts' }}
        title={title}
        status={<StatusChip status={count.status} />}
        meta={
          <MetaRow
            items={[
              { icon: IconCalendar, value: formatIsoDate(count.businessDate) },
              { icon: IconBuildingWarehouse, value: location },
              { icon: IconUser, value: identity.displayName(count.openedBy) },
              { icon: IconClock, value: `Opened ${formatDateTime(count.openedAt, tz)}` },
              count.notes ? { icon: IconNote, value: count.notes } : null,
            ]}
          />
        }
      />
    </>
  );

  if (view.stage === 'blind') {
    return (
      <div className="flex flex-col gap-24">
        {header}
        <CountBlind countId={count.id} lines={view.lines.map((l) => ({ id: l.id, countedQty: l.countedQty, ...describe(l.productVariantId) }))} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-24">
      {header}
      {count.committedAt ? (
        <Callout tone="poured" title={`Committed by ${identity.displayName(count.committedBy)}, ${formatDateTime(count.committedAt, tz)}`}>
          The adjustments are in the stock ledger and this count is locked.
        </Callout>
      ) : null}
      <CountReview
        countId={count.id}
        status={count.status}
        lines={view.lines.map((l) => ({
          id: l.id,
          expectedQty: l.expectedQty,
          countedQty: l.countedQty,
          varianceQty: l.varianceQty,
          varianceCents: l.varianceCents,
          reason: l.reason,
          tolerancePct: l.tolerancePct,
          outside: l.outsideTolerance,
          ...describe(l.productVariantId),
        }))}
      />
    </div>
  );
}
