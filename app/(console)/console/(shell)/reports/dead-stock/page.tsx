import { sum } from '@bliss/shared/money';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import { ViewHeader } from '../../_components/workspace';
import { DeadStockTable } from './dead-stock-table';

export const metadata: Metadata = { title: 'Dead stock' };

const WINDOWS = [30, 60, 90] as const;

/** N-16: stock with no sale in the window, largest value first. Money sitting on a shelf. */
export default async function DeadStockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const days = WINDOWS.find((w) => String(w) === params.days) ?? 60;
  const actor = await identity.currentConsoleActor();
  const rows = reporting.deadStock(days).map((r) => ({ ...r, category: catalogue.categoryOfVariant(r.variantId)?.name ?? '', productId: catalogue.productOfVariant(r.variantId)?.id ?? null }));
  return (
    <>
      <ViewHeader page="/console/reports/dead-stock" />
      <DeadStockTable
        rows={rows}
        days={days}
        total={sum(rows.map((r) => r.value))}
        canSeeCost={identity.can(actor.staffId, 'cost.read')}
        timezone={identity.outlet().timezone}
        windows={WINDOWS.map((w) => ({ value: String(w), label: `No sale in ${w} days` }))}
      />
    </>
  );
}
