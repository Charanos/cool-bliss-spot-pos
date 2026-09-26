'use client';

import { formatQty } from '@bliss/shared/format';
import { formatDecimal, sum } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAlertTriangle, IconBan, IconHistory, IconLock, IconLockOpen, IconScale, IconShoppingCart } from '@tabler/icons-react';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HoldDialog, ReleaseHoldDialog, WriteOffDialog } from '../../_components/dialogs';
import { ProductThumb } from '../../_components/product-thumb';
import { UrlSelect } from '../../_components/url-select';
import type { StockRow } from './page';

function stateChip(row: StockRow) {
  if (row.reason === 'hold') return <StatusChip status="on_hold" />;
  if (row.state === 'finished') return <StatusChip status="finished" />;
  if (row.state === 'last_few') return <StatusChip status="last_few" />;
  if (row.state === 'low') return <StatusChip status="low" />;
  return <span className="sr-only">Available</span>;
}

/** Stock on hand with the actions a manager takes on it: hold, write off, reorder, trace. */
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
      width: 'minmax(220px,2fr)',
      fixed: true,
      sortValue: (r) => r.variant,
      csv: (r) => r.variant,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <ProductThumb name={r.variant} imageKey={r.imageKey} colour={r.colour} />
          <StackCell primary={r.variant} secondary={r.location === 'All locations' ? r.categoryName : `${r.categoryName}, ${r.location}`} />
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
          {r.unit === 'bottles' ? <span className="text-body-sm text-ink-subtle">btl</span> : null}
        </span>
      ),
    },
    { key: 'unitCost', header: 'Unit cost', width: '96px', align: 'right', sortValue: (r) => r.unitCost, csv: (r) => formatDecimal(r.unitCost), cell: (r) => <Money value={r.unitCost} currency={false} size="num-md" tone="muted" /> },
    { key: 'value', header: 'Value', width: '110px', align: 'right', sortValue: (r) => r.value, csv: (r) => formatDecimal(r.value), cell: (r) => <Money value={r.value} currency={false} size="num-md" decimals="whole" /> },
    { key: 'velocity', header: 'Sells a day', width: '100px', align: 'right', sortValue: (r) => r.velocity, csv: (r) => r.velocity.toFixed(2), cell: (r) => <NumCell tone="muted">{r.velocity.toFixed(r.velocity < 10 ? 1 : 0)}</NumCell> },
    {
      key: 'cover',
      header: 'Lasts, days',
      width: '92px',
      align: 'right',
      sortValue: (r) => r.daysCover,
      csv: (r) => (r.daysCover === null ? '' : r.daysCover.toFixed(1)),
      cell: (r) => (r.daysCover === null ? <NumCell tone="muted">No sales</NumCell> : <NumCell tone={r.daysCover < 2 ? 'low' : 'default'}>{r.daysCover.toFixed(1)}</NumCell>),
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
          <NumCell tone="muted">Not counted</NumCell>
        ) : (
          <NumCell tone={Math.abs(r.variancePct) > 2 ? (r.variancePct < 0 ? 'stop' : 'low') : 'muted'}>
            {Math.abs(r.variancePct) < 0.05 ? '0.0%' : `${r.variancePct > 0 ? '+' : ''}${r.variancePct.toFixed(1)}%`}
          </NumCell>
        ),
    },
  ];

  const totalValuation = sum(rows.map((r) => r.value));
  const activeHoldsCount = rows.filter((r) => r.reason === 'hold').length;
  const lowStockCount = rows.filter((r) => r.state === 'low' || r.state === 'last_few' || r.state === 'finished').length;
  const varianceCount = rows.filter((r) => r.variancePct !== null && Math.abs(r.variancePct) > 2).length;

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Stock at cost" icon={IconScale} value={<AnimatedMoney value={totalValuation} animation="metric.count" size="num-kpi" fromZeroOnMount decimals="whole" />} detail={`${rows.length} tracked items`} />
        <Metric
          label="On hold"
          icon={IconLock}
          href="/console/inventory/holds"
          tone={activeHoldsCount > 0 ? 'attention' : 'default'}
          value={<CountUp value={activeHoldsCount} delayMs={60} />}
          detail={activeHoldsCount > 0 ? 'The floor cannot sell these' : 'Nothing is on hold'}
        />
        <Metric
          label="Low or finished"
          icon={IconAlertTriangle}
          href="/console/purchasing/reorder"
          tone={lowStockCount > 0 ? 'attention' : 'default'}
          value={<CountUp value={lowStockCount} delayMs={120} />}
          detail={lowStockCount > 0 ? 'At or below the low-stock line' : 'Everything is above its low-stock line'}
        />
        <Metric
          label="Counted out of line"
          icon={IconHistory}
          href="/console/inventory/counts"
          tone={varianceCount > 0 ? 'stop' : 'default'}
          value={<CountUp value={varianceCount} delayMs={180} />}
          detail={varianceCount > 0 ? 'More than 2% off at the last count' : 'Every count within 2%'}
        />
      </MetricGrid>

      <DataTable
        leading={<UrlSelect param="location" label="Location" options={locations} allLabel="All locations" />}
        id="inventory-stock"
        caption="Stock on hand"
        noun={['item', 'items']}
        rows={rows}
        rowTone={(r) => (r.reason === 'hold' || r.state === 'finished' ? 'attention' : 'default')}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'state', dir: 'asc' }}
        search={{ placeholder: 'Search products', test: (r, q) => r.product.toLowerCase().includes(q) || r.variant.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'category', label: 'Category', options: categories, test: (r, v) => r.categoryId === v },
          { kind: 'toggle', key: 'attention', label: 'Needs attention', test: (r) => r.attention },
        ]}
        exportName="stock"
        emptyFiltered={{ title: 'No items match', body: 'Clear the category, the toggle or the search to see all stock.' }}
        exportDate={exportDate}
        empty={{
          title: 'Nothing is tracked yet',
          body: 'Stock is tracked for products in categories that count stock. Add products to the catalogue first.',
          action: <ButtonLink href="/console/catalogue/products">Open the catalogue</ButtonLink>,
        }}
        rowActions={(r) => [
          { key: 'movements', label: 'View movements', icon: IconHistory, onSelect: () => router.push(`/console/inventory/movements?variant=${r.variantId}`) },
          { key: 'order', label: 'See reorder suggestions', icon: IconShoppingCart, onSelect: () => router.push('/console/purchasing/reorder') },
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
