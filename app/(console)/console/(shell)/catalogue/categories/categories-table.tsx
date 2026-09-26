'use client';

import type { Cents } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Card, CardBand, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';
import { IconArchive, IconArrowBackUp, IconArrowDown, IconArrowUp, IconBuildingWarehouse, IconCategory, IconChefHat, IconPencil, IconPlus, IconReceipt } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { moveCategory, setCategoryStatus } from '../../_actions/menu';
import { ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';
import { CategoryDialog, type CategoryDraft } from '../_parts/category-dialog';

export interface CategoryRow extends CategoryDraft {
  position: number;
  routing: string;
  products: number;
  archivedProducts: number;
  takings: Cents;
  share: number;
  active: boolean;
}

/** Categories in the order the floor shows its tabs: their colour, where their lines print, what they sell. */
export function CategoriesTable({ rows, canEdit, days }: { rows: CategoryRow[]; canEdit: boolean; days: number }) {
  const router = useRouter();
  const [moving, start] = useTransition();
  const dialog = useDialog<'edit' | 'status', CategoryRow | null>();
  useCreateParam(() => dialog.open('edit', null), canEdit);
  const active = rows.filter((r) => r.active);
  const move = (r: CategoryRow, direction: 'up' | 'down') =>
    start(async () => {
      await moveCategory({ id: r.id, direction });
      router.refresh();
    });

  const columns: Column<CategoryRow>[] = [
    { key: 'order', header: 'Tab', width: '64px', align: 'right', sortValue: (r) => r.position, csv: (r) => r.position, cell: (r) => <NumCell tone="muted">{r.active ? r.position : 'None'}</NumCell> },
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
    { key: 'routing', header: 'Prints at', width: '128px', sortValue: (r) => r.routing, csv: (r) => r.routing, cell: (r) => <span className="text-ui text-ink-muted">{r.routing}</span> },
    { key: 'stock', header: 'Stock', width: '120px', sortValue: (r) => Number(r.trackStock), csv: (r) => (r.trackStock ? 'Counted' : 'Not counted'), cell: (r) => <span className="text-ui text-ink-muted">{r.trackStock ? 'Counted' : 'Not counted'}</span> },
    { key: 'products', header: 'On sale', width: '96px', align: 'right', sortValue: (r) => r.products, csv: (r) => r.products, cell: (r) => <NumCell>{r.products}</NumCell> },
    {
      key: 'takings',
      header: `Takings, ${days} days`,
      width: 'minmax(180px,1fr)',
      align: 'right',
      sortValue: (r) => r.takings,
      csv: (r) => r.takings.toString(),
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-12">
          <InlineBar value={r.share} />
          <Money value={r.takings} currency={false} size="num-md" decimals="whole" />
        </span>
      ),
    },
    { key: 'state', header: 'State', width: '112px', sortValue: (r) => Number(r.active), csv: (r) => (r.active ? 'On the floor' : 'Archived'), cell: (r) => <StatusChip status={r.active ? 'active' : 'retired'} label={r.active ? 'On the floor' : 'Archived'} /> },
  ];

  const target = dialog.target;

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Tabs on the floor" icon={IconCategory} value={<CountUp value={active.length} />} detail={rows.length > active.length ? `${rows.length - active.length} archived` : 'None archived'} />
        <Metric label="Products on sale" icon={IconReceipt} href="/console/catalogue/products" value={<CountUp value={active.reduce((n, r) => n + r.products, 0)} delayMs={60} />} detail="Across every tab" />
        <Metric label="Stock counted" icon={IconBuildingWarehouse} value={<CountUp value={active.filter((r) => r.trackStock).length} delayMs={120} />} detail="Categories whose stock is kept" />
        <Metric label="To the kitchen" icon={IconChefHat} value={<CountUp value={active.filter((r) => r.routingTarget === 'kitchen').length} delayMs={180} />} detail="Their lines print in the kitchen" />
      </MetricGrid>

      <DataTable
        id="catalogue-categories"
        caption="Categories"
        noun={['category', 'categories']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/catalogue/categories/${r.id}`}
        defaultSort={{ key: 'order', dir: 'asc' }}
        defaultView="grid"
        rowTone={(r) => (r.active ? 'default' : 'muted')}
        leading={
          canEdit ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={() => dialog.open('edit', null)}>
              Add a category
            </Button>
          ) : null
        }
        rowActions={
          canEdit
            ? (r) => [
                { key: 'edit', label: 'Edit', icon: IconPencil, onSelect: () => dialog.open('edit', r) },
                ...(r.active
                  ? [
                      { key: 'up', label: 'Move earlier', icon: IconArrowUp, disabled: r.position === 1 || moving, onSelect: () => move(r, 'up') },
                      { key: 'down', label: 'Move later', icon: IconArrowDown, disabled: r.position === active.length || moving, onSelect: () => move(r, 'down') },
                      { key: 'archive', label: 'Archive', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', r) },
                    ]
                  : [{ key: 'restore', label: 'Put back on the floor', icon: IconArrowBackUp, onSelect: () => dialog.open('status', r) }]),
              ]
            : undefined
        }
        exportName="categories"
        empty={{ title: 'No categories yet', body: 'A category becomes a tab on the floor. Add the first one.' }}
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full">
            <CardBand
              eyebrow={r.active ? `Tab ${r.position}` : 'Archived'}
              status={r.active ? null : <StatusChip status="retired" label="Archived" />}
              leading={<span aria-hidden="true" className={cx('size-control-sm shrink-0 rounded-md', categoryEdgeClass(r.colour))} />}
              title={r.name}
              subtitle={`Prints at ${r.routing.toLowerCase()}`}
              href={`/console/catalogue/categories/${r.id}`}
            />
            <KeyRows>
              <KeyRow label="On sale">{r.products}</KeyRow>
              <KeyRow label="Stock">{r.trackStock ? 'Counted' : 'Not counted'}</KeyRow>
              <KeyRow label="Share of takings">
                <span className="inline-flex items-center gap-8">
                  <InlineBar value={r.share} />
                  {Math.round(r.share * 100)}%
                </span>
              </KeyRow>
              <KeyRow label="Takings">
                <Money value={r.takings} currency={false} size="num-md" decimals="whole" />
              </KeyRow>
            </KeyRows>
          </Card>
        )}
      />

      <CategoryDialog open={dialog.is('edit')} onClose={dialog.close} target={target} />
      <ReasonDialog
        open={dialog.is('status') && Boolean(target)}
        onClose={dialog.close}
        title={target?.active ? `Archive ${target?.name}?` : `Put ${target?.name} back on the floor?`}
        description={target?.active ? 'Its tab leaves the floor at the next sync. It must have no products on sale.' : 'Its tab comes back at the next sync.'}
        confirmLabel={target?.active ? 'Archive' : 'Put back'}
        destructive={target?.active}
        quickReasons={target?.active ? ['Merged into another tab', 'No longer served'] : ['Serving it again']}
        run={(reason) => setCategoryStatus({ id: target!.id, status: target!.active ? 'archived' : 'active', reason })}
      />
    </div>
  );
}
