'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { formatDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { cx } from '@bliss/ui/lib/cx';
import Link from 'next/link';
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
      leading={
        <Link
          href="/console/purchasing/orders/new"
          className="group relative inline-flex h-[32px] items-center gap-6 rounded-full bg-accent text-accent-ink px-16 text-[13px] font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_1px_3px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_3px_6px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] active:scale-[0.98] active:translate-y-0"
        >
          <IconShoppingCart size={14} stroke={2.5} className="transition-transform duration-300 group-hover:scale-110" />
          <span>Raise order</span>
        </Link>
      }
      rowKey={(r) => r.id}
      rowHref={(r) => `/console/purchasing/orders/${r.id}`}
      defaultSort={{ key: 'raised', dir: 'desc' }}
      renderGridCard={(r) => (
        <Link href={`/console/purchasing/orders/${r.id}`} className="text-left w-full h-[320px] bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          {/* Header */}
          <div className="flex flex-col p-20 bg-desk-hover border-b border-hairline/40 shrink-0">
            <div className="flex items-center justify-between mb-8">
              <span className="font-mono text-[11px] font-bold tracking-widest text-desk-muted uppercase">PO {r.number}</span>
              <StatusChip {...ORDER_STATUS[r.status]} />
            </div>
            <span className="text-title font-medium text-ink truncate mb-4">{r.supplier}</span>
            <span className="text-micro text-ink-subtle truncate">Raised by {r.raisedBy}</span>
          </div>

          {/* Details */}
          <div className="flex flex-col flex-1 p-20 text-body-sm bg-page w-full">
            <div className="flex flex-col mt-auto gap-8">
              <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Lines</span>
                <span className="text-ink font-medium">{r.lines}</span>
              </div>
              <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Received</span>
                <span className={cx("font-mono font-medium", r.received === 0 ? "text-ink-muted" : r.received < r.ordered ? "text-low" : "text-poured")}>
                  {r.received} / {r.ordered}
                </span>
              </div>
              <div className="flex justify-between items-center py-8">
                <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Value</span>
                <Money value={r.total} currency={false} decimals="whole" className="font-medium text-[15px]" />
              </div>
            </div>
          </div>
        </Link>
      )}
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
