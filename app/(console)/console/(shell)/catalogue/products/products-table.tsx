'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBottle, IconBuildingWarehouse, IconCategory, IconCheck } from '@tabler/icons-react';
import { ProductThumb } from '../../_components/product-thumb';

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

/** Everything on the menu: how it is sold, from what price, and how its stock is watched. */
export function ProductsTable({ rows, categories }: { rows: ProductRow[]; categories: { value: string; label: string }[] }) {
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const archivedCount = rows.filter((r) => r.status === 'archived').length;
  const trackedCount = rows.filter((r) => r.tracked).length;
  const categoryCount = new Set(rows.map((r) => r.categoryId)).size;
  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      width: 'minmax(220px,2fr)',
      fixed: true,
      sortValue: (r) => r.name,
      csv: (r) => r.name,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <ProductThumb name={r.name} imageKey={r.imageKey} colour={r.colour} />
          <StackCell primary={r.name} secondary={`${r.category}, ${r.sku}`} />
        </span>
      ),
    },
    { key: 'category', header: 'Category', width: '0px', exportOnly: true, csv: (r) => r.category, cell: () => null },
    {
      key: 'serves',
      header: 'Sold as',
      width: 'minmax(140px,1.2fr)',
      csv: (r) => r.serves.join('; '),
      cell: (r) => <span className="truncate text-body-sm text-ink-muted" title={r.serves.join(', ')}>{r.serves.join(', ')}</span>,
    },
    { key: 'container', header: 'Bottle', width: '80px', align: 'right', sortValue: (r) => r.container, csv: (r) => r.container ?? '', cell: (r) => <NumCell tone="muted">{r.container ? `${r.container}ml` : 'None'}</NumCell> },
    { key: 'price', header: 'From', width: '100px', align: 'right', sortValue: (r) => r.fromPrice, csv: (r) => (r.fromPrice === null ? '' : formatDecimal(r.fromPrice)), cell: (r) => (r.fromPrice === null ? <NumCell tone="muted">No price</NumCell> : <Money value={r.fromPrice} currency={false} size="num-md" decimals="whole" />) },
    {
      key: 'threshold',
      header: 'Low at',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.effectiveThreshold,
      csv: (r) => r.effectiveThreshold,
      cell: (r) => (r.tracked ? <span title={r.thresholdIsDefault ? 'Outlet default' : 'Set for this product'}><NumCell tone={r.thresholdIsDefault ? 'muted' : 'default'}>{r.effectiveThreshold}</NumCell></span> : <NumCell tone="muted">None</NumCell>),
    },
    { key: 'supplier', header: 'Supplier', width: 'minmax(120px,1fr)', sortValue: (r) => r.supplier, csv: (r) => r.supplier ?? '', cell: (r) => <span className="truncate text-ui text-ink-muted">{r.supplier ?? 'None set'}</span> },
    { key: 'status', header: 'State', width: '112px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status === 'active' ? 'active' : 'retired'} label={r.status === 'active' ? 'On sale' : 'Archived'} /> },
  ];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Products" icon={IconBottle} value={<CountUp value={rows.length} />} detail={archivedCount > 0 ? `${archivedCount} archived` : 'None archived'} />
        <Metric label="On sale" icon={IconCheck} tone="poured" value={<CountUp value={activeCount} delayMs={60} />} detail="On the floor and at the counter" />
        <Metric label="Stock tracked" icon={IconBuildingWarehouse} value={<CountUp value={trackedCount} delayMs={120} />} detail="Counted, and warned about when low" />
        <Metric label="Categories" icon={IconCategory} href="/console/catalogue/categories" value={<CountUp value={categoryCount} delayMs={180} />} detail="The floor's tabs" />
      </MetricGrid>

      <DataTable
        id="catalogue-products"
        caption="Products"
        noun={['product', 'products']}
        rows={rows}
        rowTone={(r) => (r.status === 'archived' ? 'muted' : 'default')}
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
        empty={{ title: 'No products yet', body: 'Products appear here once they are in the catalogue.' }}
        emptyFiltered={{ title: 'No products match', body: 'Clear the category, the toggle or the search to see every product.' }}
      />
    </div>
  );
}
