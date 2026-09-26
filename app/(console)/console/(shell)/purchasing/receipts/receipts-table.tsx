'use client';

import { formatDateTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, sum } from '@bliss/shared/money';
import { ActionPill } from '@bliss/ui/components/console/action-pill';
import { Card, CardMedia, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout } from '@bliss/ui/components/console/section';
import { IconAlertTriangle, IconArrowBackUp, IconPackageImport, IconTruckDelivery } from '@tabler/icons-react';
import { EntityLink } from '../../_components/entity-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';

const STATE = { received: <StatusChip status="received" />, short: <StatusChip status="review" label="Short" />, reversed: <StatusChip status="voided" label="Reversed" /> };

export interface ReceiptRow {
  id: string;
  /** The first photograph of the delivery note, if one was taken. */
  photo: string | null;
  number: number;
  poId: string | null;
  poNumber: number | null;
  supplier: string;
  supplierId: string;
  deliveryNote: string;
  receivedAt: number;
  receivedBy: string;
  location: string;
  units: number;
  rejected: number;
  value: Cents;
  note: string | null;
  state: 'received' | 'short' | 'reversed';
}

/** Every delivery, newest first, with what was short or sent back. */
export function ReceiptsTable({ rows, timezone, suppliers }: { rows: ReceiptRow[]; timezone: string; suppliers: { value: string; label: string }[] }) {
  const live = rows.filter((r) => r.state !== 'reversed');
  const short = rows.filter((r) => r.state === 'short');
  const sentBack = live.reduce((n, r) => n + r.rejected, 0);
  const columns: Column<ReceiptRow>[] = [
    {
      key: 'number',
      header: 'Delivery',
      width: '120px',
      fixed: true,
      sortValue: (r) => r.number,
      csv: (r) => r.number,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num-md">{r.number}</span>} secondary={r.poNumber ? `Order ${r.poNumber}` : 'By hand'} />,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      width: 'minmax(170px,1.4fr)',
      sortValue: (r) => r.supplier,
      csv: (r) => r.supplier,
      cell: (r) => (
        <StackCell
          primary={
            <EntityLink kind="supplier" id={r.supplierId}>
              {r.supplier}
            </EntityLink>
          }
          secondary={r.note ?? undefined}
        />
      ),
    },
    { key: 'note', header: 'Delivery note', width: '120px', sortValue: (r) => r.deliveryNote, csv: (r) => r.deliveryNote, cell: (r) => <NumCell tone="muted">{r.deliveryNote}</NumCell> },
    {
      key: 'received',
      header: 'Received',
      width: '150px',
      sortValue: (r) => r.receivedAt,
      csv: (r) => new Date(r.receivedAt).toISOString(),
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num-md">{formatDateTime(r.receivedAt, timezone)}</span>} secondary={`${r.receivedBy}, into ${r.location}`} />,
    },
    {
      key: 'units',
      header: 'Units',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.units,
      csv: (r) => r.units,
      cell: (r) => (
        <span className="flex flex-col items-end">
          <NumCell>{r.units}</NumCell>
          {r.rejected > 0 ? <span className="text-body-sm text-stop">{r.rejected} sent back</span> : null}
        </span>
      ),
    },
    { key: 'state', header: 'State', width: '112px', sortValue: (r) => r.state, csv: (r) => r.state, cell: (r) => STATE[r.state] },
    {
      key: 'value',
      header: 'Value at cost',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.value,
      csv: (r) => formatDecimal(r.value),
      cell: (r) => <Money value={r.value} currency={false} size="num-md" decimals="whole" />,
    },
  ];
  return (
    <div className="flex flex-col gap-32">
      {short.length > 0 ? (
        <Callout
          size="hero"
          tone="low"
          icon={<IconAlertTriangle size={22} stroke={1.5} />}
          title={short.length === 1 ? `Delivery ${short[0]!.number} came short` : `${short.length} deliveries came short`}
          action={<ActionPill href={`/console/purchasing/receipts/${short[0]!.id}`}>Review</ActionPill>}
        >
          A short delivery waits for a manager to approve the difference.
        </Callout>
      ) : null}
      <MetricGrid>
        <Metric label="Deliveries" icon={IconTruckDelivery} value={<CountUp value={live.length} />} detail={rows.length > live.length ? `${rows.length - live.length} reversed` : 'None reversed'} />
        <Metric
          label="Received at cost"
          icon={IconPackageImport}
          tone="poured"
          value={<Money value={sum(live.map((r) => r.value))} size="num-kpi" decimals="whole" />}
          detail={`${live.reduce((n, r) => n + r.units, 0)} units in`}
        />
        <Metric
          label="Short, to approve"
          icon={IconAlertTriangle}
          tone={short.length > 0 ? 'attention' : 'default'}
          value={<CountUp value={short.length} delayMs={120} />}
          detail={short.length > 0 ? 'Waiting for a manager' : 'Nothing waiting'}
        />
        <Metric label="Sent back" icon={IconArrowBackUp} tone={sentBack > 0 ? 'stop' : 'default'} value={<CountUp value={sentBack} delayMs={180} />} detail="Units refused at the door" />
      </MetricGrid>
      <DataTable
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full" tone={r.state === 'short' ? 'low' : undefined}>
            <CardMedia src={r.photo} title={`Delivery ${r.number}`} subtitle={r.supplier} href={`/console/purchasing/receipts/${r.id}`} meta={STATE[r.state]} />
            <KeyRows>
              <KeyRow label="Received">{formatDateTime(r.receivedAt, timezone)}</KeyRow>
              <KeyRow label="Units">{r.units}</KeyRow>
              <KeyRow label="Sent back" tone={r.rejected > 0 ? 'stop' : undefined}>
                {r.rejected > 0 ? r.rejected : 'None'}
              </KeyRow>
              <KeyRow label="Order">{r.poNumber ? `PO ${r.poNumber}` : 'By hand'}</KeyRow>
              <KeyRow label="Value">
                <Money value={r.value} currency={false} size="num-md" decimals="whole" />
              </KeyRow>
            </KeyRows>
          </Card>
        )}
        id="purchasing-receipts"
        caption="Deliveries"
        noun={['delivery', 'deliveries']}
        rows={rows}
        rowTone={(r) => (r.state === 'reversed' ? 'muted' : r.state === 'short' ? 'attention' : 'default')}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/purchasing/receipts/${r.id}`}
        defaultSort={{ key: 'received', dir: 'desc' }}
        search={{ placeholder: 'Delivery or delivery note number', test: (r, q) => r.deliveryNote.toLowerCase().includes(q) || String(r.number).includes(q) }}
        filters={[
          { kind: 'select', key: 'supplier', label: 'Supplier', options: suppliers, test: (r, v) => r.supplierId === v },
          { kind: 'toggle', key: 'rejections', label: 'With items sent back', test: (r) => r.rejected > 0 },
          { kind: 'toggle', key: 'short', label: 'Short, to approve', test: (r) => r.state === 'short' },
        ]}
        exportName="receipts"
        empty={{ title: 'Nothing received yet', body: 'Receive a delivery against its order, or by hand, and it appears here.' }}
        emptyFiltered={{ title: 'No deliveries match', body: 'Clear the supplier, toggles or search to see every delivery.' }}
      />
    </div>
  );
}
