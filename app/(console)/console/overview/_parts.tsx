'use client';

import { formatBps, formatQty } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import { type BarDatum, BarChart } from '@bliss/ui/components/console/bar-chart';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';

export function HeadlineMetrics(props: {
  netSales: Cents;
  delta: { bps: number; against: string } | null;
  marginBps: number;
  seats: number;
  tabs: number;
  avgSeatsTenths: number;
  variance: Cents;
  varianceLines: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
      <Metric label="Net sales" value={<AnimatedMoney value={props.netSales} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />} delta={props.delta} />
      <Metric label="Gross margin" value={<CountUp value={props.marginBps} format={(n) => formatBps(Math.round(n))} delayMs={60} />} detail="At cost, excluding VAT" />
      <Metric
        label="Seats served"
        value={<CountUp value={props.seats} delayMs={120} />}
        detail={`${props.tabs} tabs, ${(props.avgSeatsTenths / 10).toFixed(1)} avg seats`}
      />
      <Metric
        label="Variance at cost"
        tone="attention"
        value={<AnimatedMoney value={props.variance} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" tone="attention" />}
        detail={props.varianceLines > 0 ? `${props.varianceLines} ${props.varianceLines === 1 ? 'line' : 'lines'} outside tolerance` : 'Everything within tolerance'}
      />
    </div>
  );
}

export function SalesByHour({ data }: { data: BarDatum[] }) {
  return <BarChart data={data} caption="Sales by hour, last night" height={220} />;
}

interface MoverRow {
  productId: string;
  name: string;
  units: number;
  value: Cents;
  marginBps: number;
}

export function TopMovers({ rows }: { rows: MoverRow[] }) {
  const columns: Column<MoverRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(140px,2fr)', cell: (r) => <span className="text-body text-ink">{r.name}</span> },
    { key: 'units', header: 'Units', width: '64px', align: 'right', cell: (r) => <NumCell>{r.units}</NumCell> },
    { key: 'value', header: 'Value', width: '110px', align: 'right', cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
    { key: 'margin', header: 'Margin', width: '72px', align: 'right', cell: (r) => <NumCell tone={r.marginBps < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps)}</NumCell> },
  ];
  return (
    <DataTable
      id="overview-movers"
      caption="Top movers last night"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.productId}
      toolbar={false}
      urlState={false}
      empty={{ title: 'Nothing sold last night', body: 'The movers appear after the first night of trading.' }}
    />
  );
}

interface VarianceRow {
  variantId: string;
  name: string;
  expected: number;
  counted: number;
  variance: number;
  value: Cents;
  outside: boolean;
}

export function VarianceByProduct({ rows }: { rows: VarianceRow[] }) {
  const columns: Column<VarianceRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(120px,2fr)', cell: (r) => <span className="text-body text-ink">{r.name}</span> },
    { key: 'expected', header: 'Expected', width: '76px', align: 'right', cell: (r) => <NumCell tone="muted">{formatQty(r.expected, 1)}</NumCell> },
    { key: 'counted', header: 'Counted', width: '76px', align: 'right', cell: (r) => <NumCell>{formatQty(r.counted, 1)}</NumCell> },
    { key: 'variance', header: 'Variance', width: '76px', align: 'right', cell: (r) => <NumCell tone={r.outside ? (r.variance < 0 ? 'stop' : 'low') : 'muted'}>{r.variance > 0 ? '+' : ''}{formatQty(r.variance, 2)}</NumCell> },
    { key: 'value', header: 'At cost', width: '100px', align: 'right', cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
  ];
  return (
    <DataTable
      id="overview-variance"
      caption="Variance by product, latest committed count"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.variantId}
      toolbar={false}
      urlState={false}
      empty={{ title: 'No variance to report', body: 'Everything counted within tolerance for this period.' }}
    />
  );
}
