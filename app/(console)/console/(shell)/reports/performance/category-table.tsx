'use client';

import { formatBps } from '@bliss/shared/format';
import { formatDecimal, isPositive } from '@bliss/shared/money';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';
import type { CategoryPerformance } from '@/modules/reporting/performance';

/** Sales, margin and pour cost by category. Uncosted sales are shown, not counted as free. */
export function CategoryTable({ rows }: { rows: CategoryPerformance[] }) {
  const columns: Column<CategoryPerformance>[] = [
    {
      key: 'name',
      header: 'Category',
      width: 'minmax(160px,1.4fr)',
      fixed: true,
      sortValue: (r) => r.name,
      csv: (r) => r.name,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <span aria-hidden="true" className={cx('h-control-sm w-2 shrink-0 rounded-sm', categoryEdgeClass(r.colour))} />
          <span className="truncate text-ui font-medium text-ink">{r.name}</span>
        </span>
      ),
    },
    { key: 'units', header: 'Sold', width: '88px', align: 'right', sortValue: (r) => r.units, csv: (r) => r.units, cell: (r) => <NumCell>{r.units}</NumCell> },
    { key: 'sales', header: 'Sales', width: '128px', align: 'right', sortValue: (r) => r.sales, csv: (r) => formatDecimal(r.sales), cell: (r) => <Money value={r.sales} currency={false} size="num-md" decimals="whole" /> },
    { key: 'cost', header: 'Cost', width: '120px', align: 'right', sortValue: (r) => r.cost, csv: (r) => formatDecimal(r.cost), cell: (r) => <Money value={r.cost} currency={false} size="num-md" decimals="whole" tone="muted" /> },
    {
      key: 'pour',
      header: 'Cost of sales',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.costBps,
      csv: (r) => (r.costBps === null ? '' : (r.costBps / 100).toFixed(1)),
      cell: (r) => (r.costBps === null ? <NumCell tone="muted">Not costed</NumCell> : <NumCell tone={r.costBps > 4000 ? 'low' : 'default'}>{formatBps(r.costBps)}</NumCell>),
    },
    {
      key: 'margin',
      header: 'Margin',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.marginBps,
      csv: (r) => (r.marginBps / 100).toFixed(1),
      cell: (r) => (isPositive(r.uncosted) && r.uncosted === r.sales ? <NumCell tone="muted">Not costed</NumCell> : <NumCell>{formatBps(r.marginBps)}</NumCell>),
    },
    {
      key: 'uncosted',
      header: 'No cost recorded',
      width: '144px',
      align: 'right',
      sortValue: (r) => r.uncosted,
      csv: (r) => formatDecimal(r.uncosted),
      cell: (r) => (isPositive(r.uncosted) ? <Money value={r.uncosted} currency={false} size="num-md" decimals="whole" tone="attention" /> : <NumCell tone="muted">None</NumCell>),
    },
  ];
  return (
    <DataTable
      id="performance-categories"
      caption="Performance by category"
      noun={['category', 'categories']}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'sales', dir: 'desc' }}
      toolbar={false}
      urlState={false}
      exportName="performance-categories"
      empty={{ title: 'Nothing sold in this range', body: 'Choose a range with trading in it.' }}
    />
  );
}
