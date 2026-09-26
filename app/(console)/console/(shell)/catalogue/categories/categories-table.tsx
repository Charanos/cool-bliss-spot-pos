'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';

export interface CategoryRow {
  id: string;
  order: number;
  name: string;
  colour: CategoryColourToken;
  routing: string;
  tracked: boolean;
  products: number;
  active: boolean;
}

/** Categories in the order the floor shows its tabs: where their lines go, and whether stock is counted. */
export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const columns: Column<CategoryRow>[] = [
    { key: 'order', header: 'Order', width: '72px', align: 'right', sortValue: (r) => r.order, csv: (r) => r.order, cell: (r) => <NumCell tone="muted">{r.order}</NumCell> },
    {
      key: 'name',
      header: 'Category',
      width: 'minmax(180px,1.5fr)',
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
    { key: 'routing', header: 'Fired lines go to', width: '160px', sortValue: (r) => r.routing, csv: (r) => r.routing, cell: (r) => <span className="text-ui text-ink-muted">{r.routing}</span> },
    { key: 'stock', header: 'Stock', width: '128px', sortValue: (r) => Number(r.tracked), csv: (r) => (r.tracked ? 'Tracked' : 'Not tracked'), cell: (r) => <span className="text-ui text-ink-muted">{r.tracked ? 'Tracked' : 'Not tracked'}</span> },
    { key: 'products', header: 'Products on sale', width: '144px', align: 'right', sortValue: (r) => r.products, csv: (r) => r.products, cell: (r) => <NumCell>{r.products}</NumCell> },
    { key: 'state', header: 'State', width: '112px', sortValue: (r) => Number(r.active), csv: (r) => (r.active ? 'On sale' : 'Archived'), cell: (r) => <StatusChip status={r.active ? 'active' : 'retired'} label={r.active ? 'On sale' : 'Archived'} /> },
  ];
  return (
    <DataTable
      id="catalogue-categories"
      caption="Categories"
      noun={['category', 'categories']}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'order', dir: 'asc' }}
      rowTone={(r) => (r.active ? 'default' : 'muted')}
      exportName="categories"
      empty={{ title: 'No categories yet', body: 'A category groups products into a tab on the floor.' }}
    />
  );
}
