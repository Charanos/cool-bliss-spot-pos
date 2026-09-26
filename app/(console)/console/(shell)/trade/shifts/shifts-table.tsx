'use client';

import { formatElapsed, formatIsoDate, formatTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, isPositive, sum, add } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Metric } from '@bliss/ui/components/console/metric';
import { Money, Num } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAlertCircle, IconClock, IconReceipt, IconUsers } from '@tabler/icons-react';
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
      width: '180px',
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
        <span className="flex flex-col items-end ">
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

  const totalShifts = rows.length;
  const activeStaff = rows.filter((r) => r.open).length;
  const totalSales = sum(rows.map((r) => r.sales));
  const totalExceptions = sum(rows.map((r) => add(r.voids, r.discounts)));

  return (
    <div className="flex flex-col gap-24">
      {/* Executive Shift Performance Metrics */}
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        <Metric
          label={`Total Shifts${rangeKey ? ` (${rangeOptions.find(o => o.value === rangeKey)?.label ?? rangeKey})` : ''}`}
          value={<Num size="title-lg">{totalShifts}</Num>}
          detail="Staff sessions logged"
          icon={IconUsers}
          tone="default"
        />
        <Metric
          label="Active Staff"
          value={<Num size="title-lg">{activeStaff}</Num>}
          detail="Currently on the floor"
          icon={IconClock}
          tone={activeStaff > 0 ? 'poured' : 'default'}
        />
        <Metric
          label="Sales Driven"
          value={<Money value={totalSales} currency={false} decimals="whole" size="title-lg" />}
          detail="Revenue across shifts"
          icon={IconReceipt}
          tone="default"
        />
        <Metric
          label="Exceptions & Voids"
          value={<Money value={totalExceptions} currency={false} decimals="whole" size="title-lg" />}
          detail="Discounts & Voids"
          icon={IconAlertCircle}
          tone={totalExceptions > 0n ? 'attention' : 'default'}
        />
      </div>

      {/* Elegant visual separator */}
      <div className="h-[1px] mt-20 w-full bg-gradient-to-r from-transparent via-hairline/60 to-transparent opacity-80" aria-hidden="true" />

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
        renderGridCard={(r) => (
          <div className="text-left w-full h-[320px] bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all flex flex-col group relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col p-20 bg-desk-hover border-b border-hairline/40 shrink-0">
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-[11px] font-bold tracking-widest text-desk-muted uppercase">{formatIsoDate(r.businessDate)}</span>
                {r.open ? (
                  <StatusChip status="open" label="On shift" />
                ) : (
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-widest">Closed</span>
                )}
              </div>
              <span className="text-title font-medium text-ink truncate mb-4">{r.staff}</span>
              <span className="text-micro text-ink-subtle truncate">{r.role}</span>
            </div>

            {/* Details */}
            <div className="flex flex-col flex-1 p-20 text-body-sm bg-page w-full">
              <div className="flex flex-col mt-auto gap-8">
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Time</span>
                  <span className="font-mono text-ink font-medium">
                    {`${formatTime(r.startedAt, timezone)} - ${r.endedAt ? formatTime(r.endedAt, timezone) : 'Now'}`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Tabs</span>
                  <span className="text-ink font-medium">{r.tabsOpened} opened</span>
                </div>
                <div className="flex justify-between items-center py-8">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Sales</span>
                  <Money value={r.sales} currency={false} decimals="whole" className="font-medium text-[15px]" />
                </div>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
