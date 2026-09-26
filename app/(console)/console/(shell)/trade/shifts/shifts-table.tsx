'use client';

import { formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { type Cents, add, formatDecimal, isPositive, sum } from '@bliss/shared/money';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconClock, IconDiscount2, IconReceipt, IconUsers } from '@tabler/icons-react';
import { UrlSelect } from '../../_components/url-select';
import { StaffAvatar } from '../../people/staff/avatar';

export interface ShiftRow {
  id: string;
  businessDate: string;
  staff: string;
  staffId: string;
  role: string;
  startedAt: number;
  endedAt: number | null;
  handoverTo: string | null;
  tabsOpened: number;
  tabsHandedOver: number;
  sales: Cents;
  voids: Cents;
  discounts: Cents;
  open: boolean;
  avatarUrl: string | null;
  colourIndex: number;
}

/** Shifts in a range: who worked, for how long, and what went through their hands. */
export function ShiftsTable({
  rows,
  timezone,
  rangeOptions,
  rangeKey,
  rangeLabel,
  staff,
  exportDate,
}: {
  rows: ShiftRow[];
  timezone: string;
  rangeOptions: { value: string; label: string }[];
  rangeKey: string;
  rangeLabel: string;
  staff: { value: string; label: string }[];
  exportDate: string;
}) {
  const columns: Column<ShiftRow>[] = [
    { key: 'staff', header: 'Person', width: 'minmax(160px,1fr)', fixed: true, sortValue: (r) => r.staff, csv: (r) => r.staff, cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <StaffAvatar name={r.staff} avatarUrl={r.avatarUrl} colourIndex={r.colourIndex} />
          <StackCell primary={r.staff} secondary={r.role} />
        </span>
      ),
    },
    { key: 'date', header: 'Business day', width: '128px', sortValue: (r) => r.businessDate, csv: (r) => r.businessDate, cell: (r) => <NumCell tone="muted">{formatIsoDate(r.businessDate)}</NumCell> },
    {
      key: 'hours',
      header: 'Hours',
      width: '176px',
      sortValue: (r) => r.startedAt,
      csv: (r) => `${new Date(r.startedAt).toISOString()} ${r.endedAt ? new Date(r.endedAt).toISOString() : ''}`,
      cell: (r) =>
        r.open ? (
          <span className="flex items-center gap-8">
            <NumCell tone="muted">From {formatTime(r.startedAt, timezone)}</NumCell>
            <StatusChip status="open" label="On shift" />
          </span>
        ) : (
          <StackCell
            primary={<span className="font-mono tabular text-num-md">{`${formatTime(r.startedAt, timezone)} to ${r.endedAt ? formatTime(r.endedAt, timezone) : 'now'}`}</span>}
            secondary={r.endedAt ? formatElapsed(r.endedAt - r.startedAt) : undefined}
          />
        ),
    },
    {
      key: 'tabs',
      header: 'Tabs',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.tabsOpened,
      csv: (r) => r.tabsOpened,
      cell: (r) => (
        <span className="flex flex-col items-end">
          <NumCell>{r.tabsOpened}</NumCell>
          {r.tabsHandedOver > 0 ? <span className="text-body-sm text-ink-subtle">{r.tabsHandedOver} to {r.handoverTo ?? 'the next shift'}</span> : null}
        </span>
      ),
    },
    { key: 'sales', header: 'Sales', width: '128px', align: 'right', sortValue: (r) => r.sales, csv: (r) => formatDecimal(r.sales), cell: (r) => <Money value={r.sales} currency={false} size="num-md" decimals="whole" /> },
    {
      key: 'voids',
      header: 'Voids',
      width: '104px',
      align: 'right',
      sortValue: (r) => r.voids,
      csv: (r) => formatDecimal(r.voids),
      cell: (r) => (isPositive(r.voids) ? <Money value={r.voids} currency={false} size="num-md" decimals="whole" tone="attention" /> : <NumCell tone="muted">None</NumCell>),
    },
    {
      key: 'discounts',
      header: 'Discounts',
      width: '104px',
      align: 'right',
      sortValue: (r) => r.discounts,
      csv: (r) => formatDecimal(r.discounts),
      cell: (r) => (isPositive(r.discounts) ? <Money value={r.discounts} currency={false} size="num-md" decimals="whole" tone="attention" /> : <NumCell tone="muted">None</NumCell>),
    },
  ];

  const onShift = rows.filter((r) => r.open).length;
  const totalSales = sum(rows.map((r) => r.sales));
  const given = sum(rows.map((r) => add(r.voids, r.discounts)));
  const people = new Set(rows.map((r) => r.staffId)).size;

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Shifts" icon={IconUsers} value={<CountUp value={rows.length} />} detail={`${plural(people, 'person', 'people')}, ${rangeLabel}`} />
        <Metric
          label="On shift now"
          icon={IconClock}
          tone={onShift > 0 ? 'info' : 'default'}
          value={<CountUp value={onShift} delayMs={60} />}
          detail={onShift > 0 ? 'Signed in on a tablet or the counter' : 'Nobody is signed in'}
        />
        <Metric label="Sales" icon={IconReceipt} value={<Money value={totalSales} size="num-kpi" decimals="whole" />} detail="Settled on these shifts" />
        <Metric
          label="Voids and discounts"
          icon={IconDiscount2}
          tone={isPositive(given) ? 'attention' : 'default'}
          value={<Money value={given} size="num-kpi" decimals="whole" />}
          detail={isPositive(given) ? 'Given away or taken back' : 'Nothing voided or discounted'}
        />
      </MetricGrid>

      <DataTable
        id="trade-shifts"
        caption="Shifts"
        noun={['shift', 'shifts']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/trade/shifts/${r.id}`}
        defaultSort={{ key: 'hours', dir: 'desc' }}
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full" tone={r.open ? 'accent' : undefined}>
            <CardHeader
              band
              icon={<StaffAvatar name={r.staff} avatarUrl={r.avatarUrl} colourIndex={r.colourIndex} size="md" />}
              title={r.staff}
              subtitle={`${r.role}, ${formatIsoDate(r.businessDate)}`}
              href={`/console/trade/shifts/${r.id}`}
              meta={r.open ? <StatusChip status="open" label="On shift" /> : null}
            />
            <CardStats columns={3}>
              <Stat label="Sales">
                <Money value={r.sales} currency={false} size="num-md" decimals="whole" />
              </Stat>
              <Stat label="Tabs">{r.tabsOpened}</Stat>
              <Stat label="Voids" tone={isPositive(r.voids) ? 'low' : undefined}>
                {isPositive(r.voids) ? <Money value={r.voids} currency={false} size="num-md" decimals="whole" /> : 'None'}
              </Stat>
            </CardStats>
            <CardFooter>
              <span className="font-mono tabular text-num-sm text-ink-muted">
                {formatTime(r.startedAt, timezone)} to {r.endedAt ? formatTime(r.endedAt, timezone) : 'now'}
              </span>
              <span className="truncate text-body-sm text-ink-subtle">{r.endedAt ? formatElapsed(r.endedAt - r.startedAt) : 'Still signed in'}</span>
            </CardFooter>
          </Card>
        )}
        leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
        filters={[{ kind: 'select', key: 'person', label: 'Person', options: staff, test: (r, v) => r.staffId === v }]}
        exportName="shifts"
        exportDate={exportDate}
        empty={{ title: 'No shifts in this range', body: 'A shift starts when someone signs in on a floor tablet or the counter.' }}
        emptyFiltered={{ title: 'No shifts for this person in the range', body: 'Choose someone else, or a longer range.' }}
      />
    </div>
  );
}
