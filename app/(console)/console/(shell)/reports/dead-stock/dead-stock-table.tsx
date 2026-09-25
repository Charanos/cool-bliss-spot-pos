'use client';

import { formatDate, formatQty } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { IconHistory } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { UrlSelect } from '../../_components/url-select';

interface DeadRow {
  variantId: string;
  name: string;
  category: string;
  lastSaleAt: number | null;
  onHand: number;
  value: Cents;
  idleDays: number | null;
}

export function DeadStockTable({ rows, days, total, canSeeCost, timezone, windows }: { rows: DeadRow[]; days: number; total: Cents; canSeeCost: boolean; timezone: string; windows: { value: string; label: string }[] }) {
  const router = useRouter();
  const columns: Column<DeadRow>[] = [
    { key: 'name', header: 'Item', width: 'minmax(200px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={r.name} secondary={r.category} /> },
    { key: 'onHand', header: 'On hand', width: '100px', align: 'right', sortValue: (r) => r.onHand, csv: (r) => r.onHand, cell: (r) => <NumCell>{formatQty(r.onHand, 2)}</NumCell> },
    {
      key: 'last',
      header: 'Last sold',
      width: '150px',
      align: 'right',
      sortValue: (r) => r.lastSaleAt,
      csv: (r) => (r.lastSaleAt ? new Date(r.lastSaleAt).toISOString() : 'never'),
      cell: (r) => (r.lastSaleAt ? <StackCell primary={<span className="font-mono tabular text-num">{formatDate(r.lastSaleAt, timezone)}</span>} secondary={`${r.idleDays} days ago`} /> : <span className="text-body text-ink-subtle">Not in the record</span>),
    },
    ...(canSeeCost
      ? [{ key: 'value', header: 'Tied up at cost', width: '130px', align: 'right' as const, sortValue: (r: DeadRow) => r.value, csv: (r: DeadRow) => formatDecimal(r.value), cell: (r: DeadRow) => <Money value={r.value} currency={false} decimals="whole" /> }]
      : []),
  ];

  return (
    <DataTable
      id="report-dead-stock"
      caption={`Stock with no sale in ${days} days`}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.variantId}
      defaultSort={{ key: canSeeCost ? 'value' : 'onHand', dir: 'desc' }}
      leading={<UrlSelect param="days" label="Window" options={windows} allLabel={null} fallback={String(days)} />}
      rowActions={(r) => [{ key: 'movements', label: 'View movements', icon: IconHistory, onSelect: () => router.push(`/console/inventory/movements?variant=${r.variantId}&range=28`) }]}
      exportName="dead-stock"
      footer={
        rows.length > 0 && canSeeCost ? (
          <div className="flex items-baseline justify-between gap-16">
            <span className="text-body text-ink-muted">Tied up in items that have not sold in {days} days</span>
            <Money value={total} size="num-lg" decimals="whole" />
          </div>
        ) : undefined
      }
      empty={{
        title: `Everything has sold in the last ${days} days`,
        body: 'Nothing on the shelves is standing still.',
        action: (
          <ButtonLink href="/console/inventory/stock" variant="secondary">
            See all stock
          </ButtonLink>
        ),
      }}
    />
  );
}
