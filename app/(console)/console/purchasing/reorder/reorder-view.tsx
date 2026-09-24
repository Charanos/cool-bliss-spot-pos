'use client';

import { formatQty, plural } from '@bliss/shared/format';
import { type Cents, compare, formatDecimal, formatKes, multiplyByQty, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { ConsoleBentoCard, Metric } from '@bliss/ui/components/console/metric';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAlertTriangle, IconCash, IconPackages, IconTruckDelivery } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { raisePurchaseOrder } from '../../_actions';

export interface ReorderLine {
  variantId: string;
  name: string;
  category: string;
  imageKey: string | null;
  onHand: number;
  onOrder: number;
  reorderPoint: number;
  velocity: number;
  daysCover: number | null;
  suggestedQty: number;
  packSize: number;
  unitCost: Cents;
  finished: boolean;
}

export interface ReorderGroup {
  supplierId: string | null;
  name: string;
  contact: string | null;
  leadTimeDays: number | null;
  minOrder: Cents | null;
  lines: ReorderLine[];
}

/** Round a suggestion up to whole cases, because that is how the supplier delivers. */
const toPacks = (qty: number, pack: number) => (pack > 1 ? Math.ceil(qty / pack) * pack : qty);

export function ReorderView({ groups }: { groups: ReorderGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState title="Nothing needs ordering" body="Every item has enough cover for its supplier's lead time. Suggestions appear as sales draw stock down." />;
  }

  const totalLines = groups.reduce((acc, g) => acc + g.lines.length, 0);
  const stockouts = groups.flatMap((g) => g.lines).filter((l) => l.onHand <= 0).length;
  const totalEstimatedCost = sum(groups.flatMap((g) => g.lines.map((l) => multiplyByQty(l.unitCost, toPacks(l.suggestedQty, l.packSize)))));

  return (
    <div className="flex flex-col gap-24">
      {/* Executive Reorder Overview Deck */}
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        <Metric
          label="Vendors to Order"
          value={groups.length}
          detail="Active supplier batches"
          icon={IconTruckDelivery}
          tone="default"
        />
        <Metric
          label="Lines to Restock"
          value={totalLines}
          detail="Reorder threshold reached"
          icon={IconPackages}
          tone="default"
        />
        <Metric
          label="Depleted SKUs"
          value={stockouts}
          detail="Zero units in store"
          icon={IconAlertTriangle}
          tone={stockouts > 0 ? 'stop' : 'default'}
        />
        <Metric
          label="Estimated Reorder Total"
          value={<Money value={totalEstimatedCost} currency={false} decimals="whole" />}
          detail="Case-pack rounded total"
          icon={IconCash}
          tone="poured"
        />
      </div>

      <div className="flex flex-col gap-24">
        {groups.map((g) => (
          <SupplierGroup key={g.supplierId ?? 'none'} group={g} />
        ))}
      </div>
    </div>
  );
}

function SupplierGroup({ group }: { group: ReorderGroup }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(group.lines.map((l) => [l.variantId, String(toPacks(l.suggestedQty, l.packSize))])));
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(group.lines.map((l) => [l.variantId, true])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = (id: string) => {
    const n = Number(qty[id]);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const chosen = group.lines.filter((l) => included[l.variantId] && parsed(l.variantId) > 0);
  const total = sum(chosen.map((l) => multiplyByQty(l.unitCost, parsed(l.variantId))));
  const belowMinimum = group.minOrder !== null && chosen.length > 0 && compare(total, group.minOrder) < 0;
  const invalid = group.lines.some((l) => included[l.variantId] && qty[l.variantId] !== '' && parsed(l.variantId) === 0);

  const raise = () => {
    if (!group.supplierId) return;
    setError(null);
    start(async () => {
      const result = await raisePurchaseOrder({
        supplierId: group.supplierId!,
        lines: chosen.map((l) => ({ variantId: l.variantId, qty: parsed(l.variantId), unitCost: formatDecimal(l.unitCost) })),
        expectedAt: null,
        notes: null,
      });
      if (!result.ok) setError(result.message);
      else if (result.id) router.push(`/console/purchasing/orders/${result.id}`);
    });
  };

  return (
    <ConsoleBentoCard
      title={group.name}
      subtitle={
        [
          group.contact,
          group.leadTimeDays !== null ? `delivers in ${plural(group.leadTimeDays, 'day')}` : null,
          group.minOrder ? `minimum order ${formatKes(group.minOrder, { decimals: 'whole' })}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      }
      icon={IconTruckDelivery}
      tone={belowMinimum ? 'attention' : group.supplierId ? 'poured' : 'default'}
      action={
        <div className="flex items-center gap-16">
          <span className="flex flex-col items-end">
            <span className="text-label text-ink-subtle">{plural(chosen.length, 'line')}</span>
            <Money value={total} size="num-lg" />
          </span>
          {group.supplierId ? (
            <Button icon={IconTruckDelivery} onClick={raise} loading={pending} disabled={chosen.length === 0 || invalid}>
              Raise order
            </Button>
          ) : null}
        </div>
      }
      className="p-0 overflow-hidden"
    >
      {error || belowMinimum || !group.supplierId ? (
        <div className="flex flex-col gap-8 p-16 pb-0">
          {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
          {belowMinimum ? (
            <InlineNotice tone="low">
              This order is under {group.name}&rsquo;s minimum of {formatKes(group.minOrder!, { decimals: 'whole' })}. They may not deliver it on its own.
            </InlineNotice>
          ) : null}
          {!group.supplierId ? (
            <InlineNotice tone="info">
              These items have no default supplier. Set one in the catalogue to order them from here.
            </InlineNotice>
          ) : null}
        </div>
      ) : null}

      <div role="table" aria-label={`Suggested lines for ${group.name}`} className="mt-12 overflow-x-auto">
        <div role="row" className="grid grid-cols-[36px_minmax(200px,2fr)_90px_90px_100px_90px_130px_110px] items-center gap-16 border-b border-hairline bg-raised/30 px-16 py-10">
          {['', 'Item', 'On hand', 'On order', 'Sells / day', 'Cover', 'Order', 'Cost'].map((h, i) => (
            <span key={h || i} role="columnheader" className={i >= 2 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
              {h}
            </span>
          ))}
        </div>
        {group.lines.map((l) => {
          const n = parsed(l.variantId);
          const on = included[l.variantId];
          return (
            <div
              key={l.variantId}
              role="row"
              className={`grid min-h-row-floor grid-cols-[36px_minmax(200px,2fr)_90px_90px_100px_90px_130px_110px] items-center gap-16 border-b border-rule px-16 py-8 transition-colors hover:bg-raised/40 ${on ? '' : 'opacity-60'}`}
            >
              <span role="cell">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setIncluded((c) => ({ ...c, [l.variantId]: e.target.checked }))}
                  aria-label={`Include ${l.name}`}
                  className="size-[18px] rounded-sm accent-[var(--color-accent)] cursor-pointer"
                />
              </span>
              <span role="cell" className="flex min-w-0 items-center gap-12">
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-ink">{l.name}</span>
                  <span className="block truncate text-body-sm text-ink-subtle">
                    {l.category} · reorder at {l.reorderPoint}
                    {l.packSize > 1 ? ` · cases of ${l.packSize}` : ''}
                  </span>
                </span>
                {l.finished ? <StatusChip status="finished" /> : null}
              </span>
              <span role="cell" className={`text-right font-mono tabular text-num ${l.onHand <= 0 ? 'text-stop' : 'text-ink'}`}>
                {formatQty(l.onHand, 1)}
              </span>
              <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                {l.onOrder > 0 ? formatQty(l.onOrder, 0) : '··'}
              </span>
              <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                {l.velocity.toFixed(l.velocity < 10 ? 1 : 0)}
              </span>
              <span role="cell" className={`text-right font-mono tabular text-num ${l.daysCover !== null && l.daysCover < 2 ? 'text-low' : 'text-ink-muted'}`}>
                {l.daysCover === null ? '··' : `${l.daysCover.toFixed(1)}d`}
              </span>
              <span role="cell" className="flex justify-end">
                <span className="w-[96px]">
                  <TextField
                    label={`Quantity of ${l.name}`}
                    hideLabel
                    inputMode="numeric"
                    mono
                    size="md"
                    value={qty[l.variantId] ?? ''}
                    onChange={(e) => setQty((c) => ({ ...c, [l.variantId]: e.target.value.replace(/[^\d]/g, '') }))}
                    className="text-right"
                  />
                </span>
              </span>
              <span role="cell" className="text-right font-mono tabular">
                <Money value={multiplyByQty(l.unitCost, n)} currency={false} decimals="whole" tone={on ? 'default' : 'subtle'} />
              </span>
            </div>
          );
        })}
      </div>
    </ConsoleBentoCard>
  );
}
