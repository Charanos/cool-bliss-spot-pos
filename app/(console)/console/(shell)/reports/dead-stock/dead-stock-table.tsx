'use client';

import { formatDate, formatQty } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { IconBottle, IconCalendarOff, IconCoins, IconHistory, IconHourglass } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { UrlSelect } from '../../_components/url-select';

interface DeadRow {
  variantId: string;
  name: string;
  category: string;
  lastSaleAt: number | null;
  onHand: number;
  value: Cents;
  idleDays: number | null;
  productId: string | null;
}

/** Stock with no sale in the window, largest value first: money sitting on a shelf. */
export function DeadStockTable({
  rows,
  days,
  total,
  canSeeCost,
  timezone,
  windows,
}: {
  rows: DeadRow[];
  days: number;
  total: Cents;
  canSeeCost: boolean;
  timezone: string;
  windows: { value: string; label: string }[];
}) {
  const router = useRouter();
  const columns: Column<DeadRow>[] = [
    { key: 'name', header: 'Item', width: 'minmax(200px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={r.name} secondary={r.category} /> },
    { key: 'onHand', header: 'On hand', width: '100px', align: 'right', sortValue: (r) => r.onHand, csv: (r) => r.onHand, cell: (r) => <NumCell>{formatQty(r.onHand, 2)}</NumCell> },
    {
      key: 'last',
      header: 'Last sold',
      width: '150px',
      align: 'right',
      sortValue: (r) => r.lastSaleAt,
      csv: (r) => (r.lastSaleAt ? new Date(r.lastSaleAt).toISOString() : 'never'),
      cell: (r) =>
        r.lastSaleAt ? (
          <StackCell primary={<span className="font-mono tabular text-num-md">{formatDate(r.lastSaleAt, timezone)}</span>} secondary={`${r.idleDays} days ago`} />
        ) : (
          <span className="text-body-sm text-ink-subtle">Never, in the record</span>
        ),
    },
    {
      key: 'idle',
      header: 'Standing still',
      width: '140px',
      sortValue: (r) => r.idleDays ?? Number.MAX_SAFE_INTEGER,
      csv: (r) => r.idleDays ?? '',
      // Full at three windows: past that, it has stopped selling.
      cell: (r) => <InlineBar value={r.idleDays === null ? 1 : r.idleDays / (days * 3)} tone={r.idleDays === null || r.idleDays > days * 2 ? 'stop' : 'attention'} className="w-full" />,
    },
    ...(canSeeCost
      ? [
          {
            key: 'value',
            header: 'Tied up at cost',
            width: '130px',
            align: 'right' as const,
            sortValue: (r: DeadRow) => r.value,
            csv: (r: DeadRow) => formatDecimal(r.value),
            cell: (r: DeadRow) => <Money value={r.value} currency={false} size="num-md" decimals="whole" />,
          },
        ]
      : []),
  ];

  const never = rows.filter((r) => r.lastSaleAt === null).length;
  const oldest = rows.reduce((m, r) => Math.max(m, r.idleDays ?? 0), 0);
  const units = rows.reduce((n, r) => n + r.onHand, 0);

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Items standing still" icon={IconBottle} tone={rows.length > 0 ? 'attention' : 'poured'} value={<CountUp value={rows.length} />} detail={`No sale in ${days} days`} />
        {canSeeCost ? (
          <Metric
            label="Tied up at cost"
            icon={IconCoins}
            tone={rows.length > 0 ? 'attention' : 'default'}
            value={<Money value={total} size="num-kpi" decimals="whole" />}
            detail={`${formatQty(units, 0)} units on the shelves`}
          />
        ) : (
          <Metric label="Units" icon={IconCoins} value={formatQty(units, 0)} detail="On the shelves" />
        )}
        <Metric label="Never sold" icon={IconCalendarOff} tone={never > 0 ? 'stop' : 'default'} value={<CountUp value={never} delayMs={120} />} detail="Not once, in the record" />
        <Metric label="Longest idle" icon={IconHourglass} value={oldest > 0 ? `${oldest} days` : <span className="font-sans text-title-lg">{never > 0 ? 'Never sold' : 'None'}</span>} detail={oldest > 0 ? 'Since its last sale' : never > 0 ? 'Not one sale to count from' : 'Everything is selling'} />
      </MetricGrid>
      <DataTable
        id="report-dead-stock"
        caption={`Stock with no sale in ${days} days`}
        noun={['item', 'items']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.variantId}
        rowHref={(r) => (r.productId ? `/console/catalogue/products/${r.productId}` : `/console/inventory/stock`)}
        defaultSort={{ key: canSeeCost ? 'value' : 'onHand', dir: 'desc' }}
        leading={<UrlSelect param="days" label="Window" options={windows} allLabel={null} fallback={String(days)} />}
        rowActions={(r) => [{ key: 'movements', label: 'Stock movements', icon: IconHistory, onSelect: () => router.push(`/console/inventory/movements?variant=${r.variantId}&range=28`) }]}
        exportName="dead-stock"
        footer={
          rows.length > 0 && canSeeCost ? (
            <div className="flex items-baseline justify-between gap-16">
              <span className="text-body-sm text-ink-muted">Tied up in items that have not sold in {days} days</span>
              <Money value={total} size="num-lg" decimals="whole" />
            </div>
          ) : undefined
        }
        empty={{
          title: `Everything has sold in the last ${days} days`,
          body: 'Nothing on the shelves is standing still.',
          action: (
            <ButtonLink href="/console/inventory/stock" variant="secondary">
              See all stock
            </ButtonLink>
          ),
        }}
      />
    </div>
  );
}
