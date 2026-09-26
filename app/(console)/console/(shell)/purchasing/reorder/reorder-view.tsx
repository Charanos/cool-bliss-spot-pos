'use client';

import { createUuidV7 } from '@bliss/shared/id';
import { formatQty, plural } from '@bliss/shared/format';
import { type Cents, compare, formatDecimal, formatKes, multiplyByQty, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertTriangle, IconCash, IconPackages, IconTruckDelivery } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { raisePurchaseOrder } from '../../_actions/purchasing';

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

const newId = createUuidV7();
const head = 'px-12 py-12 text-label text-ink-subtle';

/**
 * N-15: what to order, grouped by the supplier who delivers it. Quantities start at the suggestion
 * rounded up to whole cases; untick a line or change a quantity, then raise the order.
 */
export function ReorderView({ groups }: { groups: ReorderGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState title="Nothing needs ordering" body="Every item has enough stock to last until its supplier can deliver. Suggestions appear as sales draw stock down." />;
  }

  const lines = groups.flatMap((g) => g.lines);
  const finished = lines.filter((l) => l.onHand <= 0).length;
  const estimate = sum(lines.map((l) => multiplyByQty(l.unitCost, toPacks(l.suggestedQty, l.packSize))));

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Suppliers to order from" icon={IconTruckDelivery} value={<CountUp value={groups.filter((g) => g.supplierId).length} />} detail={groups.some((g) => !g.supplierId) ? 'Some items have no supplier set' : 'One order each'} />
        <Metric label="Items to reorder" icon={IconPackages} value={<CountUp value={lines.length} delayMs={60} />} detail="At or below their reorder point" />
        <Metric label="Finished" icon={IconAlertTriangle} tone={finished > 0 ? 'stop' : 'default'} value={<CountUp value={finished} delayMs={120} />} detail={finished > 0 ? 'None left in the store' : 'Nothing has run out'} />
        <Metric label="Estimated cost" icon={IconCash} value={<Money value={estimate} size="num-kpi" decimals="whole" />} detail="At the last price paid, in whole cases" />
      </MetricGrid>

      {groups.map((g) => (
        <SupplierGroup key={g.supplierId ?? 'none'} group={g} />
      ))}
    </div>
  );
}

function SupplierGroup({ group }: { group: ReorderGroup }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(group.lines.map((l) => [l.variantId, String(toPacks(l.suggestedQty, l.packSize))])));
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(group.lines.map((l) => [l.variantId, true])));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  // One order per visit: a double click, or a retry after a dropped connection, raises it once.
  const [requestId] = useState(() => newId());

  const parsed = (id: string) => {
    const n = Number(qty[id]);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const chosen = group.lines.filter((l) => included[l.variantId] && parsed(l.variantId) > 0);
  const total = sum(chosen.map((l) => multiplyByQty(l.unitCost, parsed(l.variantId))));
  const belowMinimum = group.minOrder !== null && chosen.length > 0 && compare(total, group.minOrder) < 0;
  const invalid = group.lines.some((l) => included[l.variantId] && qty[l.variantId] !== '' && parsed(l.variantId) === 0);
  const titleId = `reorder-${group.supplierId ?? 'none'}`;

  const raise = () => {
    if (!group.supplierId) return;
    setError('');
    start(async () => {
      const result = await raisePurchaseOrder({
        supplierId: group.supplierId!,
        lines: chosen.map((l) => ({ variantId: l.variantId, qty: parsed(l.variantId), unitCost: formatDecimal(l.unitCost) })),
        expectedAt: null,
        notes: null,
        requestId,
      });
      if (!result.ok) setError(result.message);
      else router.push(`/console/purchasing/orders/${result.id}`);
    });
  };

  return (
    <Card aria-labelledby={titleId} tone={belowMinimum ? 'low' : undefined}>
      <CardHeader
        band
        level="h2"
        titleId={titleId}
        icon={IconTruckDelivery}
        title={group.name}
        subtitle={[group.contact, group.leadTimeDays !== null ? `delivers in ${plural(group.leadTimeDays, 'day')}` : null, group.minOrder ? `minimum ${formatKes(group.minOrder, { decimals: 'whole' })}` : null].filter(Boolean).join(', ')}
      />
      {error || belowMinimum || !group.supplierId ? (
        <div className="flex flex-col gap-8 px-20 pt-16">
          {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
          {belowMinimum ? <InlineNotice tone="low">This order is under {group.name}&rsquo;s minimum of {formatKes(group.minOrder!, { decimals: 'whole' })}. They may not deliver it on its own.</InlineNotice> : null}
          {!group.supplierId ? <InlineNotice tone="info">These items have no default supplier. Set one in the catalogue to order them from here.</InlineNotice> : null}
        </div>
      ) : null}
      <div className="scroll-x">
        <table className="w-full border-collapse">
          <caption className="sr-only">Suggested lines for {group.name}</caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="w-[52px] py-12 pl-20">
                <span className="sr-only">Include</span>
              </th>
              <th scope="col" className={`${head} text-left`}>
                Item
              </th>
              <th scope="col" className={`${head} text-right`}>
                In store
              </th>
              <th scope="col" className={`${head} text-right`}>
                On order
              </th>
              <th scope="col" className={`${head} text-right`}>
                Sells a day
              </th>
              <th scope="col" className={`${head} text-right`}>
                Lasts
              </th>
              <th scope="col" className={`${head} text-right`}>
                Order
              </th>
              <th scope="col" className={`${head} pr-20 text-right`}>
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {group.lines.map((l) => {
              const on = included[l.variantId];
              return (
                <tr key={l.variantId} className={cx('border-b border-rule last:border-b-0', on ? null : 'text-ink-subtle')}>
                  <td className="py-8 pl-20">
                    <input type="checkbox" checked={on} onChange={(e) => setIncluded((c) => ({ ...c, [l.variantId]: e.target.checked }))} aria-label={`Include ${l.name}`} className="size-16 cursor-pointer accent-accent" />
                  </td>
                  <td className="px-12 py-8">
                    <span className="flex min-w-0 items-center gap-8">
                      <span className={cx('truncate text-ui', on ? 'text-ink' : 'text-ink-subtle')}>{l.name}</span>
                      {l.finished ? <StatusChip status="finished" /> : null}
                    </span>
                    <span className="block truncate text-body-sm text-ink-subtle">
                      {l.category}, reorder at {l.reorderPoint}
                      {l.packSize > 1 ? `, cases of ${l.packSize}` : ''}
                    </span>
                  </td>
                  <td className={cx('px-12 py-8 text-right font-mono tabular text-num-md', l.onHand <= 0 ? 'text-stop' : 'text-ink')}>{formatQty(l.onHand, 1)}</td>
                  <td className="px-12 py-8 text-right font-mono tabular text-num-md text-ink-muted">{l.onOrder > 0 ? formatQty(l.onOrder, 0) : 'None'}</td>
                  <td className="px-12 py-8 text-right font-mono tabular text-num-md text-ink-muted">{l.velocity.toFixed(l.velocity < 10 ? 1 : 0)}</td>
                  <td className={cx('px-12 py-8 text-right font-mono tabular text-num-md', l.daysCover !== null && l.daysCover < 2 ? 'text-low' : 'text-ink-muted')}>
                    {l.daysCover === null ? 'No sales' : `${l.daysCover.toFixed(1)} days`}
                  </td>
                  <td className="px-12 py-8 text-right">
                    <input
                      aria-label={`Quantity of ${l.name}`}
                      inputMode="numeric"
                      value={qty[l.variantId] ?? ''}
                      onChange={(e) => setQty((c) => ({ ...c, [l.variantId]: e.target.value.replace(/[^\d]/g, '') }))}
                      disabled={!on}
                      className="h-control-sm w-[88px] rounded-md border border-edge-strong bg-transparent px-8 text-right font-mono tabular text-num-md text-ink transition-hover focus-visible:border-accent disabled:opacity-60"
                    />
                  </td>
                  <td className="py-8 pl-12 pr-20 text-right">
                    <Money value={multiplyByQty(l.unitCost, parsed(l.variantId))} currency={false} size="num-md" decimals="whole" tone={on ? 'default' : 'subtle'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CardFooter>
        <span className="text-body-sm text-ink-muted">
          {plural(chosen.length, 'line')}, <Money value={total} size="num-md" />
        </span>
        {group.supplierId ? (
          <Button variant="primary" size="sm" icon={IconTruckDelivery} onClick={raise} loading={pending} disabled={chosen.length === 0 || invalid}>
            Raise the order
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
