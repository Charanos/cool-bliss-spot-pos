'use client';

import { formatBps, formatQty } from '@bliss/shared/format';
import { type Cents, formatKes } from '@bliss/shared/money';
import { type BarDatum, BarChart } from '@bliss/ui/components/console/bar-chart';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBuildingStore,
  IconCheck,
  IconClock,
  IconDeviceTablet,
  IconFlame,
  IconLock,
  IconPackageOff,
  IconReceipt2,
  IconScale,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';

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
      <Metric
        label="Net sales"
        icon={IconReceipt2}
        tone="default"
        value={<AnimatedMoney value={props.netSales} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
        delta={props.delta}
        detail={`Across ${props.tabs} closed tabs`}
      />
      <Metric
        label="Gross margin"
        icon={IconScale}
        tone="default"
        value={<CountUp value={props.marginBps} format={(n) => formatBps(Math.round(n))} delayMs={60} />}
        detail="At cost, excluding VAT"
      />
      <Metric
        label="Seats served"
        icon={IconUsers}
        tone="default"
        value={<CountUp value={props.seats} delayMs={120} />}
        detail={`${props.tabs} tabs · ${(props.avgSeatsTenths / 10).toFixed(1)} avg guests`}
      />
      <Metric
        label="Variance at cost"
        icon={IconAlertTriangle}
        tone={props.varianceLines > 0 ? 'attention' : 'poured'}
        value={<AnimatedMoney value={props.variance} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" tone={props.varianceLines > 0 ? 'attention' : 'default'} />}
        detail={props.varianceLines > 0 ? `${props.varianceLines} ${props.varianceLines === 1 ? 'line' : 'lines'} outside tolerance` : 'Everything within tolerance'}
      />
    </div>
  );
}

export function SalesByHour({ data }: { data: BarDatum[] }) {
  const peak = data.reduce((max, d) => (d.value > max.value ? d : max), data[0] ?? { key: '', label: '', value: 0n as Cents });

  return (
    <div className="flex flex-col gap-16">
      {/* Peak hour and trading pulse summary chip */}
      <div className="flex flex-wrap items-center justify-between gap-12 rounded-full bg-control/30 px-16 py-8 ring-1 ring-hairline/40 shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-sm mb-4">
        <div className="flex items-center gap-8 text-body-sm">
          <div className="flex size-[28px] items-center justify-center rounded-full bg-attention/10 text-attention shrink-0 ring-1 ring-attention/20">
            <IconFlame size={16} stroke={ICON_STROKE} aria-hidden="true" />
          </div>
          <span className="font-medium text-ink ml-2">Peak trading</span>
          <span className="text-ink-subtle mx-2 opacity-60">/</span>
          <span className="font-mono tabular font-medium text-ink">{peak.label}:00</span>
          <span className="text-ink-subtle mx-2 opacity-60">/</span>
          <span className="font-mono tabular font-medium text-ink">{formatKes(peak.value, { decimals: 'whole' })}</span>
        </div>
        <div className="flex items-center gap-6 text-micro font-medium uppercase tracking-[0.04em] text-ink-subtle">
          <IconClock size={14} stroke={ICON_STROKE} className="text-ink-muted shrink-0" aria-hidden="true" />
          <span>Fired lines</span>
        </div>
      </div>

      <BarChart
        data={data}
        highlightKey={peak.key}
        caption="Sales by hour, last night"
        height={220}
      />
    </div>
  );
}

export interface AttentionItem {
  tone: 'stop' | 'low' | 'info';
  text: string;
  href: string;
  cta: string;
}

export function AttentionBoard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="flex size-[40px] items-center justify-center rounded-md bg-poured-wash border border-poured/30 text-poured mb-12 shadow-sm">
          <IconCheck size={22} stroke={ICON_STROKE} aria-hidden="true" />
        </div>
        <p className="text-subtitle font-medium text-ink">All venue operations in tolerance</p>
        <p className="mt-4 text-body-sm text-ink-subtle max-w-sm">
          No critical inventory shrinkage, offline dead letters, or drawer balance discrepancies requiring manager resolution.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <li key={item.text} className={cx("relative", !isLast && "border-b border-rule")}>
            <Link
              href={item.href}
              className="group/item flex min-h-[56px] items-center gap-16 py-12 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md press-feedback"
            >
              <div className="flex-1 min-w-0 pr-8">
                <span className="block text-body-sm font-medium text-ink transition-colors leading-tight">
                  {item.text}
                </span>
              </div>
              
              <div className="shrink-0 flex items-center justify-center">
                 <span className="inline-flex items-center gap-4 rounded-full bg-transparent px-8 py-[4px] text-micro font-medium text-ink-subtle ring-1 ring-hairline/50 transition-all group-hover/item:bg-ink group-hover/item:text-page group-hover/item:ring-transparent group-hover/item:shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                   {item.cta}
                   <IconArrowRight size={12} stroke={ICON_STROKE} aria-hidden="true" className="opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-[2px] transition-all" />
                 </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface MoverRow {
  productId: string;
  name: string;
  units: number;
  value: Cents;
  marginBps: number;
}

export function TopMovers({ rows }: { rows: MoverRow[] }) {
  const maxUnits = rows.reduce((max, r) => (r.units > max ? r.units : max), 0);

  const columns: Column<MoverRow>[] = [
    {
      key: 'name',
      header: 'Product',
      width: 'minmax(140px,2fr)',
      cell: (r) => (
        <span className="flex items-center gap-8 min-w-0">
          <span className="truncate text-body-sm text-ink font-medium">{r.name}</span>
        </span>
      ),
    },
    {
      key: 'units',
      header: 'Units',
      width: '90px',
      align: 'right',
      cell: (r) => {
        const pct = maxUnits > 0 ? (r.units / maxUnits) * 100 : 0;
        return (
          <div className="flex items-center justify-end gap-8">
            <span className="h-[3px] w-[32px] rounded-full bg-hairline/40 overflow-hidden hidden tablet:block" aria-hidden="true">
              <span className="block h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
            </span>
            <NumCell>{r.units}</NumCell>
          </div>
        );
      },
    },
    {
      key: 'value',
      header: 'Revenue',
      width: '110px',
      align: 'right',
      cell: (r) => (
        <span className="font-mono tabular text-body-sm text-ink">
          {formatKes(r.value, { decimals: 'whole' })}
        </span>
      ),
    },
    {
      key: 'margin',
      header: 'Margin',
      width: '80px',
      align: 'right',
      cell: (r) => (
        <span className={cx("font-mono tabular text-body-sm font-medium", r.marginBps < 3500 ? "text-attention" : "text-poured")}>
          {formatBps(r.marginBps)}
        </span>
      ),
    },
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
    {
      key: 'name',
      header: 'Product',
      width: 'minmax(120px,2fr)',
      cell: (r) => (
        <div className="flex items-center min-w-0">
          <span className="truncate text-body-sm text-ink font-medium">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'expected',
      header: 'Exp.',
      width: '64px',
      align: 'right',
      cell: (r) => <NumCell tone="muted">{formatQty(r.expected, 1)}</NumCell>,
    },
    {
      key: 'counted',
      header: 'Counted',
      width: '64px',
      align: 'right',
      cell: (r) => <NumCell>{formatQty(r.counted, 1)}</NumCell>,
    },
    {
      key: 'variance',
      header: 'Variance',
      width: '76px',
      align: 'right',
      cell: (r) => (
        <span className={cx("font-mono tabular text-body-sm", r.outside ? (r.variance < 0 ? "font-medium text-stop" : "font-medium text-attention") : "text-ink-subtle")}>
          {r.variance > 0 ? '+' : ''}{formatQty(r.variance, 2)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'At cost',
      width: '100px',
      align: 'right',
      cell: (r) => (
        <span className={cx("font-mono tabular text-body-sm", r.outside ? (r.value < 0n ? "font-medium text-stop" : "font-medium text-attention") : "text-ink-subtle")}>
          {formatKes(r.value, { decimals: 'whole' })}
        </span>
      ),
    },
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
      empty={{ title: 'No variance to report', body: 'Everything counted within tolerance for this period.' }}
    />
  );
}

export function FloorPulseStrip({
  openTabsCount,
  openExposure,
  seatedGuests,
  devicesOnline,
  totalDevices,
}: {
  openTabsCount: number;
  openExposure: Cents;
  seatedGuests: number;
  devicesOnline: number;
  totalDevices: number;
}) {
  return (
    <div 
      className="relative overflow-hidden rounded-[16px] bg-poured-wash border border-poured/20 p-20 tablet:p-24 mt-8 transition-all"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 0% 100%, color-mix(in oklab, var(--color-poured) 15%, transparent) 0%, transparent 120%), radial-gradient(color-mix(in oklab, var(--color-poured) 8%, transparent) 1.5px, transparent 1.5px)',
        backgroundSize: '100% 100%, 24px 24px',
        backgroundPosition: '0 0, 12px 12px',
        boxShadow: '0 8px 32px -8px color-mix(in oklab, var(--color-poured) 15%, transparent), inset 0 1px 1px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.03)'
      }}
    >
      <div className="relative z-10 flex flex-col tablet:flex-row tablet:items-center justify-between gap-16">
        <div className="flex items-center gap-12 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-8">
              <span className="text-body font-medium text-ink">Floor active exposure</span>
              <span className="size-[6px] rounded-full bg-poured animate-breathe" aria-hidden="true" />
            </div>
            <span className="text-body-sm text-ink-subtle mt-2">
              {openTabsCount} open {openTabsCount === 1 ? 'tab' : 'tabs'} · {seatedGuests} seated {seatedGuests === 1 ? 'guest' : 'guests'} · {devicesOnline}/{totalDevices} stations live
            </span>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-16 tablet:gap-24">
          <div className="flex flex-col items-start tablet:items-end">
            <span className="text-micro font-medium uppercase tracking-[0.06em] text-ink-subtle">Unsettled on floor</span>
            <span className="font-mono tabular text-title-lg font-medium text-ink leading-none mt-4">
              <Money value={openExposure} currency decimals="whole" />
            </span>
          </div>

          <div className="flex items-center gap-8 pl-16 border-l border-poured/20">
            <Link
              href="/console/trade/open"
              className="group inline-flex items-center gap-6 rounded-full bg-control/60 hover:bg-control ring-1 ring-hairline/20 shadow-sm px-16 py-[10px] text-body-sm font-medium text-ink active:scale-[0.98] transition-all duration-200 press-feedback"
            >
              <span>View open tabs</span>
              <IconArrowRight size={16} stroke={1.5} aria-hidden="true" className="text-ink-subtle group-hover:text-ink transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
