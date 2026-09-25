'use client';

import { formatDateTime } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';

export interface ReceiptRow {
  id: string;
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
}

export function ReceiptsTable({ rows, timezone, suppliers }: { rows: ReceiptRow[]; timezone: string; suppliers: { value: string; label: string }[] }) {
  const columns: Column<ReceiptRow>[] = [
    {
      key: 'number',
      header: 'Receipt',
      width: '120px',
      fixed: true,
      sortValue: (r) => r.number,
      csv: (r) => r.number,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num">GRN {r.number}</span>} secondary={r.poNumber ? `PO ${r.poNumber}` : 'No order'} />,
    },
    { key: 'supplier', header: 'Supplier', width: 'minmax(170px,1.4fr)', sortValue: (r) => r.supplier, csv: (r) => r.supplier, cell: (r) => <StackCell primary={r.supplier} secondary={r.note ?? undefined} /> },
    { key: 'note', header: 'Delivery note', width: '120px', sortValue: (r) => r.deliveryNote, csv: (r) => r.deliveryNote, cell: (r) => <NumCell tone="muted">{r.deliveryNote}</NumCell> },
    {
      key: 'received',
      header: 'Received',
      width: '150px',
      sortValue: (r) => r.receivedAt,
      csv: (r) => new Date(r.receivedAt).toISOString(),
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num">{formatDateTime(r.receivedAt, timezone)}</span>} secondary={`${r.receivedBy}, into ${r.location}`} />,
    },
    {
      key: 'units',
      header: 'Units',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.units,
      csv: (r) => r.units,
      cell: (r) => (
        <span className="flex flex-col items-end ">
          <NumCell>{r.units}</NumCell>
          {r.rejected > 0 ? <span className="text-body-sm text-stop">{r.rejected} sent back</span> : null}
        </span>
      ),
    },
    { key: 'value', header: 'Value at cost', width: '120px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
  ];
  return (
    <DataTable
      id="purchasing-receipts"
      caption="Goods received"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/console/purchasing/receipts/${r.id}`}
      defaultSort={{ key: 'received', dir: 'desc' }}
      search={{ placeholder: 'Delivery note or GRN', test: (r, q) => r.deliveryNote.toLowerCase().includes(q) || String(r.number).includes(q) }}
      filters={[
        { kind: 'select', key: 'supplier', label: 'Supplier', options: suppliers, test: (r, v) => r.supplierId === v },
        { kind: 'toggle', key: 'rejections', label: 'With items sent back', test: (r) => r.rejected > 0 },
      ]}
      exportName="receipts"
      empty={{ title: 'Nothing received yet', body: 'Receive a delivery from its purchase order and it appears here.' }}
    />
  );
}
