'use client';

import { formatQty } from '@bliss/shared/format';
import { formatDecimal, sum } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAlertTriangle, IconBan, IconHistory, IconLock, IconLockOpen, IconScale, IconShoppingCart, IconPlus } from '@tabler/icons-react';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { cx } from '@bliss/ui/lib/cx';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { HoldDialog, ReleaseHoldDialog, WriteOffDialog } from '../../_components/dialogs';
import { UrlSelect } from '../../_components/url-select';
import type { StockRow } from './page';

function stateChip(row: StockRow) {
  if (row.reason === 'hold') return <StatusChip status="on_hold" />;
  if (row.state === 'finished') return <StatusChip status="finished" />;
  if (row.state === 'last_few') return <StatusChip status="last_few" />;
  if (row.state === 'low') return <StatusChip status="low" />;
  return <span className="sr-only">Available</span>;
}

export function StockTable({
  rows,
  locations,
  categories,
  exportDate,
}: {
  rows: StockRow[];
  locations: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  exportDate: string;
}) {
  const router = useRouter();
  const [hold, setHold] = useState<{ variantId: string; name: string } | null>(null);
  const [release, setRelease] = useState<{ holdId: string; name: string } | null>(null);
  const [writeOff, setWriteOff] = useState<StockRow | null>(null);

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      width: 'minmax(240px,2fr)',
      fixed: true,
      sortValue: (r) => r.variant,
      csv: (r) => r.variant,
      cell: (r, ctx) => (
        <span className="flex min-w-0 items-center gap-12 group/item cursor-pointer">
          {r.imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 32px catalogue thumbnail from the asset store
            <img 
              src={`https://images.unsplash.com/photo-${r.imageKey}?auto=format&fit=crop&w=128&h=128&q=70`} 
              alt="" 
              className={cx(
                "shrink-0 rounded-[10px] object-cover shadow-sm transition-transform duration-300 group-hover/item:scale-105 group-hover/item:shadow-lg",
                ctx?.grid ? "size-[80px]" : "size-[40px]"
              )} 
              loading="lazy" 
            />
          ) : (
            <span 
              className={cx(
                "shrink-0 rounded-[8px] bg-control/20 ring-1 ring-inset ring-hairline/30 flex items-center justify-center transition-colors duration-200 group-hover/item:bg-control/40",
                ctx?.grid ? "size-[64px]" : "size-[36px]"
              )}
            >
               <span className={cx("font-medium text-ink-subtle/40", ctx?.grid ? "text-title" : "text-micro")}>{r.variant.slice(0, 1).toUpperCase()}</span>
            </span>
          )}
          <StackCell primary={r.variant} secondary={r.categoryName} />
        </span>
      ),
    },
    { key: 'category', header: 'Category', width: '0px', exportOnly: true, csv: (r) => r.categoryName, cell: () => null },
    {
      key: 'onHand',
      header: 'On hand',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.onHand,
      csv: (r) => formatQty(r.onHand, 2),
      cell: (r) => (
        <span className="inline-flex items-baseline gap-4">
          <NumCell tone={r.onHand <= 0 ? 'stop' : 'default'}>{formatQty(r.onHand, r.unit === 'bottles' ? 2 : 0)}</NumCell>
          <span className="text-body-sm text-ink-subtle">{r.unit === 'bottles' ? 'btl' : ''}</span>
        </span>
      ),
    },
    { key: 'unitCost', header: 'Unit cost', width: '96px', align: 'right', sortValue: (r) => r.unitCost, csv: (r) => formatDecimal(r.unitCost), cell: (r) => <Money value={r.unitCost} currency={false} tone="muted" /> },
    { key: 'value', header: 'Value', width: '110px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} decimals="whole" /> },
    { key: 'velocity', header: '28d velocity', width: '100px', align: 'right', sortValue: (r) => r.velocity, csv: (r) => r.velocity.toFixed(2), cell: (r) => <NumCell tone="muted">{r.velocity.toFixed(r.velocity < 10 ? 1 : 0)}/day</NumCell> },
    {
      key: 'cover',
      header: 'Days cover',
      width: '92px',
      align: 'right',
      sortValue: (r) => r.daysCover,
      csv: (r) => (r.daysCover === null ? '' : r.daysCover.toFixed(1)),
      cell: (r) => (r.daysCover === null ? <NumCell tone="muted">··</NumCell> : <NumCell tone={r.daysCover < 2 ? 'low' : 'default'}>{r.daysCover.toFixed(1)}</NumCell>),
    },
    {
      key: 'state',
      header: 'State',
      width: '104px',
      sortValue: (r) => (r.reason === 'hold' ? 0 : r.state === 'finished' ? 1 : r.state === 'last_few' ? 2 : r.state === 'low' ? 3 : 4),
      csv: (r) => (r.reason === 'hold' ? 'On hold' : r.state),
      cell: (r) => <span title={r.holdReason ?? undefined}>{stateChip(r)}</span>,
    },
    {
      key: 'variance',
      header: 'Variance',
      width: '84px',
      align: 'right',
      sortValue: (r) => r.variancePct,
      csv: (r) => (r.variancePct === null ? '' : r.variancePct.toFixed(1)),
      cell: (r) =>
        r.variancePct === null ? (
          <NumCell tone="muted">··</NumCell>
        ) : (
          <NumCell tone={Math.abs(r.variancePct) > 2 ? (r.variancePct < 0 ? 'stop' : 'low') : 'muted'}>
            {r.variancePct > 0 ? '+' : ''}
            {r.variancePct.toFixed(1)}%
          </NumCell>
        ),
    },
  ];

  const totalValuation = sum(rows.map((r) => r.value));
  const activeHoldsCount = rows.filter((r) => r.reason === 'hold').length;
  const lowStockCount = rows.filter((r) => r.state === 'low' || r.state === 'last_few' || r.state === 'finished').length;
  const varianceCount = rows.filter((r) => r.variancePct !== null && Math.abs(r.variancePct) > 2).length;

  return (
    <div className="flex flex-col gap-20">
      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
        <Metric
          label="Stock valuation"
          icon={IconScale}
          tone="default"
          value={<AnimatedMoney value={totalValuation} animation="metric.count" size="title-lg" fromZeroOnMount decimals="whole" />}
          detail={`${rows.length} tracked items at cost`}
        />
        <Metric
          label="Active holds"
          icon={IconLock}
          tone={activeHoldsCount > 0 ? 'attention' : 'poured'}
          value={<CountUp value={activeHoldsCount} delayMs={60} />}
          detail={activeHoldsCount > 0 ? 'Quarantined from the floor' : 'No active stock holds'}
        />
        <Metric
          label="Low or depleted"
          icon={IconAlertTriangle}
          tone={lowStockCount > 0 ? 'attention' : 'poured'}
          value={<CountUp value={lowStockCount} delayMs={120} />}
          detail={lowStockCount > 0 ? 'Lines at or below threshold' : 'All lines above reorder point'}
        />
        <Metric
          label="Audit variance"
          icon={IconHistory}
          tone={varianceCount > 0 ? 'stop' : 'default'}
          value={<CountUp value={varianceCount} delayMs={180} />}
          detail={varianceCount > 0 ? 'Lines outside 2% tolerance' : 'Within count tolerance'}
        />
      </div>

      {/* Elegant visual separator */}
      <div className="h-[1px] mt-8 w-full mt-32 bg-gradient-to-r from-transparent via-hairline/60 to-transparent opacity-80" aria-hidden="true" />

      <DataTable
        leading={
          <div className="flex items-center gap-12">
            <UrlSelect param="location" label="Location" options={locations} allLabel="All locations" />
            <Link
              href="/console/inventory/counts"
              className="group relative inline-flex h-[32px] items-center gap-6 rounded-full bg-accent text-accent-ink px-16 text-[13px] font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_1px_3px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_3px_6px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] active:scale-[0.98] active:translate-y-0"
            >
              <IconPlus size={14} stroke={2.5} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
              <span>Stock count</span>
            </Link>
          </div>
        }
        id="inventory-stock"
        caption="Stock on hand"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'state', dir: 'asc' }}
        search={{ placeholder: 'Search products', test: (r, q) => r.product.toLowerCase().includes(q) || r.variant.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'category', label: 'Category', options: categories, test: (r, v) => r.categoryId === v },
          { kind: 'toggle', key: 'attention', label: 'Needs attention', test: (r) => r.attention },
        ]}
        exportName="stock"
        exportDate={exportDate}
        empty={{
          title: 'Your catalogue is empty',
          body: 'Import a CSV, or add your first product by hand.',
          action: <ButtonLink href="/console/catalogue/products">Import catalogue</ButtonLink>,
        }}
        renderGridCard={(r) => (
          <div className="text-left w-full h-[380px] bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col group relative overflow-hidden focus-visible:outline-none">
            {/* Header Image */}
            <div className="relative h-[170px] w-full shrink-0 overflow-hidden bg-control-hover">
              {r.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://images.unsplash.com/photo-${r.imageKey}?auto=format&fit=crop&w=400&h=400&q=80`} alt="" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-[64px] font-mono text-ink-disabled/20">
                  {r.variant.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-12 right-12">
                {stateChip(r)}
              </div>
              <div className="absolute bottom-16 left-20 right-20 flex flex-col">
                <span className="text-title font-medium text-[#fff] drop-shadow-md truncate">{r.variant}</span>
                <span className="text-body-sm text-[#fff]/80 drop-shadow-md truncate">{r.categoryName}</span>
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-col flex-1 p-20 text-body-sm bg-page w-full">
              <div className="flex flex-col mt-auto">
                <div className="flex justify-between items-center pb-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">On hand</span>
                  <span className="font-medium text-ink tabular flex gap-4">
                    <span className={r.onHand <= 0 ? 'text-stop' : ''}>{formatQty(r.onHand, r.unit === 'bottles' ? 2 : 0)}</span>
                    <span className="text-ink-subtle">{r.unit === 'bottles' ? 'btl' : ''}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Unit cost</span>
                  <Money value={r.unitCost} currency={false} tone="muted" />
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Total Value</span>
                  <Money value={r.value} currency={false} decimals="whole" />
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">28d Velocity</span>
                  <span className="font-mono text-ink-muted">{r.velocity.toFixed(r.velocity < 10 ? 1 : 0)}/day</span>
                </div>
                <div className="flex justify-between items-center pt-8">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Days Cover</span>
                  <span className="font-mono tabular">
                    <span className={r.daysCover !== null && r.daysCover < 3 ? 'text-stop' : 'text-ink'}>
                      {r.daysCover === null ? '··' : Math.round(r.daysCover)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            
            {/* Overlay Actions on Hover */}
            <div className="absolute top-12 left-12 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-6 z-10">
               <button onClick={(e) => { e.preventDefault(); setHold({ variantId: r.variantId, name: r.variant }); }} className="p-8 rounded-full bg-page/90 text-ink-subtle hover:text-ink backdrop-blur-md shadow-sm transition-colors border border-hairline/40" title="Hold stock">
                 <IconLock size={16} stroke={1.5} />
               </button>
               <button onClick={(e) => { e.preventDefault(); setWriteOff(r); }} className="p-8 rounded-full bg-page/90 text-ink-subtle hover:text-stop backdrop-blur-md shadow-sm transition-colors border border-hairline/40" title="Write off">
                 <IconBan size={16} stroke={1.5} />
               </button>
            </div>
          </div>
        )}
        rowActions={(r) => [
          { key: 'movements', label: 'View movements', icon: IconHistory, onSelect: () => router.push(`/console/inventory/movements?variant=${r.variantId}`) },
          { key: 'order', label: 'Add to order', icon: IconShoppingCart, onSelect: () => router.push('/console/purchasing/reorder') },
          r.holdId
            ? { key: 'release', label: 'Take off hold', icon: IconLockOpen, onSelect: () => setRelease({ holdId: r.holdId!, name: r.variant }) }
            : { key: 'hold', label: 'Put on hold', icon: IconLock, onSelect: () => setHold({ variantId: r.variantId, name: r.variant }) },
          { key: 'writeoff', label: 'Write off with a reason', icon: IconBan, destructive: true, onSelect: () => setWriteOff(r) },
        ]}
      />
      <HoldDialog target={hold} onClose={() => setHold(null)} />
      <ReleaseHoldDialog target={release} onClose={() => setRelease(null)} />
      <WriteOffDialog
        target={writeOff ? { variantId: writeOff.variantId, name: writeOff.variant, unitCost: writeOff.unitCost, locationId: writeOff.locationId, unit: writeOff.unit } : null}
        locations={locations}
        onClose={() => setWriteOff(null)}
      />
    </div>
  );
}
