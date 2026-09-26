'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Metric } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { IconBottle, IconBuildingWarehouse, IconCategory, IconCheck, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

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
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const archivedCount = rows.filter((r) => r.status === 'archived').length;
  const trackedCount = rows.filter((r) => r.tracked).length;
  const categoryCount = new Set(rows.map((r) => r.categoryId)).size;
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
    <div className="flex flex-col gap-24">
      {/* Executive Catalogue Metrics */}
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        <Metric
          label="Catalogued Products"
          value={rows.length}
          detail={`${activeCount} on sale · ${archivedCount} archived`}
          icon={IconBottle}
          tone="default"
        />
        <Metric
          label="Active on Sale"
          value={activeCount}
          detail="Enabled across POS fleet"
          icon={IconCheck}
          tone="poured"
        />
        <Metric
          label="Stock Tracked"
          value={trackedCount}
          detail="Automatic inventory deduct"
          icon={IconBuildingWarehouse}
          tone="default"
        />
        <Metric
          label="Active Categories"
          value={categoryCount}
          detail="Assigned drink families"
          icon={IconCategory}
          tone="default"
        />
      </div>

      <DataTable
        id="catalogue-products"
        caption="Products"
        rows={rows}
        columns={columns}
        leading={
          <Link
            href="/console/catalogue/products/new"
            className="group relative inline-flex h-[32px] items-center gap-6 rounded-full bg-accent text-accent-ink px-16 text-[13px] font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_1px_3px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_3px_6px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] active:scale-[0.98] active:translate-y-0"
          >
            <IconPlus size={14} stroke={2.5} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
            <span>Add product</span>
          </Link>
        }
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
        renderGridCard={(r) => (
          <Link href={`/console/catalogue/products/${r.id}`} className="text-left w-full h-[380px] bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {/* Full Bleed Image Header */}
            <div className={`relative h-[170px] w-full shrink-0 overflow-hidden ${categoryEdgeClass(r.colour)} bg-opacity-20`}>
              {r.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://images.unsplash.com/photo-${r.imageKey}?auto=format&fit=crop&w=400&h=400&q=80`} alt="" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-[64px] font-mono text-ink-disabled/20">
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-16 left-20 right-20 flex flex-col">
                <span className="text-title font-medium text-[#fff] drop-shadow-md truncate">{r.name}</span>
                <span className="text-body-sm text-[#fff]/80 drop-shadow-md truncate">{r.category} · {r.sku}</span>
              </div>
            </div>

            {/* Tight Details Area */}
            <div className="flex flex-col flex-1 p-20 text-body-sm bg-page w-full">
              <div className="flex flex-col mt-auto">
                <div className="flex justify-between items-center pb-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Sold as</span>
                  <span className="text-ink font-medium truncate ml-16" title={r.serves.join(', ')}>{r.serves.join(', ')}</span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Bottle</span>
                  <span className="font-mono text-ink-muted tabular">{r.container ? `${r.container}ml` : '··'}</span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">From Price</span>
                  <span>
                    {r.fromPrice === null ? <span className="font-mono text-ink-muted">··</span> : <Money value={r.fromPrice} currency={false} decimals="whole" />}
                  </span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Low Stock At</span>
                  <span className="font-mono tabular" title={r.thresholdIsDefault ? 'Outlet default' : 'Set for this product'}>
                    <span className={r.thresholdIsDefault ? 'text-ink-muted' : 'text-ink'}>{r.tracked ? r.effectiveThreshold : '··'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center pt-8">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">State</span>
                  <StatusChip status={r.status === 'active' ? 'active' : 'retired'} label={r.status === 'active' ? 'On sale' : 'Archived'} />
                </div>
              </div>
            </div>
          </Link>
        )}
      />
    </div>
  );
}
