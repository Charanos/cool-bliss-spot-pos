'use client';

import { formatBps, formatQty } from '@bliss/shared/format';
import { type Cents, formatKes, sum } from '@bliss/shared/money';
import { type BarDatum, BarChart } from '@bliss/ui/components/console/bar-chart';
import { IconTile } from '@bliss/ui/components/console/card';
import { ChartCaption } from '@bliss/ui/components/console/chart-caption';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { IconAlertTriangle, IconArrowRight, IconCheck, IconFlame, IconReceipt2, IconScale, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';

/** Last night's four figures: what came in, what it made, who was served, and what went missing. */
export function HeadlineMetrics(props: {
  netSales: Cents;
  cogs: Cents;
  grossProfit: Cents;
  delta: { bps: number; against: string } | null;
  marginBps: number;
  seats: number;
  tabs: number;
  avgSeatsTenths: number;
  variance: Cents;
  varianceLines: number;
}) {
  return (
    <MetricGrid>
      <Metric
        label="Net sales"
        icon={IconReceipt2}
        href="/console/reports/sales"
        value={<AnimatedMoney value={props.netSales} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" />}
        delta={props.delta}
        detail={props.delta ? undefined : `From ${props.tabs} closed tabs`}
      />
      <Metric
        label="Gross margin"
        icon={IconScale}
        href="/console/reports/performance"
        value={<CountUp value={props.marginBps} format={(n) => formatBps(Math.round(n))} delayMs={60} />}
        detail={`${formatKes(props.grossProfit, { decimals: 'whole' })} after ${formatKes(props.cogs, { decimals: 'whole' })} cost`}
      />
      <Metric
        label="Guests served"
        icon={IconUsers}
        href="/console/reports/seats"
        value={<CountUp value={props.seats} delayMs={120} />}
        detail={`${props.tabs} tabs, ${(props.avgSeatsTenths / 10).toFixed(1)} guests a tab`}
      />
      <Metric
        label="Variance at cost"
        icon={IconAlertTriangle}
        href="/console/reports/pour-variance"
        tone={props.varianceLines > 0 ? 'attention' : 'poured'}
        value={<AnimatedMoney value={props.variance} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" tone={props.varianceLines > 0 ? 'attention' : 'default'} />}
        detail={props.varianceLines > 0 ? `${props.varianceLines} ${props.varianceLines === 1 ? 'line' : 'lines'} outside tolerance` : 'Every line within tolerance'}
      />
    </MetricGrid>
  );
}

/** Last night by the hour, with the busiest hour named above the chart. */
export function SalesByHour({ data }: { data: BarDatum[] }) {
  const peak = data.reduce((max, d) => (d.value > max.value ? d : max), data[0] ?? { key: '', label: '', value: 0n as Cents });
  const total = sum(data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-20 px-20 py-16">
      {data.length > 0 ? (
        <ChartCaption
          icon={<IconFlame size={16} stroke={1.5} />}
          label="Busiest hour"
          figures={[`${peak.label}:00`, <Money key="peak" value={peak.value} size="num-md" decimals="whole" />]}
          note={
            <>
              <Money value={total} size="num-sm" decimals="whole" tone="subtle" /> fired all night
            </>
          }
        />
      ) : null}
      <BarChart data={data} highlightKey={peak.key} caption="Sales by hour, last night" height={220} tooltipLabel={(d) => `${d.label}:00 to ${d.label}:59`} />
    </div>
  );
}

export interface AttentionItem {
  tone: 'stop' | 'low' | 'info';
  text: string;
  href: string;
  cta: string;
}

/** What needs a person, most urgent first. Each row is one link to where it is dealt with. */
export function AttentionBoard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-12 px-20 py-40 text-center">
        <IconTile icon={IconCheck} tone="poured" size="md" />
        <div className="flex flex-col gap-4">
          <p className="text-title-card text-ink">Nothing needs you</p>
          <p className="measure text-body-sm text-ink-muted">No tab left open from an earlier day, no drawer out, no order stuck on a tablet, nothing on hold or short.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.text} className="border-b border-rule last:border-b-0">
          <Link href={item.href} className="group flex min-h-row items-center gap-12 px-20 py-12 transition-hover hover:bg-band focus-visible:bg-band">
            <Dot tone={item.tone === 'info' ? 'info' : item.tone} />
            <span className="min-w-0 flex-1 text-body-sm text-ink">{item.text}</span>
            <span className="inline-flex shrink-0 items-center gap-4 text-body-sm text-ink-muted transition-hover group-hover:text-ink">
              {item.cta}
              <IconArrowRight size={14} stroke={ICON_STROKE} aria-hidden="true" className="transition-transform group-hover:translate-x-2 motion-reduce:transition-none" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface MoverRow {
  productId: string;
  name: string;
  units: number;
  value: Cents;
  marginBps: number | null;
}

export function TopMovers({ rows }: { rows: MoverRow[] }) {
  const columns: Column<MoverRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(140px,2fr)', cell: (r) => <span className="truncate text-ui text-ink">{r.name}</span> },
    { key: 'units', header: 'Sold', width: '72px', align: 'right', cell: (r) => <NumCell>{r.units}</NumCell> },
    { key: 'value', header: 'Sales', width: '112px', align: 'right', cell: (r) => <Money value={r.value} currency={false} size="num-md" decimals="whole" /> },
    { key: 'margin', header: 'Margin', width: '80px', align: 'right', cell: (r) => (r.marginBps === null ? <NumCell tone="muted">No cost</NumCell> : <NumCell tone={r.marginBps < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps)}</NumCell>) },
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
      variant="naked"
      empty={{ title: 'Nothing sold last night', body: 'The best sellers show here after a night of trading.' }}
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
  const tone = (r: VarianceRow) => (r.outside ? (r.variance < 0 ? 'stop' : 'low') : 'muted');
  const columns: Column<VarianceRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(120px,2fr)', cell: (r) => <span className="truncate text-ui text-ink">{r.name}</span> },
    { key: 'expected', header: 'Expected', width: '72px', align: 'right', cell: (r) => <NumCell tone="muted">{formatQty(r.expected, 1)}</NumCell> },
    { key: 'counted', header: 'Counted', width: '72px', align: 'right', cell: (r) => <NumCell>{formatQty(r.counted, 1)}</NumCell> },
    {
      key: 'variance',
      header: 'Variance',
      width: '76px',
      align: 'right',
      cell: (r) => (
        <NumCell tone={tone(r)}>
          {Math.abs(r.variance) < 0.005 ? '0' : `${r.variance > 0 ? '+' : ''}${formatQty(r.variance, 2)}`}
        </NumCell>
      ),
    },
    { key: 'value', header: 'At cost', width: '96px', align: 'right', cell: (r) => <NumCell tone={tone(r)}>{formatKes(r.value, { decimals: 'whole' })}</NumCell> },
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
      variant="naked"
      empty={{ title: 'No variance to show', body: 'Commit a stock count and the lines that came out differently show here.' }}
    />
  );
}
