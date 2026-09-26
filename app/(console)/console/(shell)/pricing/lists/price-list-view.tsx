'use client';

import { formatBps, formatDateTime, plural } from '@bliss/shared/format';
import { type Cents, cents, formatDecimal, formatFigure, formatKes, isPositive, parseKes, scale, shareBps, subtract } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout } from '@bliss/ui/components/console/section';
import { TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconHistory, IconLock, IconPencil, IconPercentage, IconReceipt, IconTag, IconTagOff } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setPrice } from '../../_actions/catalogue';
import { EntityLink } from '../../_components/entity-link';

export interface PriceRow {
  variantId: string;
  name: string;
  productId: string;
  categoryId: string;
  category: string;
  base: Cents | null;
  price: Cents | null;
  /** Absent for roles without cost.read, and for recipes, whose cost is the sum of their parts. */
  cost: Cents | null;
}

interface Change {
  id: string;
  at: number;
  by: string;
  reason: string | null;
  before: string | null;
  after: string | null;
  variant: string | null;
}

/** Margin on the price net of VAT, from integer cents and basis points. */
function marginOf(price: Cents, cost: Cents, taxRateBps: number): number {
  const exVat = scale(price, 10_000n, BigInt(10_000 + taxRateBps));
  return isPositive(exVat) ? shareBps(subtract(exVat, cost), exVat) : 0;
}

/** One price list at a time: every item against the base price, with its margin for roles that see cost. */
export function PriceListView({
  list,
  baseName,
  rules,
  rows,
  canSeeCost,
  canEdit,
  categories,
  changes,
  timezone,
  taxRateBps,
}: {
  list: { id: string; name: string; kind: 'base' | 'overlay' };
  baseName: string;
  rules: string[];
  rows: PriceRow[];
  canSeeCost: boolean;
  canEdit: boolean;
  categories: { value: string; label: string }[];
  changes: Change[];
  timezone: string;
  taxRateBps: number;
}) {
  const marginBps = (price: Cents, cost: Cents) => marginOf(price, cost, taxRateBps);
  const [editing, setEditing] = useState<{ row: PriceRow; remove: boolean } | null>(null);
  const overlay = list.kind === 'overlay';
  const pricedItems = rows.filter((r) => r.price !== null).length;
  const itemsWithMargin = rows.filter((r): r is PriceRow & { price: Cents; cost: Cents } => r.price !== null && r.cost !== null);
  const avgMarginBps = itemsWithMargin.length > 0 ? Math.round(itemsWithMargin.reduce((acc, r) => acc + marginBps(r.price, r.cost), 0) / itemsWithMargin.length) : null;

  const columns: Column<PriceRow>[] = [
    { key: 'name', header: 'Item', width: 'minmax(220px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={<EntityLink kind="product" id={r.productId}>{r.name}</EntityLink>} secondary={r.category} /> },
    ...(overlay
      ? [
          {
            key: 'base',
            header: baseName,
            width: '110px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => r.base,
            csv: (r: PriceRow) => (r.base === null ? '' : formatDecimal(r.base)),
            cell: (r: PriceRow) => (r.base === null ? <NumCell tone="muted">None</NumCell> : <Money value={r.base} currency={false} size="num-md" tone="muted" />),
          },
        ]
      : []),
    {
      key: 'price',
      header: list.name,
      width: '120px',
      align: 'right',
      sortValue: (r) => r.price,
      csv: (r) => (r.price === null ? '' : formatDecimal(r.price)),
      cell: (r) => (r.price === null ? <span className="text-body-sm text-ink-subtle">{overlay ? 'Not on this list' : 'No price'}</span> : <Money value={r.price} currency={false} size="num-md" tone={overlay ? 'accent' : 'default'} />),
    },
    ...(overlay
      ? [
          {
            key: 'saving',
            header: 'Guest saves',
            width: '100px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => (r.price !== null && r.base !== null ? subtract(r.base, r.price) : null),
            csv: (r: PriceRow) => (r.price !== null && r.base !== null ? formatDecimal(subtract(r.base, r.price)) : ''),
            cell: (r: PriceRow) => (r.price !== null && r.base !== null ? <Money value={subtract(r.base, r.price)} currency={false} size="num-md" tone="muted" /> : <NumCell tone="muted">None</NumCell>),
          },
        ]
      : []),
    ...(canSeeCost
      ? [
          {
            key: 'cost',
            header: 'Cost a serve',
            width: '110px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => r.cost,
            csv: (r: PriceRow) => (r.cost === null ? '' : formatDecimal(r.cost)),
            cell: (r: PriceRow) => (r.cost === null ? <NumCell tone="muted">None</NumCell> : <Money value={r.cost} currency={false} size="num-md" tone="muted" />),
          },
          {
            key: 'margin',
            header: 'Margin',
            width: '90px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => (r.cost !== null && r.price !== null ? marginBps(r.price, r.cost) : null),
            csv: (r: PriceRow) => (r.cost !== null && r.price !== null ? (marginBps(r.price, r.cost) / 100).toFixed(1) : ''),
            cell: (r: PriceRow) => {
              if (r.cost === null || r.price === null) return <NumCell tone="muted">None</NumCell>;
              const bps = marginBps(r.price, r.cost);
              return <NumCell tone={bps < 3000 ? 'low' : 'default'}>{formatBps(bps)}</NumCell>;
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label={`Priced on ${list.name}`} icon={IconTag} value={<CountUp value={pricedItems} />} detail={`Of ${plural(rows.length, 'item')} on sale`} />
        <Metric
          label="How it applies"
          icon={IconReceipt}
          value={<span className="font-sans text-title-section">{list.kind === 'base' ? 'All day' : rules.length > 0 ? 'In its hours' : 'Not scheduled'}</span>}
          detail={list.kind === 'base' ? 'The price when no rule is on' : rules.length > 0 ? plural(rules.length, 'time rule') : 'No time rule switches it on'}
        />
        <Metric
          label="Average margin"
          icon={canSeeCost ? IconPercentage : IconLock}
          tone={canSeeCost && avgMarginBps !== null && avgMarginBps < 3000 ? 'attention' : 'default'}
          value={canSeeCost && avgMarginBps !== null ? formatBps(avgMarginBps) : <span className="font-sans text-title-section text-ink-muted">Hidden</span>}
          detail={canSeeCost ? `After ${(taxRateBps / 100).toFixed(0)}% VAT, at average cost` : 'Your role does not see costs'}
        />
        <Metric label="Recent changes" icon={IconHistory} value={<CountUp value={changes.length} delayMs={120} />} detail={changes.length > 0 ? 'Listed below the prices' : 'No price has changed yet'} />
      </MetricGrid>

      {rules.length > 0 ? (
        <Callout tone="info" title={`${list.name} is on ${rules.join('; ')}`}>
          Outside those hours the floor charges {baseName}. A line keeps the price it was fired at.
        </Callout>
      ) : null}

      <DataTable
        id="pricing-list"
        caption={`Prices on ${list.name}`}
        noun={['item', 'items']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.variantId}
        defaultSort={{ key: 'name', dir: 'asc' }}
        search={{ placeholder: 'Search items', test: (r, q) => r.name.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'category', label: 'Category', options: categories, test: (r, v) => r.categoryId === v },
          ...(overlay ? [{ kind: 'toggle' as const, key: 'listed', label: 'On this list only', test: (r: PriceRow) => r.price !== null }] : []),
        ]}
        rowActions={
          canEdit
            ? (r) => [
                { key: 'edit', label: r.price === null ? `Add to ${list.name}` : 'Change price', icon: IconPencil, onSelect: () => setEditing({ row: r, remove: false }) },
                ...(overlay && r.price !== null ? [{ key: 'remove', label: `Take off ${list.name}`, icon: IconTagOff, destructive: true, onSelect: () => setEditing({ row: r, remove: true }) }] : []),
              ]
            : undefined
        }
        exportName={`prices-${list.name.toLowerCase().replace(/\s+/g, '-')}`}
        empty={{ title: 'Nothing is priced on this list', body: 'Add a price to an item and it appears here.' }}
        emptyFiltered={{ title: 'No items match', body: 'Clear the category, the toggle or the search to see every item.' }}
      />

      {changes.length > 0 ? (
        <Card aria-labelledby="price-changes">
          <CardHeader band level="h2" titleId="price-changes" icon={IconHistory} title="Recent price changes" subtitle="Who changed what, and why" />
          <ul className="flex flex-col">
            {changes.map((c) => (
              <li key={c.id} className="grid grid-cols-[152px_minmax(0,1fr)_auto] items-baseline gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                <span className="font-mono tabular text-num-sm text-ink-subtle">{formatDateTime(c.at, timezone)}</span>
                <span className="min-w-0 text-body-sm text-ink-muted">
                  {c.variant ? <span className="font-medium text-ink">{c.variant}: </span> : null}
                  {c.reason ?? 'No reason recorded'}
                  <span className="text-ink-subtle">, {c.by}</span>
                </span>
                <span className="whitespace-nowrap font-mono tabular text-num-md text-ink">
                  {c.before ? formatFigure(cents(c.before)) : 'None'} <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span> {c.after ? formatFigure(cents(c.after)) : 'removed'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <PriceDialog target={editing} list={list} onClose={() => setEditing(null)} />
    </div>
  );
}

function PriceDialog({ target, list, onClose }: { target: { row: PriceRow; remove: boolean } | null; list: { id: string; name: string }; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const row = target?.row;
  let parsed: Cents | null = null;
  try {
    parsed = value.trim() ? parseKes(value) : null;
  } catch {
    parsed = null;
  }

  const title = !row ? '' : target.remove ? `Take ${row.name} off ${list.name}?` : row.price === null ? `Add ${row.name} to ${list.name}` : `Change the price of ${row.name}`;
  const description = !row
    ? undefined
    : target.remove
      ? `It sells at ${row.base ? formatKes(row.base) : 'its base price'} in these hours from the next snapshot. Lines already fired keep their price.`
      : `Now ${row.price ? formatKes(row.price) : 'not on this list'}. Lines already fired keep the price they were sold at.`;

  return (
    <ConsoleOverlay
      open={Boolean(target)}
      onClose={() => {
        setValue('');
        onClose();
      }}
      title={title}
      description={description}
      width="md"
    >
      {row && target ? (
        <ReasonForm
          key={`${row.variantId}-${target.remove}`}
          destructive={target.remove}
          quickReasons={target.remove ? ['Promotion ended', 'Supplier cost went up'] : ['Supplier cost went up', 'Matching the market', 'New promotion']}
          confirmLabel={target.remove ? `Take off ${list.name}` : parsed ? `Set ${formatKes(parsed)}` : 'Set the price'}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            if (!target.remove && !parsed) throw new Error('Enter the new price in shillings, such as 350 or 1,250.');
            const r = await setPrice({ listId: list.id, variantId: row.variantId, price: target.remove ? null : formatDecimal(parsed!), reason });
            if (!r.ok) throw new Error(r.message);
            setValue('');
            onClose();
            router.refresh();
          }}
        >
          {!target.remove ? (
            <div className="pb-16">
              <TextField label="New price, including VAT" size="md" inputMode="decimal" placeholder={row.price ? formatFigure(row.price, { decimals: 'whole' }) : '350'} value={value} onChange={(e) => setValue(e.target.value)} leading={<span className="text-body text-ink-subtle">KES</span>} />
            </div>
          ) : null}
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}
