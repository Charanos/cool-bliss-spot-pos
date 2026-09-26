'use client';

import { formatBps, formatDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';

export interface CostChangeRow {
  id: string;
  item: string;
  supplier: string;
  supplierId: string;
  sku: string;
  from: Cents;
  to: Cents;
  changeBps: number;
  at: number;
}

/** A rise above five per cent is worth a look at the sell price. */
const NOTABLE_BPS = 500;

/** Supplier prices that moved, largest rise first. */
export function CostChangesTable({ rows, timezone }: { rows: CostChangeRow[]; timezone: string }) {
  const columns: Column<CostChangeRow>[] = [
    { key: 'item', header: 'Item', width: 'minmax(180px,1.5fr)', fixed: true, sortValue: (r) => r.item, csv: (r) => r.item, cell: (r) => <StackCell primary={r.item} secondary={`${r.supplier}, ${r.sku}`} /> },
    { key: 'from', header: 'Was', width: '110px', align: 'right', sortValue: (r) => r.from, csv: (r) => formatDecimal(r.from), cell: (r) => <Money value={r.from} currency={false} size="num-md" tone="muted" /> },
    { key: 'to', header: 'Now', width: '110px', align: 'right', sortValue: (r) => r.to, csv: (r) => formatDecimal(r.to), cell: (r) => <Money value={r.to} currency={false} size="num-md" /> },
    {
      key: 'change',
      header: 'Change',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.changeBps,
      csv: (r) => (r.changeBps / 100).toFixed(2),
      cell: (r) => <NumCell tone={r.changeBps >= NOTABLE_BPS ? 'low' : r.changeBps < 0 ? 'poured' : 'default'}>{formatBps(r.changeBps, { signed: true })}</NumCell>,
    },
    { key: 'at', header: 'Since', width: '120px', sortValue: (r) => r.at, csv: (r) => new Date(r.at).toISOString(), cell: (r) => <NumCell tone="muted">{formatDate(r.at, timezone)}</NumCell> },
  ];
  return (
    <DataTable
      id="purchasing-cost-changes"
      caption="Supplier cost changes"
      noun={['change', 'changes']}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'change', dir: 'desc' }}
      urlState={false}
      exportName="cost-changes"
      empty={{ title: 'No cost changes', body: 'Every supplier is charging what they charged on the last delivery.' }}
    />
  );
}
