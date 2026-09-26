'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { formatDate } from '@bliss/shared/format';
import { type Cents, formatDecimal, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { IconChecks, IconClockExclamation, IconPackageImport, IconShoppingCart, IconTruckDelivery } from '@tabler/icons-react';
import { EntityLink } from '../../_components/entity-link';
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

/** Purchase orders, newest first: their state, and how much of each has come. */
export function OrdersTable({ rows, timezone, suppliers, now }: { rows: OrderRow[]; timezone: string; suppliers: { value: string; label: string }[]; now: number }) {
  const open = rows.filter((r) => r.status === 'sent' || r.status === 'partially_received');
  const drafts = rows.filter((r) => r.status === 'draft');
  const late = open.filter((r) => r.expectedAt !== null && r.expectedAt < now - 86_400_000);
  const received = rows.filter((r) => r.status === 'received');
  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      header: 'Order',
      width: '90px',
      fixed: true,
      sortValue: (r) => r.number,
      csv: (r) => r.number,
      cell: (r) => <span className="font-mono tabular text-num-md text-ink">{r.number}</span>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      width: 'minmax(180px,1.5fr)',
      sortValue: (r) => r.supplier,
      csv: (r) => r.supplier,
      cell: (r) => (
        <StackCell
          primary={
            <EntityLink kind="supplier" id={r.supplierId}>
              {r.supplier}
            </EntityLink>
          }
          secondary={r.notes ?? undefined}
        />
      ),
    },
    {
      key: 'status',
      header: 'State',
      width: '150px',
      sortValue: (r) => ['draft', 'sent', 'partially_received', 'received', 'cancelled'].indexOf(r.status),
      csv: (r) => r.status,
      cell: (r) => <StatusChip {...ORDER_STATUS[r.status]} />,
    },
    {
      key: 'raised',
      header: 'Raised',
      width: '130px',
      sortValue: (r) => r.raisedAt,
      csv: (r) => new Date(r.raisedAt).toISOString(),
      cell: (r) => <StackCell primary={formatDate(r.raisedAt, timezone)} secondary={r.raisedBy} />,
    },
    {
      key: 'received',
      header: 'Received',
      width: '150px',
      align: 'right',
      sortValue: (r) => (r.ordered ? r.received / r.ordered : 0),
      csv: (r) => `${r.received}/${r.ordered}`,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-8">
          <InlineBar value={r.ordered ? r.received / r.ordered : 0} tone={r.received >= r.ordered ? 'poured' : 'accent'} />
          <NumCell tone={r.received === 0 ? 'muted' : r.received < r.ordered ? 'low' : 'poured'}>
            {r.received} of {r.ordered}
          </NumCell>
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Value',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.total,
      csv: (r) => formatDecimal(r.total),
      cell: (r) => <Money value={r.total} currency={false} size="num-md" decimals="whole" />,
    },
  ];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric
          label="On its way"
          icon={IconTruckDelivery}
          tone={open.length > 0 ? 'info' : 'default'}
          value={<Money value={sum(open.map((r) => r.total))} size="num-kpi" decimals="whole" />}
          detail={`${open.length} ${open.length === 1 ? 'order' : 'orders'} awaiting delivery`}
        />
        <Metric
          label="Needs approval"
          icon={IconChecks}
          tone={drafts.length > 0 ? 'attention' : 'default'}
          value={<CountUp value={drafts.length} delayMs={60} />}
          detail={drafts.length > 0 ? 'Raised, not yet sent' : 'Nothing waiting'}
        />
        <Metric
          label="Late"
          icon={IconClockExclamation}
          tone={late.length > 0 ? 'stop' : 'default'}
          value={<CountUp value={late.length} delayMs={120} />}
          detail={late.length > 0 ? 'Past the day they were due' : 'Nothing overdue'}
        />
        <Metric label="Received" icon={IconPackageImport} tone="poured" value={<CountUp value={received.length} delayMs={180} />} detail="In full" href="/console/purchasing/receipts" />
      </MetricGrid>
      <DataTable
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full" tone={late.includes(r) ? 'stop' : r.status === 'draft' ? 'low' : undefined}>
            <CardHeader band title={`Order ${r.number}`} subtitle={r.supplier} href={`/console/purchasing/orders/${r.id}`} meta={<StatusChip {...ORDER_STATUS[r.status]} />} />
            <CardStats columns={3}>
              <Stat label="Lines">{r.lines}</Stat>
              <Stat label="Raised">{formatDate(r.raisedAt, timezone)}</Stat>
              <Stat label="Due" tone={late.includes(r) ? 'stop' : undefined}>
                {r.expectedAt ? formatDate(r.expectedAt, timezone) : 'Not set'}
              </Stat>
            </CardStats>
            <CardFooter>
              <span className="inline-flex items-center gap-8 text-body-sm text-ink-muted">
                <InlineBar value={r.ordered ? r.received / r.ordered : 0} tone={r.received >= r.ordered ? 'poured' : 'accent'} />
                {r.received} of {r.ordered} in
              </span>
              <Money value={r.total} size="num-md" decimals="whole" />
            </CardFooter>
          </Card>
        )}
        id="purchasing-orders"
        caption="Purchase orders"
        noun={['order', 'orders']}
        rows={rows}
        rowTone={(r) => (r.status === 'cancelled' ? 'muted' : 'default')}
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
        emptyFiltered={{ title: 'No orders match', body: 'Clear the state or supplier to see every order.' }}
        empty={{
          title: 'No purchase orders yet',
          body: 'Raise one from the reorder suggestions, which are worked out from what sold.',
          action: (
            <ButtonLink href="/console/purchasing/reorder" icon={IconShoppingCart}>
              See reorder suggestions
            </ButtonLink>
          ),
        }}
      />
    </div>
  );
}
