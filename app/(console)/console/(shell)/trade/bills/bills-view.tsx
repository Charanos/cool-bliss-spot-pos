'use client';

import type { BillScope, BillStatus, TenderKind } from '@bliss/shared/domain';
import { formatDateTime, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { type Cents, ZERO, cents, formatDecimal, isPositive, sum } from '@bliss/shared/money';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { Card, CardBody, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconCreditCard, IconDiscount2, IconReceipt, IconReceiptOff, IconReceiptTax } from '@tabler/icons-react';
import { UrlSelect } from '../../_components/url-select';
import { SCOPE_LABEL, TENDER_LABEL } from '../../_lib/labels';

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

const STATE_WORD: Record<BillStatus, string> = { open: 'Open', settled: 'Settled', voided: 'Voided', refunded: 'Refunded', partially_refunded: 'Part refunded' };

function BillState({ status }: { status: BillStatus }) {
  if (status === 'settled') return <StatusChip status="settled" />;
  if (status === 'voided') return <StatusChip status="voided" />;
  return <ToneChip tone="low">{STATE_WORD[status]}</ToneChip>;
}

const paidBy = (r: BillRow) => r.tenders.map((t) => TENDER_LABEL[t.kind]).join(' and ') || 'Not recorded';
const references = (r: BillRow) =>
  r.tenders
    .map((t) => t.reference)
    .filter(Boolean)
    .join(', ');

/** Settled bills for a range of business days: the figures, how guests paid, and every bill. */
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
      width: '104px',
      fixed: true,
      sortValue: (r) => r.number,
      csv: (r) => r.number,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num-md">{r.number}</span>} secondary={formatIsoDate(r.businessDate)} />,
    },
    {
      key: 'settled',
      header: 'Settled',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.settledAt,
      csv: (r) => (r.settledAt ? new Date(r.settledAt).toISOString() : ''),
      cell: (r) => <NumCell tone="muted">{r.settledAt ? formatTime(r.settledAt, timezone) : 'Not settled'}</NumCell>,
    },
    {
      key: 'table',
      header: 'Table',
      width: 'minmax(140px,1.2fr)',
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
      header: 'Paid by',
      width: 'minmax(150px,1.3fr)',
      csv: (r) => r.tenders.map((t) => `${TENDER_LABEL[t.kind]} ${formatDecimal(t.amount)}${t.reference ? ` ${t.reference}` : ''}`).join('; '),
      cell: (r) => <StackCell primary={paidBy(r)} secondary={references(r) ? <span className="font-mono tabular">{references(r)}</span> : undefined} />,
    },
    { key: 'by', header: 'Cashier', width: '96px', sortValue: (r) => r.settledBy, csv: (r) => r.settledBy, cell: (r) => <span className="text-ui text-ink-muted">{r.settledBy}</span> },
    {
      key: 'discount',
      header: 'Discount',
      width: '88px',
      align: 'right',
      sortValue: (r) => r.discount,
      csv: (r) => formatDecimal(r.discount),
      cell: (r) => (isPositive(r.discount) ? <Money value={r.discount} currency={false} size="num-md" tone="attention" /> : <NumCell tone="muted">None</NumCell>),
    },
    { key: 'status', header: 'State', width: '112px', sortValue: (r) => r.status, csv: (r) => STATE_WORD[r.status], cell: (r) => <BillState status={r.status} /> },
    { key: 'total', header: 'Total', width: '120px', align: 'right', sortValue: (r) => r.total, csv: (r) => formatDecimal(r.total), cell: (r) => <Money value={r.total} size="num-md" /> },
  ];

  const settled = rows.filter((r) => r.status !== 'voided');
  const total = sum(settled.map((r) => r.total));
  const totalDiscount = sum(rows.map((r) => r.discount));
  const discountCount = rows.filter((r) => isPositive(r.discount)).length;
  const voidedCount = rows.length - settled.length;
  const average = settled.length > 0 ? cents(Math.round(Number(total) / settled.length)) : ZERO;
  const kinds = mix.map((m) => ({ value: m.kind, label: TENDER_LABEL[m.kind] }));

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Settled" icon={IconReceipt} tone="poured" value={<Money value={total} size="num-kpi" decimals="whole" />} detail={`${plural(settled.length, 'bill')}, ${rangeLabel}`} />
        <Metric label="Average bill" icon={IconReceiptTax} value={<Money value={average} size="num-kpi" decimals="whole" />} detail="Per settled bill" />
        <Metric
          label="Discounts"
          icon={IconDiscount2}
          tone={isPositive(totalDiscount) ? 'attention' : 'default'}
          value={<Money value={totalDiscount} size="num-kpi" decimals="whole" />}
          detail={discountCount > 0 ? `On ${plural(discountCount, 'bill')}` : 'No bill was discounted'}
        />
        <Metric
          label="Voided bills"
          icon={IconReceiptOff}
          tone={voidedCount > 0 ? 'stop' : 'default'}
          value={<CountUp value={voidedCount} />}
          detail={voidedCount > 0 ? 'Open each one to see who approved it' : 'Nothing was voided'}
        />
      </MetricGrid>

      {mix.length > 0 ? (
        <Card>
          <CardHeader band icon={IconCreditCard} title="Tender mix" subtitle="How guests paid, as the cashier recorded it" />
          <CardBody>
            <ShareBars rows={mix.map((m) => ({ key: m.kind, label: TENDER_LABEL[m.kind], value: m.amount, detail: plural(m.count, 'tender') }))} />
          </CardBody>
        </Card>
      ) : null}

      <DataTable
        id="trade-bills"
        caption="Bills"
        noun={['bill', 'bills']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/trade/bills/${r.id}`}
        defaultSort={{ key: 'settled', dir: 'desc' }}
        rowTone={(r) => (r.status === 'voided' ? 'muted' : 'default')}
        leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
        search={{ placeholder: 'Bill, table or reference', test: (r, q) => String(r.number).includes(q) || r.table.toLowerCase().includes(q) || r.tenders.some((t) => t.reference?.toLowerCase().includes(q)) }}
        filters={[
          { kind: 'select', key: 'tender', label: 'Paid by', options: kinds, test: (r, v) => r.tenderKinds.includes(v as TenderKind) },
          { kind: 'select', key: 'cashier', label: 'Cashier', options: cashiers, test: (r, v) => r.settledById === v },
          { kind: 'toggle', key: 'discounted', label: 'Discounted only', test: (r) => isPositive(r.discount) },
        ]}
        exportName="bills"
        exportDate={exportDate}
        empty={{ title: 'No bills in this range', body: 'A bill appears here once the counter settles a tab or a seat. Try a longer range.' }}
        emptyFiltered={{ title: 'No bills match these filters', body: 'Clear the tender, cashier or search to see every bill in the range.' }}
        footer={
          settled.length > 0 ? (
            <div className="flex items-baseline justify-between gap-16">
              <span className="text-body-sm text-ink-muted">Settled in this range, voided bills excluded</span>
              <Money value={total} size="num-lg" />
            </div>
          ) : undefined
        }
        renderGridCard={(r) => (
          <Card as="article" interactive tone={r.status === 'voided' ? 'stop' : undefined} className="h-full">
            <CardHeader
              band
              href={`/console/trade/bills/${r.id}`}
              title={<span className="font-mono tabular">Bill {r.number}</span>}
              subtitle={r.settledAt ? formatDateTime(r.settledAt, timezone) : formatIsoDate(r.businessDate)}
              meta={<BillState status={r.status} />}
            />
            <CardStats>
              <Stat label="Table">
                <span className="inline-flex min-w-0 items-center gap-6">
                  {r.seatNo ? <SeatChip seat={r.seatNo} size="dense" /> : null}
                  <span className="truncate">{r.table}</span>
                </span>
              </Stat>
              <Stat label="Paid by">{paidBy(r)}</Stat>
              <Stat label="Cashier">{r.settledBy}</Stat>
              <Stat label="Discount" tone={isPositive(r.discount) ? 'low' : undefined}>
                {isPositive(r.discount) ? <Money value={r.discount} size="num-md" /> : 'None'}
              </Stat>
            </CardStats>
            <CardFooter>
              <span className="text-body-sm text-ink-muted">{SCOPE_LABEL[r.scope]}</span>
              <Money value={r.total} size="num-md" />
            </CardFooter>
          </Card>
        )}
      />
    </div>
  );
}
