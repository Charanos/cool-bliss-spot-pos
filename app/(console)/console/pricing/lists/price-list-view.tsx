'use client';

import { formatBps, formatDateTime } from '@bliss/shared/format';
import { type Cents, cents, formatDecimal, formatFigure, formatKes, isPositive, parseKes, scale, shareBps, subtract } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconPencil, IconTagOff } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setPrice } from '../../_actions';
import { UrlSelect } from '../../_components/url-select';

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

export function PriceListView({
  lists,
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
  lists: { value: string; label: string }[];
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

  const columns: Column<PriceRow>[] = [
    { key: 'name', header: 'Item', width: 'minmax(220px,2fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={r.name} secondary={r.category} /> },
    ...(overlay
      ? [
          {
            key: 'base',
            header: baseName,
            width: '110px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => r.base,
            csv: (r: PriceRow) => (r.base === null ? '' : formatDecimal(r.base)),
            cell: (r: PriceRow) => (r.base === null ? <NumCell tone="muted">··</NumCell> : <Money value={r.base} currency={false} tone="muted" />),
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
      cell: (r) => (r.price === null ? <span className="text-body-sm text-ink-subtle">{overlay ? 'Not on this list' : '··'}</span> : <Money value={r.price} currency={false} tone={overlay ? 'accent' : 'default'} />),
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
            cell: (r: PriceRow) => (r.price !== null && r.base !== null ? <Money value={subtract(r.base, r.price)} currency={false} tone="muted" /> : <NumCell tone="muted">··</NumCell>),
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
            cell: (r: PriceRow) => (r.cost === null ? <NumCell tone="muted">··</NumCell> : <Money value={r.cost} currency={false} tone="muted" />),
          },
          {
            key: 'margin',
            header: 'Margin',
            width: '90px',
            align: 'right' as const,
            sortValue: (r: PriceRow) => (r.cost !== null && r.price !== null ? marginBps(r.price, r.cost) : null),
            csv: (r: PriceRow) => (r.cost !== null && r.price !== null ? (marginBps(r.price, r.cost) / 100).toFixed(1) : ''),
            cell: (r: PriceRow) => {
              if (r.cost === null || r.price === null) return <NumCell tone="muted">··</NumCell>;
              const bps = marginBps(r.price, r.cost);
              return <NumCell tone={bps < 3000 ? 'low' : 'default'}>{formatBps(bps)}</NumCell>;
            },
          },
        ]
      : []),
  ];

  return (
    <>
      {rules.length > 0 ? (
        <p className="mb-16 text-body text-ink-muted">
          Applies {rules.join('; ')}. Outside those hours the floor charges {baseName}.
        </p>
      ) : null}

      <DataTable
        id="pricing-list"
        caption={`Prices on ${list.name}`}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.variantId}
        defaultSort={{ key: 'name', dir: 'asc' }}
        leading={<UrlSelect param="list" label="Price list" options={lists} allLabel={null} fallback={lists[0]?.value ?? ''} />}
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
      />

      {changes.length > 0 ? (
        <RevealSection className="mt-40" aria-labelledby="recent-price-changes">
          <h2 id="recent-price-changes" className="border-b border-hairline pb-8 text-subtitle text-ink">
            Recent price changes
          </h2>
          <ul>
            {changes.map((c) => (
              <li key={c.id} className="grid grid-cols-[150px_minmax(0,1fr)_auto] items-baseline gap-16 border-b border-rule py-8">
                <span className="font-mono tabular text-num-sm text-ink-subtle">{formatDateTime(c.at, timezone)}</span>
                <span className="min-w-0 text-body text-ink">
                  {c.variant ? `${c.variant}: ` : ''}
                  <span className="text-ink-muted">{c.reason}</span>
                  <span className="text-ink-subtle"> · {c.by}</span>
                </span>
                <span className="whitespace-nowrap font-mono tabular text-num-sm text-ink">
                  {c.before ? formatFigure(cents(c.before)) : 'none'} → {c.after ? formatFigure(cents(c.after)) : 'removed'}
                </span>
              </li>
            ))}
          </ul>
        </RevealSection>
      ) : null}

      <PriceDialog target={editing} list={list} onClose={() => setEditing(null)} />
    </>
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
              <TextField label="New price, including VAT" size="md" mono inputMode="decimal" placeholder={row.price ? formatFigure(row.price, { decimals: 'whole' }) : '350'} value={value} onChange={(e) => setValue(e.target.value)} leading={<span className="text-body text-ink-subtle">KES</span>} />
            </div>
          ) : null}
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}
