'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { type Cents, formatDecimal, sum } from '@bliss/shared/money';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout } from '@bliss/ui/components/console/section';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { SeatChipStack } from '@bliss/ui/components/working';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconBeer, IconClock, IconPrinter, IconReceipt, IconUsers } from '@tabler/icons-react';
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

/** Open tabs: what is on the floor now, what is past its business day, and every tab as a row or a card. */
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
  const pastClose = (r: OpenTabRow) => r.businessDate < currentBusinessDate;
  const title = (r: OpenTabRow) => (r.number ? `${r.table}, tab ${r.number}` : r.table);
  const state = (r: OpenTabRow) =>
    pastClose(r) ? <ToneChip tone="stop">Past close</ToneChip> : <StatusChip status={r.partSettled ? 'settled' : 'open'} label={r.partSettled ? 'Part settled' : 'Open'} />;
  const actions = (r: OpenTabRow) => [
    { key: 'open', label: 'Open the tab', icon: IconReceipt, onSelect: () => router.push(`/console/trade/tabs/${r.id}`) },
    { key: 'print', label: 'Print the bill', icon: IconPrinter, onSelect: () => window.open(`/print/tab/${r.id}`, '_blank') },
  ];

  const columns: Column<OpenTabRow>[] = [
    {
      key: 'table',
      header: 'Table',
      width: 'minmax(180px,1.4fr)',
      fixed: true,
      sortValue: (r) => r.table,
      csv: (r) => r.table,
      cell: (r) => <StackCell primary={title(r)} secondary={r.zone} />,
    },
    { key: 'waiter', header: 'Waiter', width: '120px', sortValue: (r) => r.waiter, csv: (r) => r.waiter, cell: (r) => <span className="text-ui text-ink">{r.waiter}</span> },
    {
      key: 'opened',
      header: 'Open for',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.openedAt,
      csv: (r) => new Date(r.openedAt).toISOString(),
      cell: (r) => (
        <span className="flex flex-col items-end" title={`Opened at ${formatTime(r.openedAt, timezone)}`}>
          <NumCell tone={now - r.openedAt > LONG_OPEN_MS ? 'low' : 'default'}>{formatElapsed(Math.max(0, now - r.openedAt))}</NumCell>
          <span className="font-mono tabular text-num-sm text-ink-subtle">since {formatTime(r.openedAt, timezone)}</span>
        </span>
      ),
    },
    {
      key: 'seats',
      header: 'Seats',
      width: 'minmax(140px,1fr)',
      sortValue: (r) => r.guests,
      csv: (r) => r.guests,
      cell: (r) => (r.seats.length > 0 ? <SeatChipStack seats={r.seats} size="dense" max={8} overlapping /> : <span className="text-body-sm text-ink-subtle">One seat</span>),
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
          {r.pending > 0 ? <span className="font-mono tabular text-num-sm text-info">{r.pending} at the bar</span> : null}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last order',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.lastFiredAt,
      csv: (r) => (r.lastFiredAt ? new Date(r.lastFiredAt).toISOString() : ''),
      cell: (r) => (r.lastFiredAt ? <NumCell>{formatElapsed(Math.max(0, now - r.lastFiredAt))} ago</NumCell> : <NumCell tone="muted">None yet</NumCell>),
    },
    {
      key: 'state',
      header: 'State',
      width: '120px',
      sortValue: (r) => (pastClose(r) ? 0 : r.partSettled ? 1 : 2),
      csv: (r) => (pastClose(r) ? 'Past close' : r.partSettled ? 'Part settled' : 'Open'),
      cell: state,
    },
    { key: 'total', header: 'Total', width: '130px', align: 'right', sortValue: (r) => r.total, csv: (r) => formatDecimal(r.total), cell: (r) => <Money value={r.total} size="num-md" /> },
  ];

  const total = sum(rows.map((r) => r.total));
  const guests = rows.reduce((n, r) => n + r.guests, 0);
  const pending = rows.reduce((n, r) => n + r.pending, 0);
  const longOpen = rows.filter((r) => now - r.openedAt > LONG_OPEN_MS).length;
  const stale = rows.filter(pastClose);

  return (
    <div className="flex flex-col gap-32">
      {stale.length > 0 ? (
        <Callout
          tone="stop"
          title={`${plural(stale.length, 'tab')} still open from an earlier business day`}
          aside={<Money value={sum(stale.map((r) => r.total))} size="num-lg" />}
        >
          An open tab is not a sale. Settle them, or void what was never served, so that day&rsquo;s figures are final.
        </Callout>
      ) : null}

      <MetricGrid>
        <Metric label="Open value" icon={IconReceipt} value={<AnimatedMoney value={total} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" />} detail={`${plural(rows.length, 'open tab')}`} />
        <Metric label="Guests seated" icon={IconUsers} value={<CountUp value={guests} delayMs={60} />} detail={`At ${plural(rows.length, 'table')}`} />
        <Metric label="At the bar" icon={IconBeer} tone={pending > 0 ? 'info' : 'default'} value={<CountUp value={pending} delayMs={120} />} detail={pending > 0 ? 'Lines fired, not yet poured' : 'Everything fired has been poured'} />
        <Metric
          label="Open over 4 hours"
          icon={IconClock}
          tone={longOpen > 0 ? 'attention' : 'poured'}
          value={<CountUp value={longOpen} delayMs={180} />}
          detail={longOpen > 0 ? 'Worth a word with the waiter' : 'Every tab is within the usual pace'}
        />
      </MetricGrid>

      <DataTable
        id="trade-open"
        caption="Open tabs"
        noun={['tab', 'tabs']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'opened', dir: 'asc' }}
        rowTone={(r) => (pastClose(r) ? 'attention' : 'default')}
        search={{ placeholder: 'Search tables', test: (r, q) => r.table.toLowerCase().includes(q) || String(r.number ?? '').includes(q) }}
        filters={[
          { kind: 'select', key: 'zone', label: 'Zone', options: zones, test: (r, v) => r.zoneId === v },
          { kind: 'select', key: 'waiter', label: 'Waiter', options: waiters, test: (r, v) => r.waiterId === v },
        ]}
        rowHref={(r) => `/console/trade/tabs/${r.id}`}
        rowActions={actions}
        exportName="open-tabs"
        empty={{ title: 'No tabs are open', body: 'A tab appears here the moment a waiter opens one on the floor.' }}
        emptyFiltered={{ title: 'No open tabs match these filters', body: 'Clear the zone, waiter or search to see every open tab.' }}
        footer={
          rows.length > 0 ? (
            <div className="flex items-baseline justify-between gap-16">
              <span className="text-body-sm text-ink-muted">On the floor, not yet settled</span>
              <Money value={total} size="num-lg" />
            </div>
          ) : undefined
        }
        renderGridCard={(r) => (
          <Card as="article" interactive tone={pastClose(r) ? 'stop' : undefined} className="h-full">
            <CardHeader band href={`/console/trade/tabs/${r.id}`} title={title(r)} subtitle={r.zone} meta={state(r)} actions={<OverflowMenu label={`Actions for ${title(r)}`} size="sm" items={actions(r)} />} />
            <CardStats>
              <Stat label="Waiter">{r.waiter}</Stat>
              <Stat label="Open for" tone={now - r.openedAt > LONG_OPEN_MS ? 'low' : undefined}>
                {formatElapsed(Math.max(0, now - r.openedAt))}
                <span className="font-regular text-ink-subtle"> since {formatTime(r.openedAt, timezone)}</span>
              </Stat>
              <Stat label="Seats">{r.seats.length > 0 ? <SeatChipStack seats={r.seats} size="dense" max={5} overlapping /> : 'One seat'}</Stat>
              <Stat label="Lines">
                {r.lines}
                {r.pending > 0 ? <span className="font-regular text-info"> · {r.pending} at the bar</span> : null}
              </Stat>
            </CardStats>
            <CardFooter>
              <span className="text-body-sm text-ink-muted">Open value</span>
              <Money value={r.total} size="num-md" />
            </CardFooter>
          </Card>
        )}
      />
    </div>
  );
}
