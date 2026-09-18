'use client';

import { formatQty } from '@bliss/shared/format';
import { formatDecimal } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBan, IconHistory, IconLock, IconLockOpen, IconShoppingCart } from '@tabler/icons-react';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { useRouter } from 'next/navigation';
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
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          {r.imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 32px catalogue thumbnail from the asset store
            <img src={`https://images.unsplash.com/photo-${r.imageKey}?auto=format&fit=crop&w=64&h=64&q=60`} alt="" className="size-[32px] shrink-0 rounded-sm object-cover" loading="lazy" />
          ) : (
            <span className="size-[32px] shrink-0" />
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

  return (
    <>
      <DataTable
        leading={<UrlSelect param="location" label="Location" options={locations} allLabel="All locations" />}
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
    </>
  );
}
