'use client';

import type { BillScope, BillStatus, TenderKind } from '@bliss/shared/domain';
import { formatDateTime, formatIsoDate, plural } from '@bliss/shared/format';
import { type Cents, ZERO, cents, formatDecimal, isPositive, sum } from '@bliss/shared/money';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { ConsoleBentoCard, Metric } from '@bliss/ui/components/console/metric';
import { IconAlertCircle, IconCreditCard, IconDiscount2, IconReceipt, IconReceiptTax } from '@tabler/icons-react';
import { SCOPE_LABEL, TENDER_LABEL } from '../../_lib/labels';
import { UrlSelect } from '../../_components/url-select';

export interface BillRow {
  id: string;
  number: number;
  businessDate: string;
  settledAt: number | null;
  table: string;
  tabId: string | null;
  scope: BillScope;
  seatNo: number | null;
  tenders: { kind: TenderKind; amount: Cents; reference: string | null }[];
  tenderKinds: TenderKind[];
  settledBy: string;
  settledById: string;
  discount: Cents;
  total: Cents;
  status: BillStatus;
}

export function BillsView({
  rows,
  timezone,
  rangeOptions,
  rangeKey,
  rangeLabel,
  mix,
  cashiers,
  exportDate,
}: {
  rows: BillRow[];
  timezone: string;
  rangeOptions: { value: string; label: string }[];
  rangeKey: string;
  rangeLabel: string;
  mix: { kind: TenderKind; amount: Cents; count: number }[];
  cashiers: { value: string; label: string }[];
  exportDate: string;
}) {
  const columns: Column<BillRow>[] = [
    {
      key: 'number',
      header: 'Bill',
      width: '120px',
      fixed: true,
      sortValue: (r) => r.number,
      csv: (r) => r.number,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num">{r.number}</span>} secondary={formatIsoDate(r.businessDate)} />,
    },
    {
      key: 'settled',
      header: 'Settled',
      width: '150px',
      sortValue: (r) => r.settledAt,
      csv: (r) => (r.settledAt ? new Date(r.settledAt).toISOString() : ''),
      cell: (r) => <NumCell tone="muted">{r.settledAt ? formatDateTime(r.settledAt, timezone) : '··'}</NumCell>,
    },
    {
      key: 'table',
      header: 'Table',
      width: 'minmax(140px,1fr)',
      sortValue: (r) => r.table,
      csv: (r) => r.table,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-8">
          {r.seatNo ? <SeatChip seat={r.seatNo} size="dense" /> : null}
          <StackCell primary={r.table} secondary={SCOPE_LABEL[r.scope]} />
        </span>
      ),
    },
    {
      key: 'tenders',
      header: 'Paid by, as recorded',
      width: 'minmax(180px,1.4fr)',
      csv: (r) => r.tenders.map((t) => `${TENDER_LABEL[t.kind]} ${formatDecimal(t.amount)}${t.reference ? ` ${t.reference}` : ''}`).join('; '),
      cell: (r) => (
        <span className="flex min-w-0 flex-col ">
          <span className="truncate text-body text-ink">{r.tenders.map((t) => TENDER_LABEL[t.kind]).join(' and ') || '··'}</span>
          {r.tenders.some((t) => t.reference) ? (
            <span className="truncate font-mono tabular text-num-sm text-ink-subtle">
              {r.tenders
                .filter((t) => t.reference)
                .map((t) => t.reference)
                .join(', ')}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'by', header: 'Cashier', width: '100px', sortValue: (r) => r.settledBy, csv: (r) => r.settledBy, cell: (r) => <span className="text-body text-ink-muted">{r.settledBy}</span> },
    {
      key: 'discount',
      header: 'Discount',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.discount,
      csv: (r) => formatDecimal(r.discount),
      cell: (r) => (isPositive(r.discount) ? <Money value={r.discount} currency={false} tone="attention" /> : <NumCell tone="muted">··</NumCell>),
    },
    {
      key: 'status',
      header: 'State',
      width: '120px',
      sortValue: (r) => r.status,
      csv: (r) => r.status,
      cell: (r) => <StatusChip status={r.status === 'settled' ? 'settled' : r.status === 'voided' ? 'voided' : 'review'} label={r.status === 'settled' ? undefined : r.status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())} />,
    },
    { key: 'total', header: 'Total', width: '120px', align: 'right', sortValue: (r) => r.total, csv: (r) => formatDecimal(r.total), cell: (r) => <Money value={r.total} currency={false} /> },
  ];

  const total = sum(rows.map((r) => r.total));
  const totalDiscount = sum(rows.map((r) => r.discount));
  const discountCount = rows.filter((r) => isPositive(r.discount)).length;
  const voidedCount = rows.filter((r) => r.status === 'voided').length;
  const avgBill = rows.length > 0 ? cents(Math.round(Number(total) / rows.length)) : ZERO;
  const kinds = mix.map((m) => ({ value: m.kind, label: TENDER_LABEL[m.kind] }));

  return (
    <div className="flex flex-col gap-24">
      {/* Executive Billing Performance Metrics */}
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        <Metric
          label={`Settled Revenue (${rangeLabel})`}
          value={<Money value={total} currency={false} decimals="whole" />}
          detail={`${plural(rows.length, 'bill')} finalized`}
          icon={IconReceipt}
          tone="poured"
        />
        <Metric
          label="Average Ticket"
          value={<Money value={avgBill} currency={false} decimals="whole" />}
          detail="Per settled party"
          icon={IconReceiptTax}
          tone="default"
        />
        <Metric
          label="Discounts Absorbed"
          value={<Money value={totalDiscount} currency={false} decimals="whole" />}
          detail={`${plural(discountCount, 'bill')} discounted`}
          icon={IconDiscount2}
          tone={totalDiscount > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="Voided / Exceptions"
          value={voidedCount}
          detail="Bills reversed or voided"
          icon={IconAlertCircle}
          tone={voidedCount > 0 ? 'stop' : 'default'}
        />
      </div>

      {/* Tender Settlement Mix Bento */}
      {mix.length > 0 ? (
        <ConsoleBentoCard
          title="Tender Settlement Mix"
          subtitle="How guests paid across cash, card, and digital channels, as the cashier recorded it"
          icon={IconCreditCard}
          tone="default"
        >
          <div className="py-8">
            <ShareBars rows={mix.map((m) => ({ key: m.kind, label: TENDER_LABEL[m.kind], value: m.amount, detail: plural(m.count, 'tender') }))} />
          </div>
        </ConsoleBentoCard>
      ) : null}

      <DataTable
        id="trade-bills"
        caption="Bills"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/trade/bills/${r.id}`}
        defaultSort={{ key: 'settled', dir: 'desc' }}
        leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
        search={{ placeholder: 'Bill, table or reference', test: (r, q) => String(r.number).includes(q) || r.table.toLowerCase().includes(q) || r.tenders.some((t) => t.reference?.toLowerCase().includes(q)) }}
        filters={[
          { kind: 'select', key: 'tender', label: 'Paid by', options: kinds, test: (r, v) => r.tenderKinds.includes(v as TenderKind) },
          { kind: 'select', key: 'cashier', label: 'Cashier', options: cashiers, test: (r, v) => r.settledById === v },
          { kind: 'toggle', key: 'discounted', label: 'Discounted only', test: (r) => isPositive(r.discount) },
        ]}
        exportName="bills"
        exportDate={exportDate}
        empty={{ title: 'No bills in this range', body: 'Bills appear once the counter settles a tab or a seat.' }}
      />
    </div>
  );
}
