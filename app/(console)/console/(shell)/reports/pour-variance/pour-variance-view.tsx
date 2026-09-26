'use client';

import { formatQty } from '@bliss/shared/format';
import { type Cents, formatDecimal, isPositive } from '@bliss/shared/money';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { IconAlertTriangle, IconBottle, IconCheck, IconDroplet } from '@tabler/icons-react';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import type { PourVarianceRow } from '@/modules/reporting/service';

/**
 * Positive variance means more left the shelf than was sold: over-pouring, spillage, or bottles
 * walking. Negative means under-pouring or unrecorded deliveries. Both matter; the sign says which.
 */
export function PourVarianceView({
  period,
  rows,
  lost,
  outside,
  worst,
  canSeeCost,
}: {
  period: string;
  rows: PourVarianceRow[];
  lost: Cents;
  outside: number;
  worst: { name: string; ml: number } | null;
  canSeeCost: boolean;
}) {
  const columns: Column<PourVarianceRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(160px,1.5fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="truncate text-ui text-ink">{r.name}</span> },
    { key: 'sold', header: 'Sold, bottles', width: '110px', align: 'right', sortValue: (r) => r.theoreticalUnits, csv: (r) => r.theoreticalUnits.toFixed(3), cell: (r) => <NumCell tone="muted">{formatQty(r.theoreticalUnits, 2)}</NumCell> },
    { key: 'used', header: 'Counted out', width: '110px', align: 'right', sortValue: (r) => r.actualUnits, csv: (r) => r.actualUnits.toFixed(3), cell: (r) => <NumCell tone="muted">{formatQty(r.actualUnits, 2)}</NumCell> },
    {
      key: 'units',
      header: 'Variance',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.varianceUnits,
      csv: (r) => r.varianceUnits.toFixed(3),
      cell: (r) => <NumCell tone={r.outside ? (r.varianceUnits > 0 ? 'stop' : 'low') : 'default'}>{`${r.varianceUnits > 0 ? '+' : ''}${formatQty(r.varianceUnits, 2)}`}</NumCell>,
    },
    { key: 'ml', header: 'Millilitres', width: '100px', align: 'right', sortValue: (r) => r.varianceMl, csv: (r) => r.varianceMl, cell: (r) => <NumCell tone="muted">{`${r.varianceMl > 0 ? '+' : ''}${r.varianceMl.toLocaleString('en-KE')}ml`}</NumCell> },
    {
      key: 'pct',
      header: 'Of sold',
      width: '120px',
      align: 'right',
      sortValue: (r) => Math.abs(r.variancePct),
      csv: (r) => r.variancePct.toFixed(2),
      cell: (r) => (
        <span className="flex flex-col items-end">
          <NumCell tone={r.outside ? 'stop' : 'muted'}>{`${r.variancePct > 0 ? '+' : ''}${r.variancePct.toFixed(1)}%`}</NumCell>
          <span className="font-mono tabular text-num-sm text-ink-subtle">allow {r.tolerancePct}%</span>
        </span>
      ),
    },
    ...(canSeeCost
      ? [
          {
            key: 'value',
            header: 'At cost',
            width: '110px',
            align: 'right' as const,
            sortValue: (r: PourVarianceRow) => r.varianceCents,
            csv: (r: PourVarianceRow) => formatDecimal(r.varianceCents),
            cell: (r: PourVarianceRow) => <Money value={r.varianceCents} currency={false} size="num-md" decimals="whole" tone={r.outside ? 'attention' : 'muted'} />,
          },
        ]
      : []),
    { key: 'state', header: 'Tolerance', width: '120px', sortValue: (r) => (r.outside ? 0 : 1), csv: (r) => (r.outside ? 'outside' : 'within'), cell: (r) => (r.outside ? <StatusChip status="low" label="Outside" /> : <span className="text-body-sm text-ink-subtle">Within</span>) },
  ];

  return (
    <div className="flex flex-col gap-32">
      <p className="measure text-ui text-ink-muted">Between the last two full counts of the bar shelf, {period}: what sold serves say should have gone, against what the counts say went.</p>
      <MetricGrid columns={canSeeCost ? 4 : 3}>
        {canSeeCost ? <Metric label="Lost at cost" icon={IconDroplet} tone={isPositive(lost) ? 'attention' : 'default'} value={<Money value={lost} size="num-kpi" decimals="whole" />} detail="More out than sold, at average cost" /> : null}
        <Metric label="Outside tolerance" icon={IconAlertTriangle} tone={outside > 0 ? 'stop' : 'poured'} value={<CountUp value={outside} />} detail={`Of ${rows.length} products poured by the serve`} />
        <Metric
          label="Largest gap"
          icon={IconBottle}
          value={worst ? `${Math.abs(worst.ml).toLocaleString('en-KE')}ml` : 'None'}
          detail={worst ? `${worst.name}, ${worst.ml > 0 ? 'more out than sold' : 'less out than sold'}` : 'Every product within tolerance'}
        />
        <Metric label="Within tolerance" icon={IconCheck} tone="poured" value={<CountUp value={rows.length - outside} delayMs={60} />} detail="Poured as sold" />
      </MetricGrid>
      <DataTable
        id="report-pour-variance"
        caption="Pour variance by product"
        noun={['product', 'products']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.variantId}
        defaultSort={{ key: canSeeCost ? 'value' : 'pct', dir: 'desc' }}
        filters={[{ kind: 'toggle', key: 'outside', label: 'Outside tolerance only', test: (r) => r.outside }]}
        rowTone={(r) => (r.outside ? 'attention' : 'default')}
        exportName="pour-variance"
        empty={{ title: 'No spirits or wine counted', body: 'Pour variance covers products poured by the serve.' }}
        emptyFiltered={{ title: 'Everything is within tolerance', body: 'Turn off the toggle to see every product.' }}
      />
    </div>
  );
}
