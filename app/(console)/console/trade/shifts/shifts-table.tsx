'use client';

import { formatElapsed, formatIsoDate, formatTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, isPositive } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { UrlSelect } from '../../_components/url-select';

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
}

export function ShiftsTable({
  rows,
  timezone,
  rangeOptions,
  rangeKey,
  staff,
  exportDate,
}: {
  rows: ShiftRow[];
  timezone: string;
  rangeOptions: { value: string; label: string }[];
  rangeKey: string;
  staff: { value: string; label: string }[];
  exportDate: string;
}) {
  const columns: Column<ShiftRow>[] = [
    { key: 'staff', header: 'Person', width: 'minmax(150px,1fr)', fixed: true, sortValue: (r) => r.staff, csv: (r) => r.staff, cell: (r) => <StackCell primary={r.staff} secondary={r.role} /> },
    { key: 'date', header: 'Business date', width: '120px', sortValue: (r) => r.businessDate, csv: (r) => r.businessDate, cell: (r) => <NumCell tone="muted">{formatIsoDate(r.businessDate)}</NumCell> },
    {
      key: 'hours',
      header: 'Hours',
      width: '130px',
      sortValue: (r) => r.startedAt,
      csv: (r) => `${new Date(r.startedAt).toISOString()} ${r.endedAt ? new Date(r.endedAt).toISOString() : ''}`,
      cell: (r) =>
        r.open ? (
          <span className="flex items-center gap-8">
            <NumCell tone="muted">{formatTime(r.startedAt, timezone)}</NumCell>
            <StatusChip status="open" label="On shift" />
          </span>
        ) : (
          <StackCell
            primary={<span className="font-mono tabular text-num">{`${formatTime(r.startedAt, timezone)} to ${r.endedAt ? formatTime(r.endedAt, timezone) : '··'}`}</span>}
            secondary={r.endedAt ? formatElapsed(r.endedAt - r.startedAt) : undefined}
          />
        ),
    },
    {
      key: 'tabs',
      header: 'Tabs',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.tabsOpened,
      csv: (r) => r.tabsOpened,
      cell: (r) => (
        <span className="flex flex-col items-end leading-tight">
          <NumCell>{r.tabsOpened}</NumCell>
          {r.tabsHandedOver > 0 ? <span className="text-body-sm text-ink-subtle">{r.tabsHandedOver} to {r.handoverTo ?? 'the next shift'}</span> : null}
        </span>
      ),
    },
    { key: 'sales', header: 'Sales', width: '120px', align: 'right', sortValue: (r) => r.sales, csv: (r) => formatDecimal(r.sales), cell: (r) => <Money value={r.sales} currency={false} decimals="whole" /> },
    {
      key: 'voids',
      header: 'Voids',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.voids,
      csv: (r) => formatDecimal(r.voids),
      cell: (r) => (isPositive(r.voids) ? <Money value={r.voids} currency={false} decimals="whole" tone="attention" /> : <NumCell tone="muted">··</NumCell>),
    },
    {
      key: 'discounts',
      header: 'Discounts',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.discounts,
      csv: (r) => formatDecimal(r.discounts),
      cell: (r) => (isPositive(r.discounts) ? <Money value={r.discounts} currency={false} decimals="whole" tone="attention" /> : <NumCell tone="muted">··</NumCell>),
    },
  ];

  return (
    <DataTable
      id="trade-shifts"
      caption="Shifts"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'hours', dir: 'desc' }}
      leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
      filters={[{ kind: 'select', key: 'person', label: 'Person', options: staff, test: (r, v) => r.staffId === v }]}
      exportName="shifts"
      exportDate={exportDate}
      empty={{ title: 'No shifts in this range', body: 'A shift starts when someone signs in on a floor tablet or the counter.' }}
    />
  );
}
