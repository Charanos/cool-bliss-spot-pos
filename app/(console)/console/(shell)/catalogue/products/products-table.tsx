'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardMedia, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArchive, IconArrowBackUp, IconBottle, IconBuildingWarehouse, IconCategory, IconCheck, IconPencil, IconPlus } from '@tabler/icons-react';
import { assetUrl } from '@/lib/assets';
import { setProductStatus } from '../../_actions/menu';
import { EntityLink } from '../../_components/entity-link';
import { ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';
import { ProductThumb } from '../../_components/product-thumb';
import { ProductDialog, type ProductDraft } from '../_parts/product-dialog';

export interface ProductRow extends ProductDraft {
  category: string;
  colour: CategoryColourToken;
  serves: string[];
  fromPrice: Cents | null;
  threshold: number | null;
  thresholdIsDefault: boolean;
  effectiveThreshold: number;
  tracked: boolean;
  supplier: string | null;
  onHand: number | null;
  unit: string;
  status: 'active' | 'archived';
}

type Option = { value: string; label: string };

/** Everything on the menu: how it is sold, from what price, and how its stock is watched. */
export function ProductsTable({ rows, categories, suppliers, canEdit }: { rows: ProductRow[]; categories: Option[]; suppliers: Option[]; canEdit: boolean }) {
  const dialog = useDialog<'edit' | 'status', ProductRow | null>();
  useCreateParam(() => dialog.open('edit', null), canEdit);

  const activeCount = rows.filter((r) => r.status === 'active').length;
  const archivedCount = rows.length - activeCount;
  const trackedCount = rows.filter((r) => r.tracked && r.status === 'active').length;
  const categoryCount = new Set(rows.filter((r) => r.status === 'active').map((r) => r.categoryId)).size;
  const noPrice = rows.filter((r) => r.status === 'active' && r.fromPrice === null).length;

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
          <StackCell primary={r.name} secondary={r.sku} />
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: 'minmax(110px,0.8fr)',
      sortValue: (r) => r.category,
      csv: (r) => r.category,
      cell: (r) => (
        <EntityLink kind="category" id={r.categoryId} muted className="truncate text-ui">
          {r.category}
        </EntityLink>
      ),
    },
    {
      key: 'serves',
      header: 'Sold as',
      width: 'minmax(140px,1.2fr)',
      csv: (r) => r.serves.join('; '),
      cell: (r) => (
        <span className="truncate text-body-sm text-ink-muted" title={r.serves.join(', ')}>
          {r.serves.join(', ') || 'Not sold yet'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'From',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.fromPrice,
      csv: (r) => (r.fromPrice === null ? '' : formatDecimal(r.fromPrice)),
      cell: (r) => (r.fromPrice === null ? <NumCell tone="muted">No price</NumCell> : <Money value={r.fromPrice} currency={false} size="num-md" decimals="whole" />),
    },
    {
      key: 'onHand',
      header: 'On hand',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.onHand,
      csv: (r) => r.onHand ?? '',
      cell: (r) => (r.onHand === null ? <NumCell tone="muted">Not kept</NumCell> : <NumCell tone={r.onHand <= r.effectiveThreshold ? 'low' : 'default'}>{r.onHand}</NumCell>),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      width: 'minmax(130px,1fr)',
      sortValue: (r) => r.supplier,
      csv: (r) => r.supplier ?? '',
      cell: (r) =>
        r.supplier ? (
          <EntityLink kind="supplier" id={r.defaultSupplierId} muted className="truncate text-ui">
            {r.supplier}
          </EntityLink>
        ) : (
          <span className="text-ui text-ink-subtle">None set</span>
        ),
    },
    { key: 'status', header: 'State', width: '112px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status === 'active' ? 'active' : 'retired'} label={r.status === 'active' ? 'On sale' : 'Archived'} /> },
  ];

  const target = dialog.target;

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Products" icon={IconBottle} value={<CountUp value={rows.length} />} detail={archivedCount > 0 ? `${archivedCount} archived` : 'None archived'} />
        <Metric label="On sale" icon={IconCheck} tone="poured" value={<CountUp value={activeCount} delayMs={60} />} detail={noPrice > 0 ? `${noPrice} without a price` : 'Every one priced'} />
        <Metric label="Stock kept" icon={IconBuildingWarehouse} href="/console/inventory/stock" value={<CountUp value={trackedCount} delayMs={120} />} detail="Counted, and warned about when low" />
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
        defaultView="grid"
        leading={
          canEdit ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={() => dialog.open('edit', null)}>
              Add a product
            </Button>
          ) : null
        }
        rowActions={
          canEdit
            ? (r) => [
                { key: 'edit', label: 'Edit details', icon: IconPencil, onSelect: () => dialog.open('edit', r) },
                r.status === 'active'
                  ? { key: 'archive', label: 'Take off sale', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', r) }
                  : { key: 'restore', label: 'Put back on sale', icon: IconArrowBackUp, onSelect: () => dialog.open('status', r) },
              ]
            : undefined
        }
        search={{ placeholder: 'Name, brand or SKU', test: (r, q) => r.name.toLowerCase().includes(q) || (r.brand ?? '').toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'category', label: 'Category', options: categories, test: (r, v) => r.categoryId === v },
          { kind: 'toggle', key: 'archived', label: 'Archived', test: (r) => r.status === 'archived' },
          { kind: 'toggle', key: 'no-price', label: 'No price', test: (r) => r.fromPrice === null },
        ]}
        exportName="products"
        empty={{ title: 'No products yet', body: 'Add the first product, and it goes on sale at the next sync.' }}
        emptyFiltered={{ title: 'No products match', body: 'Clear the category, the toggles or the search to see every product.' }}
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full">
            <CardMedia
              src={assetUrl(r.imageKey, 640, 320)}
              title={r.name}
              subtitle={`${r.category}, ${r.sku}`}
              href={`/console/catalogue/products/${r.id}`}
              meta={r.status === 'archived' ? <StatusChip status="retired" label="Archived" /> : r.onHand !== null && r.onHand <= r.effectiveThreshold ? <StatusChip status="low" label="Low" /> : null}
            />
            <CardStats columns={3}>
              <Stat label="From">{r.fromPrice === null ? 'No price' : <Money value={r.fromPrice} currency={false} size="num-md" decimals="whole" />}</Stat>
              <Stat label="On hand" tone={r.onHand !== null && r.onHand <= r.effectiveThreshold ? 'low' : undefined}>
                {r.onHand === null ? 'Not kept' : `${r.onHand} ${r.unit}`}
              </Stat>
              <Stat label="Sold as">{r.serves.length || 'None'}</Stat>
            </CardStats>
            <CardFooter>
              <span className="min-w-0 truncate text-body-sm text-ink-muted">{r.supplier ?? 'No supplier set'}</span>
              <span className="truncate text-body-sm text-ink-subtle">{r.serves.slice(0, 2).join(', ')}</span>
            </CardFooter>
          </Card>
        )}
      />

      <ProductDialog open={dialog.is('edit')} onClose={dialog.close} target={target} categories={categories} suppliers={suppliers} />
      <ReasonDialog
        open={dialog.is('status') && Boolean(target)}
        onClose={dialog.close}
        title={target?.status === 'active' ? `Take ${target?.name} off sale?` : `Put ${target?.name} back on sale?`}
        description={target?.status === 'active' ? 'The floor stops offering it at the next sync. Its sales stay in every report.' : 'The floor offers it again at the next sync.'}
        confirmLabel={target?.status === 'active' ? 'Take off sale' : 'Put back on sale'}
        destructive={target?.status === 'active'}
        quickReasons={target?.status === 'active' ? ['No longer stocked', 'Replaced by a new line', 'Seasonal, back later'] : ['Back in stock', 'Added by mistake before']}
        run={(reason) => setProductStatus({ id: target!.id, status: target!.status === 'active' ? 'archived' : 'active', reason })}
      />
    </div>
  );
}
