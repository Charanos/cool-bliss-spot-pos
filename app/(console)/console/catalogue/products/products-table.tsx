'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';

export interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  sku: string;
  categoryId: string;
  category: string;
  colour: CategoryColourToken;
  imageKey: string | null;
  container: number | null;
  serves: string[];
  fromPrice: Cents | null;
  threshold: number | null;
  thresholdIsDefault: boolean;
  effectiveThreshold: number;
  tracked: boolean;
  supplier: string | null;
  status: 'active' | 'archived';
}

export function ProductsTable({ rows, categories }: { rows: ProductRow[]; categories: { value: string; label: string }[] }) {
  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      width: 'minmax(240px,2fr)',
      fixed: true,
      sortValue: (r) => r.name,
      csv: (r) => r.name,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <span className="relative size-[36px] shrink-0 overflow-hidden rounded-sm bg-sunken">
            {r.imageKey ? (
              // eslint-disable-next-line @next/next/no-img-element -- a 36px catalogue thumbnail from the asset store
              <img src={`https://images.unsplash.com/photo-${r.imageKey}?auto=format&fit=crop&w=72&h=72&q=60`} alt="" className="size-full object-cover" loading="lazy" />
            ) : null}
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${categoryEdgeClass(r.colour)}`} />
          </span>
          <StackCell primary={r.name} secondary={`${r.category} · ${r.sku}`} />
        </span>
      ),
    },
    { key: 'category', header: 'Category', width: '0px', exportOnly: true, csv: (r) => r.category, cell: () => null },
    {
      key: 'serves',
      header: 'Sold as',
      width: 'minmax(160px,1.4fr)',
      csv: (r) => r.serves.join('; '),
      cell: (r) => <span className="text-body text-ink-muted" title={r.serves.join(', ')}>{r.serves.join(', ')}</span>,
    },
    { key: 'container', header: 'Bottle', width: '80px', align: 'right', sortValue: (r) => r.container, csv: (r) => r.container ?? '', cell: (r) => <NumCell tone="muted">{r.container ? `${r.container}ml` : '··'}</NumCell> },
    { key: 'price', header: 'From', width: '100px', align: 'right', sortValue: (r) => r.fromPrice, csv: (r) => (r.fromPrice === null ? '' : formatDecimal(r.fromPrice)), cell: (r) => (r.fromPrice === null ? <NumCell tone="muted">··</NumCell> : <Money value={r.fromPrice} currency={false} decimals="whole" />) },
    {
      key: 'threshold',
      header: 'Low at',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.effectiveThreshold,
      csv: (r) => r.effectiveThreshold,
      cell: (r) => (r.tracked ? <span title={r.thresholdIsDefault ? 'Outlet default' : 'Set for this product'}><NumCell tone={r.thresholdIsDefault ? 'muted' : 'default'}>{r.effectiveThreshold}</NumCell></span> : <NumCell tone="muted">··</NumCell>),
    },
    { key: 'supplier', header: 'Supplier', width: 'minmax(140px,1fr)', sortValue: (r) => r.supplier, csv: (r) => r.supplier ?? '', cell: (r) => <span className="text-body text-ink-muted">{r.supplier ?? 'None'}</span> },
    { key: 'status', header: 'State', width: '100px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status === 'active' ? 'active' : 'retired'} label={r.status === 'active' ? 'On sale' : 'Archived'} /> },
  ];

  return (
    <DataTable
      id="catalogue-products"
      caption="Products"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/console/catalogue/products/${r.id}`}
      defaultSort={{ key: 'name', dir: 'asc' }}
      search={{ placeholder: 'Name, brand or SKU', test: (r, q) => r.name.toLowerCase().includes(q) || (r.brand ?? '').toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) }}
      filters={[
        { kind: 'select', key: 'category', label: 'Category', options: categories, test: (r, v) => r.categoryId === v },
        { kind: 'toggle', key: 'own-threshold', label: 'Own low threshold', test: (r) => !r.thresholdIsDefault },
      ]}
      exportName="products"
      empty={{ title: 'Your catalogue is empty', body: 'Import a CSV, or add your first product by hand.' }}
    />
  );
}
