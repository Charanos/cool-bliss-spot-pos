'use client';

import { formatBps } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type BarDatum, BarChart, ShareBars } from '@bliss/ui/components/console/bar-chart';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { ConsoleBentoCard, CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconPackage,
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

  const categoryColumns: Column<CategoryRow>[] = [
    { key: 'name', header: 'Category', width: 'minmax(140px,1.5fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="text-body font-medium text-ink">{r.name}</span> },
    { key: 'units', header: 'Units', width: '80px', align: 'right', sortValue: (r) => r.units, csv: (r) => r.units, cell: (r) => <NumCell>{r.units.toLocaleString('en-KE')}</NumCell> },
    { key: 'share', header: 'Share', width: '80px', align: 'right', sortValue: (r) => r.shareBps, csv: (r) => (r.shareBps / 100).toFixed(1), cell: (r) => <NumCell tone="muted">{formatBps(r.shareBps)}</NumCell> },
    ...(showMargin
      ? [{ key: 'margin', header: 'Margin', width: '80px', align: 'right' as const, sortValue: (r: CategoryRow) => r.marginBps, csv: (r: CategoryRow) => ((r.marginBps ?? 0) / 100).toFixed(1), cell: (r: CategoryRow) => <NumCell tone={(r.marginBps ?? 0) < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps ?? 0)}</NumCell> }]
      : []),
    { key: 'value', header: 'Sales', width: '120px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
  ];

  const moverColumns: Column<MoverRow>[] = [
    { key: 'name', header: 'Product', width: 'minmax(160px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="text-body font-medium text-ink">{r.name}</span> },
    { key: 'units', header: 'Units', width: '80px', align: 'right', sortValue: (r) => r.units, csv: (r) => r.units, cell: (r) => <NumCell>{r.units.toLocaleString('en-KE')}</NumCell> },
    ...(showMargin
      ? [{ key: 'margin', header: 'Margin', width: '80px', align: 'right' as const, sortValue: (r: MoverRow) => r.marginBps, csv: (r: MoverRow) => ((r.marginBps ?? 0) / 100).toFixed(1), cell: (r: MoverRow) => <NumCell tone={(r.marginBps ?? 0) < 3500 ? 'low' : 'default'}>{formatBps(r.marginBps ?? 0)}</NumCell> }]
      : []),
    { key: 'value', header: 'Sales', width: '120px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
  ];

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-wrap items-end justify-between gap-16 rounded-sm bg-control/40 p-12 border border-hairline/60">
        <UrlSelect param="range" label="Reporting period" options={rangeOptions} allLabel={null} fallback={rangeKey} />
        <p className="font-mono text-micro text-ink-subtle">
          Benchmark against {rangeOptions.find((o) => o.value === rangeKey)?.label.toLowerCase().replace('last ', 'previous ') ?? 'previous period'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
        <Metric
          label={`Net sales · ${rangeLabel}`}
          icon={IconReceipt2}
          value={<AnimatedMoney value={summary.netSales} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
          delta={summary.deltaBps === null ? null : { bps: summary.deltaBps, against: 'prior period' }}
        />
        <Metric
          label="Bills settled"
          icon={IconReceipt}
          value={<CountUp value={summary.bills} delayMs={60} />}
          detail={<>Average <Money value={summary.averageBill} currency={false} decimals="whole" size="num-sm" tone="muted" /></>}
        />
        <Metric
          label="Gross margin"
          icon={IconScale}
          value={showMargin ? <CountUp value={summary.grossMarginBps ?? 0} format={(n) => formatBps(Math.round(n))} delayMs={120} /> : <span className="text-ink-subtle">··</span>}
          detail={showMargin ? 'At cost, excluding VAT' : 'Your role does not include margin'}
        />
        <Metric
          label="Voids & discounts"
          icon={IconAlertTriangle}
          tone="attention"
          value={<AnimatedMoney value={summary.voids} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" tone="attention" />}
          detail={
            <>
              {summary.voidLines} voided lines · <Money value={summary.discounts} currency={false} decimals="whole" size="num-sm" tone="muted" /> discounts
            </>
          }
        />
      </div>

      <ConsoleBentoCard
        icon={IconChartBar}
        title={chartCaption.split(',')[0] ?? 'Sales over time'}
        subtitle="Revenue progression by session"
        tone="default"
      >
        <BarChart data={chart} caption={chartCaption} height={240} />
      </ConsoleBentoCard>

      <div className="grid grid-cols-1 gap-20 desktop:grid-cols-2">
        <ConsoleBentoCard
          icon={IconBuildingStore}
          title="Sales by category"
          subtitle="Volume and revenue distribution"
          tone="default"
        >
          <DataTable id="report-categories" caption="Sales by category" rows={categories} columns={categoryColumns} rowKey={(r) => r.id} defaultSort={{ key: 'value', dir: 'desc' }} urlState={false} toolbar={false} empty={{ title: 'No sales in this range', body: 'Choose a longer range.' }} />
        </ConsoleBentoCard>

        <ConsoleBentoCard
          icon={IconCash}
          title="Tender mix"
          subtitle="How guests settled payments at the counter"
          tone="default"
        >
          {tenders.length > 0 ? <ShareBars rows={tenders} /> : <p className="text-body text-ink-muted">No tenders in this range.</p>}
        </ConsoleBentoCard>
      </div>

      <ConsoleBentoCard
        icon={IconPackage}
        title="Top product performance"
        subtitle="Ranked by gross sales volume and unit margin"
        tone="default"
      >
        <DataTable
          id="report-movers"
          caption="Top products"
          rows={movers}
          columns={moverColumns}
          rowKey={(r) => r.productId}
          defaultSort={{ key: 'value', dir: 'desc' }}
          urlState={false}
          exportName="sales-by-product"
          exportDate={exportDate}
          empty={{ title: 'No sales in this range', body: 'Choose a longer range.' }}
        />
      </ConsoleBentoCard>
    </div>
  );
}
