import { formatBps, plural } from '@bliss/shared/format';
import { add, formatKes } from '@bliss/shared/money';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { IconReceipt, IconReceiptOff, IconScale, IconUsers } from '@tabler/icons-react';
import type { OverviewData } from '../_data';

/**
 * The night in four figures beside the takings in the head: the average bill, the margin on what
 * carries a cost, the guests served, and what was taken back. Each opens the report it comes from.
 */
export function OverviewKpis({ d }: { d: OverviewData }) {
  const h = d.headline;
  const s = d.summary;
  const takenBack = add(s.voids, s.discounts);
  return (
    <MetricGrid>
      <Metric
        label="Average bill"
        icon={IconReceipt}
        href="/console/trade/bills?range=tonight"
        value={<Money value={s.averageBill} size="num-kpi" decimals="whole" />}
        delta={s.deltaBps === null ? null : { bps: s.deltaBps, against: 'a week before' }}
        detail={s.deltaBps === null ? `Across ${plural(s.bills, 'bill')}` : undefined}
      />
      <Metric
        label="Gross margin"
        icon={IconScale}
        href="/console/reports/performance"
        tone={h.grossMarginBps === null ? 'default' : h.grossMarginBps < 3500 ? 'attention' : 'poured'}
        value={h.grossMarginBps === null ? <span className="font-sans text-title-section text-ink-muted">Not costed</span> : formatBps(h.grossMarginBps)}
        detail={
          h.grossMarginBps === null || h.grossProfit === null
            ? 'Set unit costs to see profit'
            : `${formatKes(h.grossProfit, { decimals: 'round' })} profit${h.costCoverageBps < 9_950 ? ` on ${formatBps(h.costCoverageBps)} of sales` : ''}`
        }
      />
      <Metric
        label="Guests served"
        icon={IconUsers}
        href="/console/reports/seats"
        value={h.seatsServed}
        detail={h.tabs > 0 ? `${plural(h.tabs, 'tab')}, ${h.avgSeats.toFixed(1)} a tab` : 'No tabs yet'}
      />
      <Metric
        label="Voids and discounts"
        icon={IconReceiptOff}
        href="/console/reports/voids"
        tone={s.voidLines > 0 ? 'attention' : 'default'}
        value={<Money value={takenBack} size="num-kpi" decimals="whole" tone={s.voidLines > 0 ? 'attention' : 'default'} />}
        detail={s.voidLines > 0 || s.discounts > 0n ? `${plural(s.voidLines, 'line')} voided, ${formatKes(s.discounts, { decimals: 'round' })} off` : 'Nothing voided or discounted'}
      />
    </MetricGrid>
  );
}
