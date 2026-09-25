import { formatDateTime, formatIsoDate } from '@bliss/shared/format';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { CountBlind, CountReview } from './count-stages';

export const metadata: Metadata = { title: 'Count' };

/**
 * A count, docs/10 N4 screens 2 and 3. Before review the page receives the blind view from the
 * inventory service, which has no expected quantity in it at all. Hiding it here would not be enough.
 */
export default async function CountPage({ params }: { params: Promise<{ countId: string }> }) {
  const { countId } = await params;
  const count = inventory.count(countId);
  if (!count) notFound();
  const outlet = identity.outlet();
  const location = inventory.locations().find((l) => l.id === count.stockLocationId)?.name ?? '';
  const view = inventory.countLines(count.id);
  const describe = (variantId: string) => {
    const variant = catalogue.variantById(variantId);
    const product = variant ? catalogue.productById(variant.productId) : null;
    const serve = catalogue.variants().some((v) => v.productId === product?.id && v.kind === 'serve');
    return { name: variant?.name ?? '', category: product ? (catalogue.categoryById(product.categoryId)?.name ?? '') : '', unit: serve ? 'bottles' : 'units' };
  };
  const title = `${location}, ${count.kind} count, ${formatIsoDate(count.businessDate)}`;
  const meta = `Opened by ${identity.displayName(count.openedBy)} at ${formatDateTime(count.openedAt, outlet.timezone)}${count.notes ? ` · ${count.notes}` : ''}`;

  if (view.stage === 'blind') {
    return (
      <CountBlind
        countId={count.id}
        title={title}
        meta={meta}
        lines={view.lines.map((l) => ({ id: l.id, countedQty: l.countedQty, ...describe(l.productVariantId) }))}
      />
    );
  }

  return (
    <CountReview
      countId={count.id}
      title={title}
      meta={meta}
      status={count.status}
      committedNote={count.committedAt ? `Committed by ${identity.displayName(count.committedBy)} at ${formatDateTime(count.committedAt, outlet.timezone)}. This count is locked.` : null}
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
  );
}
