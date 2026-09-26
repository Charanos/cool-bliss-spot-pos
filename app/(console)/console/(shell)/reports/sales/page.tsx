import { plural } from '@bliss/shared/format';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import { TENDER_LABEL } from '../../_lib/labels';
import { businessRange, rangeOptions } from '../../_lib/range';
import { SalesReport } from './sales-report';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Sales' };

/** Sales, for a range of business days against the same number before it. Margin needs report.margin. */
export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const actor = await identity.currentConsoleActor();
  const canSeeMargin = identity.can(actor.staffId, 'report.margin');
  const summary = reporting.salesSummary(range.from, range.to, range.previous);
  const days = reporting.salesByDay(range.from, range.to);
  const single = range.from === range.to;

  return (
    <>
      <ViewHeader page="/console/reports/sales" />

    <SalesReport
      rangeKey={range.key}
      rangeOptions={rangeOptions(false)}
      rangeLabel={range.label}
      summary={{ ...summary, grossMarginBps: canSeeMargin ? summary.grossMarginBps : null }}
      chart={
        single
          ? reporting.salesByHour(range.to).map((h) => ({ key: h.hour, label: h.hour.slice(0, 2), value: h.value }))
          : days.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.value }))
      }
      chartCaption={single ? `Sales by hour, ${range.label}` : `Sales by business day, ${range.label}`}
      categories={reporting
        .salesByCategory(range.from, range.to)
        .filter((c) => c.units > 0)
        .map((c) => ({ id: c.categoryId, name: c.name, units: c.units, value: c.value, shareBps: c.shareBps, marginBps: canSeeMargin ? c.marginBps : null }))}
      movers={reporting.topMovers(range.from, range.to, 12).map((m) => ({ ...m, marginBps: canSeeMargin ? m.marginBps : null }))}
      tenders={settlement.tenderMix(range.from, range.to).map((t) => ({ key: t.kind, label: TENDER_LABEL[t.kind], value: t.amount, detail: plural(t.count, 'tender') }))}
      exportDate={range.to}
    />
    </>
  );
}
