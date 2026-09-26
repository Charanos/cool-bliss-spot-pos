'use client';

import { formatBps, formatDayShort } from '@bliss/shared/format';
import { type Cents, compare, formatDecimal, isPositive } from '@bliss/shared/money';
import { ChartCaption } from '@bliss/ui/components/console/chart-caption';
import { type BarDatum, BarChart, ShareBars } from '@bliss/ui/components/console/bar-chart';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Section, Separator } from '@bliss/ui/components/console/section';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconFlame,
  IconReceipt,
  IconReceipt2,
  IconScale,
} from '@tabler/icons-react';
import type { SalesSummary } from '@/modules/reporting/service';
import { UrlSelect } from '../../_components/url-select';

interface CategoryRow {
  id: string;
  name: string;
  units: number;
  value: Cents;
  shareBps: number;
  marginBps: number | null;
}

interface MoverRow {
  productId: string;
  name: string;
  units: number;
  value: Cents;
  marginBps: number | null;
}

/** Sales for a range of business days: the figures, when they came in, by category, by tender, by product. */
export function SalesReport({
  rangeKey,
  rangeOptions,
  rangeLabel,
  summary,
  chart,
  chartCaption,
  categories,
  movers,
  tenders,
  exportDate,
}: {
  rangeKey: string;
  rangeOptions: { value: string; label: string }[];
  rangeLabel: string;
  summary: Omit<SalesSummary, 'grossMarginBps'> & { grossMarginBps: number | null };
  chart: BarDatum[];
  chartCaption: string;
  categories: CategoryRow[];
  movers: MoverRow[];
  tenders: { key: string; label: string; value: Cents; detail: string }[];
  exportDate: string;
}) {
  const showMargin = summary.grossMarginBps !== null;
  const hourly = chartCaption.startsWith('Sales by hour');
  const peak = chart.reduce<BarDatum | null>((max, d) => (!max || compare(d.value, max.value) > 0 ? d : max), null);

  const categoryColumns: Column<CategoryRow>[] = [
    { key: 'name', header: 'Category', width: 'minmax(120px,1.5fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="truncate text-ui font-medium text-ink">{r.name}</span> },
    { key: 'units', header: 'Sold', width: '64px', align: 'right', sortValue: (r) => r.units, csv: (r) => r.units, cell: (r) => <NumCell>{r.units.toLocaleString('en-KE')}</NumCell> },
    { key: 'share', header: 'Share', width: '72px', align: 'right', sortValue: (r) => r.shareBps, csv: (r) => (r.shareBps / 100).toFixed(1), cell: (r) => <NumCell tone="muted">{formatBps(r.shareBps)}</NumCell> },
    ...(showMargin
      ? [{ key: 'margin', header: 'Margin', width: '72px', align: 'right' as const, sortValue: (r: CategoryRow) => r.marginBps, csv: (r: CategoryRow) => (r.marginBps === null ? '' : (r.marginBps / 100).toFixed(1)), cell: (r: CategoryRow) => (r.marginBps === null ? <NumCell tone="muted">No cost</NumCell> : <NumCell tone={r.marginBps < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps)}</NumCell>) }]
      : []),
    { key: 'value', header: 'Sales', width: '104px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} size="num-md" decimals="whole" /> },
  ];

  const moverColumns: Column<MoverRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(160px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="truncate text-ui font-medium text-ink">{r.name}</span> },
    { key: 'units', header: 'Sold', width: '80px', align: 'right', sortValue: (r) => r.units, csv: (r) => r.units, cell: (r) => <NumCell>{r.units.toLocaleString('en-KE')}</NumCell> },
    ...(showMargin
      ? [{ key: 'margin', header: 'Margin', width: '88px', align: 'right' as const, sortValue: (r: MoverRow) => r.marginBps, csv: (r: MoverRow) => (r.marginBps === null ? '' : (r.marginBps / 100).toFixed(1)), cell: (r: MoverRow) => (r.marginBps === null ? <NumCell tone="muted">No cost</NumCell> : <NumCell tone={r.marginBps < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps)}</NumCell>) }]
      : []),
    { key: 'value', header: 'Sales', width: '120px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} size="num-md" decimals="whole" /> },
  ];

  return (
    <div className="flex flex-col gap-32">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <p className="measure text-ui text-ink-muted">{rangeLabel}, against the same number of business days before it.</p>
        <UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />
      </div>

      <MetricGrid>
        <Metric
          label="Settled"
          icon={IconReceipt2}
          value={<AnimatedMoney value={summary.netSales} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" />}
          delta={summary.deltaBps === null ? null : { bps: summary.deltaBps, against: 'the days before' }}
        />
        <Metric
          label="Bills"
          icon={IconReceipt}
          value={<CountUp value={summary.bills} delayMs={60} />}
          detail={
            <>
              Average <Money value={summary.averageBill} decimals="whole" size="num-sm" tone="muted" />
            </>
          }
        />
        <Metric
          label="Gross margin"
          icon={IconScale}
          value={showMargin ? <CountUp value={summary.grossMarginBps ?? 0} format={(n) => formatBps(Math.round(n))} delayMs={120} /> : <span className="font-sans text-title-section text-ink-muted">Hidden</span>}
          detail={showMargin ? 'After VAT, at the cost on each sale' : 'Your role does not see margin'}
        />
        <Metric
          label="Voided"
          icon={IconAlertTriangle}
          tone={summary.voidLines > 0 ? 'attention' : 'default'}
          href="/console/reports/voids"
          value={<AnimatedMoney value={summary.voids} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" tone={summary.voidLines > 0 ? 'attention' : 'default'} />}
          detail={
            <>
              {summary.voidLines} {summary.voidLines === 1 ? 'line' : 'lines'}, <Money value={summary.discounts} decimals="whole" size="num-sm" tone="muted" /> discounted
            </>
          }
        />
      </MetricGrid>

      <Card aria-labelledby="sales-chart">
        <CardHeader band level="h2" titleId="sales-chart" icon={IconChartBar} title={hourly ? 'Sales by hour' : 'Sales by business day'} subtitle={hourly ? 'By the hour each line was fired' : 'What the settled bills came to, each business day'} />
        <CardBody className="flex flex-col gap-16 pt-16">
          {peak && isPositive(peak.value) ? (
            <ChartCaption
              icon={<IconFlame size={16} stroke={1.5} />}
              label={hourly ? 'Busiest hour' : 'Best day'}
              figures={[hourly ? `${peak.label}:00` : formatDayShort(peak.key), <Money key="peak" value={peak.value} size="num-md" decimals="whole" />]}
              note={hourly ? 'Fired lines' : 'Settled bills'}
            />
          ) : null}
          <BarChart data={chart} highlightKey={peak?.key} caption={chartCaption} height={240} tooltipLabel={hourly ? (d) => `${d.label}:00 to ${d.label}:59` : (d) => formatDayShort(d.key)} />
        </CardBody>
      </Card>

      <Separator variant="pill" label="Where it came from" />

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="sales-categories">
          <CardHeader band level="h2" titleId="sales-categories" icon={IconBuildingStore} title="By category" />
          <DataTable id="report-categories" caption="Sales by category" rows={categories} columns={categoryColumns} rowKey={(r) => r.id} rowHref={(r) => `/console/catalogue/categories/${r.id}`} defaultSort={{ key: 'value', dir: 'desc' }} urlState={false} toolbar={false} variant="naked" empty={{ title: 'No sales in this range', body: 'Choose a longer range.' }} />
        </Card>

        <Card aria-labelledby="sales-tenders">
          <CardHeader band level="h2" titleId="sales-tenders" icon={IconCash} title="Tender mix" subtitle="How guests paid, as the cashier recorded it" />
          <CardBody className="pt-12">{tenders.length > 0 ? <ShareBars rows={tenders} /> : <p className="text-body-sm text-ink-muted">No bill was settled in this range.</p>}</CardBody>
        </Card>
      </div>

      <Section id="sales-products" title="Best sellers" description="The twelve products that sold the most in this range.">
        <DataTable
          id="report-movers"
          caption="Best sellers"
          noun={['product', 'products']}
          rows={movers}
          columns={moverColumns}
          rowKey={(r) => r.productId}
          rowHref={(r) => `/console/catalogue/products/${r.productId}`}
          defaultSort={{ key: 'value', dir: 'desc' }}
          urlState={false}
          toolbar={false}
          exportName="sales-by-product"
          exportDate={exportDate}
          empty={{ title: 'No sales in this range', body: 'Choose a longer range.' }}
        />
      </Section>
    </div>
  );
}
