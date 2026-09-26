'use client';

import { formatElapsed, formatTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, formatKes, sum } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { SeatChipStack } from '@bliss/ui/components/working';
import { StatusChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconAlertTriangle, IconBeer, IconClock, IconReceipt, IconUsers, IconPrinter } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

export interface OpenTabRow {
  id: string;
  number: number | null;
  table: string;
  zone: string;
  zoneId: string;
  waiter: string;
  waiterId: string;
  openedAt: number;
  businessDate: string;
  guests: number;
  seats: { seatNo: number; label: string | null; settled: boolean }[];
  lines: number;
  pending: number;
  lastFiredAt: number | null;
  total: Cents;
  partSettled: boolean;
}

/** A tab open past four hours is worth a word with the waiter. */
const LONG_OPEN_MS = 4 * 60 * 60 * 1000;

export function OpenTabsTable({
  rows,
  now: serverNow,
  currentBusinessDate,
  timezone,
  zones,
  waiters,
}: {
  rows: OpenTabRow[];
  now: number;
  currentBusinessDate: string;
  timezone: string;
  zones: { value: string; label: string }[];
  waiters: { value: string; label: string }[];
}) {
  const router = useRouter();
  const clientNow = useNow(30_000);
  // The server's clock until hydration, so the first paint and the hydrated tree agree.
  const now = useHydrated() ? clientNow : serverNow;

  const columns: Column<OpenTabRow>[] = [
    {
      key: 'table',
      header: 'Table',
      width: 'minmax(150px,1.2fr)',
      fixed: true,
      sortValue: (r) => r.table,
      csv: (r) => r.table,
      cell: (r) => (
        <div className="flex flex-col gap-4">
          <StackCell primary={r.number ? `${r.table} · tab ${r.number}` : r.table} secondary={r.zone} />
          {r.businessDate < currentBusinessDate ? (
            <span className="inline-flex h-[22px] w-fit items-center justify-center gap-4 rounded-full bg-stop/15 border border-stop/20 px-8 text-[10px] font-medium uppercase tracking-[0.06em] text-stop leading-none mt-4 shadow-sm">
              Sleeping Tab
            </span>
          ) : null}
        </div>
      ),
    },
    { key: 'waiter', header: 'Waiter', width: '110px', sortValue: (r) => r.waiter, csv: (r) => r.waiter, cell: (r) => <span className="text-body-sm font-medium text-ink">{r.waiter}</span> },
    {
      key: 'opened',
      header: 'Open for',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.openedAt,
      csv: (r) => new Date(r.openedAt).toISOString(),
      cell: (r) => (
        <span className="flex flex-col items-end" title={`Opened ${formatTime(r.openedAt, timezone)}`}>
          <NumCell tone={now - r.openedAt > LONG_OPEN_MS ? 'low' : 'default'}>{formatElapsed(Math.max(0, now - r.openedAt))}</NumCell>
          <span className="font-mono tabular text-micro text-ink-subtle mt-[2px]">{formatTime(r.openedAt, timezone)}</span>
        </span>
      ),
    },
    {
      key: 'seats',
      header: 'Seats',
      width: 'minmax(140px,1fr)',
      sortValue: (r) => r.guests,
      csv: (r) => r.guests,
      cell: (r) => (
        r.seats.length > 0 ? (
          <SeatChipStack
            seats={r.seats.map((s) => ({ seatNo: s.seatNo, label: s.label, settled: s.settled }))}
            size="dense"
            max={8}
            overlapping
          />
        ) : <span className="text-body-sm text-ink-subtle">—</span>
      ),
    },
    {
      key: 'lines',
      header: 'Lines',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.lines,
      csv: (r) => r.lines,
      cell: (r) => (
        <span className="flex flex-col items-end">
          <NumCell>{r.lines}</NumCell>
          {r.pending > 0 ? <span className="font-mono tabular text-micro text-info font-medium mt-[2px]">{r.pending} at bar</span> : null}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last order',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.lastFiredAt,
      csv: (r) => (r.lastFiredAt ? new Date(r.lastFiredAt).toISOString() : ''),
      cell: (r) => (r.lastFiredAt ? (
        <span className="flex flex-col items-end">
          <NumCell tone="default">{formatElapsed(Math.max(0, now - r.lastFiredAt))}</NumCell>
          <span className="font-mono tabular text-micro text-ink-subtle mt-[2px]">ago</span>
        </span>
      ) : <span className="font-mono tabular text-body-sm text-ink-disabled">—</span>),
    },
    {
      key: 'state',
      header: 'State',
      width: '120px',
      sortValue: (r) => (r.businessDate < currentBusinessDate ? 0 : r.partSettled ? 1 : 2),
      csv: (r) => (r.businessDate < currentBusinessDate ? 'Sleeping' : r.partSettled ? 'Part settled' : 'Open'),
      cell: (r) =>
        r.businessDate < currentBusinessDate ? (
          <StatusChip status="voided" label="Unclosed Sale" />
        ) : (
          <StatusChip status={r.partSettled ? 'settled' : 'open'} label={r.partSettled ? 'Part settled' : 'Open'} />
        ),
    },
    { 
      key: 'total', 
      header: 'Total', 
      width: '120px', 
      align: 'right', 
      sortValue: (r) => r.total, 
      csv: (r) => formatDecimal(r.total), 
      cell: (r) => (
        <span className="font-mono tabular text-body-sm font-medium text-ink">
          {formatKes(r.total, { decimals: 'always' })}
        </span>
      ) 
    },
  ];

  const total = sum(rows.map((r) => r.total));
  const guestsCount = rows.reduce((n, r) => n + r.guests, 0);
  const pendingCount = rows.reduce((n, r) => n + r.pending, 0);
  const longOpenCount = rows.filter((r) => now - r.openedAt > LONG_OPEN_MS).length;
  const sleepingTabs = rows.filter((r) => r.businessDate < currentBusinessDate);
  const sleepingTotal = sum(sleepingTabs.map((r) => r.total));

  return (
    <div className="flex flex-col gap-24">
      {sleepingTabs.length > 0 ? (
        <div className="relative overflow-hidden rounded-[16px] bg-stop-wash border border-stop/20 p-20 tablet:p-24 shadow-sm mb-4">
          {/* Subtle elegant gradient backdrop */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(ellipse at 100% 0%, color-mix(in oklab, var(--color-stop) 12%, transparent) 0%, transparent 70%)'
            }}
            aria-hidden="true"
          />
          
          <div className="relative z-10 flex flex-col tablet:flex-row tablet:items-center justify-between gap-20 tablet:gap-16">
            <div className="flex flex-row items-start tablet:items-center gap-16 min-w-0 flex-1">
              <div className="flex size-[42px] items-center justify-center rounded-[12px] bg-stop text-page shadow-sm shrink-0 ring-1 ring-black/5 transition-transform hover:scale-105">
                <IconAlertTriangle size={22} stroke={1.5} aria-hidden="true" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-12 flex-wrap">
                  <h2 className="text-body font-medium text-ink">Unclosed Sales Alert</h2>
                  <span className="inline-flex h-[22px] items-center justify-center gap-4 rounded-full bg-stop/15 border border-stop/20 px-8 text-micro font-medium uppercase tracking-[0.06em] text-stop leading-none">
                    {sleepingTabs.length} {sleepingTabs.length === 1 ? 'Sleeping Tab' : 'Sleeping Tabs'}
                  </span>
                </div>
                <p className="mt-4 text-body-sm text-ink-subtle leading-relaxed max-w-[600px]">
                  First Principle: <span className="text-ink font-medium">Open tab ≠ closed sale.</span> Tabs sleeping past cutover represent immediate revenue leakage. Settle or audit these tabs now.
                </p>
              </div>
            </div>
            
            <div className="shrink-0 flex items-center justify-start tablet:justify-end border-t border-stop/10 pt-16 tablet:pt-0 tablet:border-t-0 tablet:border-l tablet:border-stop/15 tablet:pl-24">
              <div className="flex flex-col items-start tablet:items-end">
                <span className="text-micro font-medium uppercase tracking-[0.06em] text-stop/70 mb-4">Total Leakage</span>
                <span className="font-mono tabular text-title-lg font-medium text-stop leading-none tracking-tight">
                  {formatKes(sleepingTotal, { decimals: 'whole' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-20 tablet:grid-cols-2 desktop:grid-cols-4">
        <Metric
          label="Floor exposure"
          icon={IconReceipt}
          tone="default"
          value={<AnimatedMoney value={total} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
          detail={`${rows.length} open ${rows.length === 1 ? 'tab' : 'tabs'} on floor`}
        />
        <Metric
          label="Seated guests"
          icon={IconUsers}
          tone="default"
          value={<CountUp value={guestsCount} delayMs={60} />}
          detail={`Across ${rows.length} active tables`}
        />
        <Metric
          label="In preparation"
          icon={IconBeer}
          tone={pendingCount > 0 ? 'info' : 'default'}
          value={<CountUp value={pendingCount} delayMs={120} />}
          detail={pendingCount > 0 ? 'Drink lines fired to the bar' : 'All fired orders poured'}
        />
        <Metric
          label="Open past 4h"
          icon={IconClock}
          tone={longOpenCount > 0 ? 'attention' : 'poured'}
          value={<CountUp value={longOpenCount} delayMs={180} />}
          detail={longOpenCount > 0 ? 'Check in with assigned waiter' : 'All tabs within service rhythm'}
        />
      </div>

      {/* Elegant visual separator */}
      <div className="h-[1px] mt-20 w-full bg-gradient-to-r from-transparent via-hairline/60 to-transparent opacity-80" aria-hidden="true" />

      <DataTable
        id="trade-open"
        caption="Open tabs"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'opened', dir: 'asc' }}
        search={{ placeholder: 'Search tables', test: (r, q) => r.table.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'zone', label: 'Zone', options: zones, test: (r, v) => r.zoneId === v },
          { kind: 'select', key: 'waiter', label: 'Waiter', options: waiters, test: (r, v) => r.waiterId === v },
        ]}
        rowHref={(r) => `/console/trade/tabs/${r.id}`}
        rowActions={(r) => [
          { key: 'print', label: 'Print requested bill', icon: IconPrinter, onSelect: () => window.open(`/print/tab/${r.id}`, '_blank') },
          { key: 'open', label: 'Open the tab', icon: IconReceipt, onSelect: () => router.push(`/console/trade/tabs/${r.id}`) }
        ]}
        exportName="open-tabs"
        empty={{ title: 'No tabs are open', body: 'Tabs appear here the moment a waiter opens one on the floor.' }}
        footer={
          rows.length > 0 ? (
            <div className="flex items-baseline justify-between gap-16">
              <span className="text-body text-ink-muted">On the floor, not yet settled</span>
              <Money value={total} size="num-lg" />
            </div>
          ) : undefined
        }
        renderGridCard={(r) => (
          <div 
            className="group flex h-full flex-col overflow-hidden rounded-[20px] bg-page border border-hairline/60 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-hairline/80 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-[2px] cursor-pointer"
            onClick={() => router.push(`/console/trade/tabs/${r.id}`)}
          >
            {/* Header: Zone, Table/Tab, Sleeping warning */}
            <div className="flex items-start justify-between px-20 py-16 border-b border-hairline/40 bg-control/20">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-8 mb-[4px]">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle leading-none">{r.zone}</span>
                  {r.businessDate < currentBusinessDate ? (
                    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-stop bg-stop/10 px-[6px] py-[3px] rounded-md border border-stop/20 leading-none">
                      Sleeping
                    </span>
                  ) : null}
                </div>
                <span className="text-[17px] font-medium tracking-tight text-ink group-hover:text-accent-text transition-colors truncate">
                  {r.number ? `${r.table} · Tab ${r.number}` : r.table}
                </span>
              </div>
              <div className="shrink-0">
                <StatusChip status={r.businessDate < currentBusinessDate ? 'voided' : r.partSettled ? 'settled' : 'open'} label={r.businessDate < currentBusinessDate ? 'Unclosed' : r.partSettled ? 'Part settled' : 'Open'} />
              </div>
            </div>

            {/* Body: Key metrics grid */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-16 px-20 py-16 flex-1 bg-page/50">
              {/* Waiter */}
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle mb-[4px]">Waiter</span>
                <span className="text-[13px] font-medium text-ink truncate">
                  {r.waiter}
                </span>
              </div>

              {/* Opened For */}
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle mb-[4px]">Opened For</span>
                <div className="flex items-baseline gap-6 min-w-0">
                   <span className={`text-[13px] font-medium tabular-nums ${now - r.openedAt > LONG_OPEN_MS ? "text-attention" : "text-ink"}`}>
                     {formatElapsed(Math.max(0, now - r.openedAt))}
                   </span>
                   <span className="font-mono tabular text-[11px] text-ink-muted">
                     at {formatTime(r.openedAt, timezone)}
                   </span>
                </div>
              </div>

              {/* Seats */}
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle mb-[4px]">Seats</span>
                <div className="min-w-0">
                  {r.seats.length > 0 ? (
                    <SeatChipStack
                      seats={r.seats.map((s) => ({ seatNo: s.seatNo, label: s.label, settled: s.settled }))}
                      size="dense"
                      max={4}
                      overlapping
                    />
                  ) : <span className="text-[13px] font-medium text-ink-subtle">—</span>}
                </div>
              </div>

              {/* Lines & Bar state */}
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle mb-[4px]">Lines</span>
                <div className="flex items-baseline gap-6 min-w-0">
                  <span className="text-[13px] font-medium text-ink tabular-nums">{r.lines}</span>
                  {r.pending > 0 && <span className="font-mono tabular text-[11px] text-info font-medium">({r.pending} pending)</span>}
                </div>
              </div>
            </div>

            {/* Footer: Exposure */}
            <div className="flex items-center justify-between px-20 py-16 bg-control/40 border-t border-hairline/60 mt-auto">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Exposure</span>
              <span className="text-[16px] font-medium text-ink group-hover:text-accent-text transition-colors">
                <Money value={r.total} currency={false} />
              </span>
            </div>
          </div>
        )}
      />
    </div>
  );
}
