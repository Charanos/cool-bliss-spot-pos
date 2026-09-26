import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { BillsView, type BillRow } from './bills-view';

export const metadata: Metadata = { title: 'Bills' };

/** Settled bills for a range of business days, with how they were paid as the cashier recorded it. */
export default async function BillsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  // Tonight while the bar is trading; last night once it has closed, when "tonight" is not a choice.
  const range = businessRange(params.range, reporting.clock().tradingInProgress ? 'tonight' : '1');
  const outlet = identity.outlet();
  const tenders = settlement.tendersByBill();

  const rows: BillRow[] = settlement
    .billsBetween(range.from, range.to)
    .filter((b) => b.status !== 'open')
    .map((b) => {
      const tab = b.tabId ? trade.tabById(b.tabId) : null;
      const seat = b.tabSeatId && tab ? trade.seatsFor(tab.id).find((s) => s.id === b.tabSeatId) : null;
      const own = tenders.get(b.id) ?? [];
      return {
        id: b.id,
        number: b.billNumber,
        businessDate: b.businessDate,
        settledAt: b.settledAt,
        table: tab ? (trade.tableById(tab.serviceTableId)?.label ?? tab.name ?? 'Walk up') : 'Quick sale',
        tabId: tab?.id ?? null,
        scope: b.scope,
        seatNo: seat?.seatNo ?? null,
        tenders: own.map((t) => ({ kind: t.kind, amount: t.amountCents, reference: t.reference })),
        tenderKinds: [...new Set(own.map((t) => t.kind))],
        settledBy: identity.displayName(b.settledBy),
        settledById: b.settledBy ?? '',
        discount: b.discountCents,
        total: b.totalCents,
        status: b.status,
      };
    });

  return (
    <BillsView
      rows={rows}
      timezone={outlet.timezone}
      rangeOptions={rangeOptions(true)}
      rangeKey={range.key}
      rangeLabel={range.label}
      mix={settlement.tenderMix(range.from, range.to)}
      cashiers={[...new Map(rows.map((r) => [r.settledById, r.settledBy])).entries()].filter(([id]) => id).map(([value, label]) => ({ value, label }))}
      exportDate={range.to}
    />
  );
}
