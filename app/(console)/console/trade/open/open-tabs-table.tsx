'use client';

import { formatElapsed, formatTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, sum } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconBeer, IconClock, IconReceipt, IconUsers } from '@tabler/icons-react';
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

export function OpenTabsTable({ rows, now: serverNow, timezone, zones, waiters }: { rows: OpenTabRow[]; now: number; timezone: string; zones: { value: string; label: string }[]; waiters: { value: string; label: string }[] }) {
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
      cell: (r) => <StackCell primary={r.number ? `${r.table} · tab ${r.number}` : r.table} secondary={r.zone} />,
    },
    { key: 'waiter', header: 'Waiter', width: '110px', sortValue: (r) => r.waiter, csv: (r) => r.waiter, cell: (r) => <span className="text-body text-ink">{r.waiter}</span> },
    {
      key: 'opened',
      header: 'Open for',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.openedAt,
      csv: (r) => new Date(r.openedAt).toISOString(),
      cell: (r) => (
        <span className="flex flex-col items-end " title={`Opened ${formatTime(r.openedAt, timezone)}`}>
          <NumCell tone={now - r.openedAt > LONG_OPEN_MS ? 'low' : 'default'}>{formatElapsed(Math.max(0, now - r.openedAt))}</NumCell>
          <span className="font-mono tabular text-num-sm text-ink-subtle">{formatTime(r.openedAt, timezone)}</span>
        </span>
      ),
    },
    {
      key: 'seats',
      header: 'Seats',
      width: 'minmax(140px,1fr)',
      sortValue: (r) => r.guests,
      csv: (r) => r.guests,
      cell: (r) =>
        r.seats.length > 1 ? (
          <span className="flex flex-wrap items-center gap-4" aria-label={`${r.seats.length} seats`}>
            {r.seats.map((s) => (
              <SeatChip key={s.seatNo} seat={s.seatNo} label={s.label} settled={s.settled} size="dense" />
            ))}
          </span>
        ) : (
          <span className="text-body text-ink-subtle">One guest</span>
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
        <span className="flex flex-col items-end ">
          <NumCell>{r.lines}</NumCell>
          {r.pending > 0 ? <span className="text-body-sm text-info font-medium">{r.pending} at bar</span> : null}
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
      cell: (r) => (r.lastFiredAt ? <NumCell tone="muted">{formatElapsed(Math.max(0, now - r.lastFiredAt))} ago</NumCell> : <NumCell tone="muted">··</NumCell>),
    },
    { key: 'state', header: 'State', width: '120px', sortValue: (r) => (r.partSettled ? 0 : 1), csv: (r) => (r.partSettled ? 'Part settled' : 'Open'), cell: (r) => <StatusChip status={r.partSettled ? 'settled' : 'open'} label={r.partSettled ? 'Part settled' : 'Open'} /> },
    { key: 'total', header: 'Total', width: '120px', align: 'right', sortValue: (r) => r.total, csv: (r) => formatDecimal(r.total), cell: (r) => <Money value={r.total} currency={false} /> },
  ];

  const total = sum(rows.map((r) => r.total));
  const guestsCount = rows.reduce((n, r) => n + r.guests, 0);
  const pendingCount = rows.reduce((n, r) => n + r.pending, 0);
  const longOpenCount = rows.filter((r) => now - r.openedAt > LONG_OPEN_MS).length;

  return (
    <div className="flex flex-col gap-20">
      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
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
        rowActions={(r) => [{ key: 'open', label: 'Open the tab', icon: IconReceipt, onSelect: () => router.push(`/console/trade/tabs/${r.id}`) }]}
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
      />
    </div>
  );
}
