'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { formatDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconShoppingCart } from '@tabler/icons-react';
import { ORDER_STATUS } from '../../_lib/labels';

export interface OrderRow {
  id: string;
  number: number;
  supplier: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  raisedAt: number;
  raisedBy: string;
  expectedAt: number | null;
  lines: number;
  ordered: number;
  received: number;
  total: Cents;
  notes: string | null;
}

export function OrdersTable({ rows, timezone, suppliers }: { rows: OrderRow[]; timezone: string; suppliers: { value: string; label: string }[] }) {
  const columns: Column<OrderRow>[] = [
    { key: 'number', header: 'Order', width: '90px', fixed: true, sortValue: (r) => r.number, csv: (r) => r.number, cell: (r) => <span className="font-mono tabular text-num text-ink">PO {r.number}</span> },
    { key: 'supplier', header: 'Supplier', width: 'minmax(180px,1.5fr)', sortValue: (r) => r.supplier, csv: (r) => r.supplier, cell: (r) => <StackCell primary={r.supplier} secondary={r.notes ?? undefined} /> },
    {
      key: 'status',
      header: 'State',
      width: '150px',
      sortValue: (r) => ['draft', 'sent', 'partially_received', 'received', 'cancelled'].indexOf(r.status),
      csv: (r) => r.status,
      cell: (r) => <StatusChip {...ORDER_STATUS[r.status]} />,
    },
    { key: 'raised', header: 'Raised', width: '130px', sortValue: (r) => r.raisedAt, csv: (r) => new Date(r.raisedAt).toISOString(), cell: (r) => <StackCell primary={formatDate(r.raisedAt, timezone)} secondary={r.raisedBy} /> },
    {
      key: 'received',
      header: 'Received',
      width: '110px',
      align: 'right',
      sortValue: (r) => (r.ordered ? r.received / r.ordered : 0),
      csv: (r) => `${r.received}/${r.ordered}`,
      cell: (r) => (
        <NumCell tone={r.received === 0 ? 'muted' : r.received < r.ordered ? 'low' : 'poured'}>
          {r.received} of {r.ordered}
        </NumCell>
      ),
    },
    { key: 'total', header: 'Value', width: '120px', align: 'right', sortValue: (r) => r.total, csv: (r) => formatDecimal(r.total), cell: (r) => <Money value={r.total} currency={false} decimals="whole" /> },
  ];

  return (
    <DataTable
      id="purchasing-orders"
      caption="Purchase orders"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/console/purchasing/orders/${r.id}`}
      defaultSort={{ key: 'raised', dir: 'desc' }}
      filters={[
        {
          kind: 'chips',
          key: 'state',
          label: 'State',
          options: [
            { value: 'open', label: 'Awaiting delivery' },
            { value: 'draft', label: 'Needs approval' },
            { value: 'received', label: 'Received' },
          ],
          test: (r, v) => (v === 'open' ? r.status === 'sent' || r.status === 'partially_received' : r.status === v),
        },
        { kind: 'select', key: 'supplier', label: 'Supplier', options: suppliers, test: (r, v) => r.supplierId === v },
      ]}
      exportName="purchase-orders"
      empty={{
        title: 'No purchase orders yet',
        body: 'Raise one from the reorder suggestions, which come from real sales.',
        action: (
          <ButtonLink href="/console/purchasing/reorder" icon={IconShoppingCart}>
            See reorder suggestions
          </ButtonLink>
        ),
      }}
    />
  );
}
