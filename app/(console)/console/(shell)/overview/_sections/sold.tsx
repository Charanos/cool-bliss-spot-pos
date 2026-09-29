import { formatBps } from '@bliss/shared/format';
import { shareBps, sum } from '@bliss/shared/money';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { type CategoryColour, categoryEdgeClass } from '@bliss/ui/lib/seat';
import { IconCategory, IconChevronRight, IconTrendingUp } from '@tabler/icons-react';
import Link from 'next/link';
import type { OverviewData } from '../_data';
import { Panel, PanelEmpty } from './panel';

/** The night by category: each one's share of the takings as a bar in its own colour, with its margin. */
export function CategoriesPanel({ d }: { d: OverviewData }) {
  const total = sum(d.categories.map((c) => c.value));
  const top = d.categories[0];
  return (
    <Panel id="overview-categories" icon={IconCategory} title="By category" subtitle={top ? `${top.name} led with ${formatBps(shareBps(top.value, total))}` : 'Nothing sold yet'} href="/console/reports/performance" hrefLabel="Performance">
      {d.categories.length === 0 ? (
        <PanelEmpty icon={IconCategory} title="Nothing sold yet" body="Each category's share of the night lines up here." />
      ) : (
        <ul className="flex flex-col gap-12 px-20 py-16">
          {d.categories.slice(0, 7).map((c) => {
            const share = total > 0n ? Number(c.value) / Number(total) : 0;
            return (
              <li key={c.categoryId}>
                <Link href={`/console/catalogue/categories/${c.categoryId}`} className="group -mx-8 flex flex-col gap-6 rounded-md px-8 py-4 transition-hover hover:bg-band">
                  <span className="flex items-baseline gap-12">
                    <span className="min-w-0 flex-1 truncate text-ui text-ink">{c.name}</span>
                    <span className="font-mono tabular text-micro text-ink-subtle">{c.units} sold</span>
                    <span className={cx('w-56 text-right font-mono tabular text-micro', c.marginBps === null ? 'text-ink-subtle' : c.marginBps < 3500 ? 'text-low' : 'text-poured')}>{c.marginBps === null ? 'No cost' : formatBps(c.marginBps)}</span>
                    <Money value={c.value} size="num-sm" decimals="whole" currency={false} className="w-72 justify-end" />
                  </span>
                  <span aria-hidden="true" className="relative h-6 overflow-hidden rounded-pill bg-band-strong">
                    <span className={cx('gauge-grow-x absolute inset-y-0 left-0 rounded-pill', categoryEdgeClass(c.colour as CategoryColour))} style={{ width: `${Math.max(2, share * 100).toFixed(1)}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The best sellers of the night, ranked, each with its share of the takings and a way to its product. */
export function MoversPanel({ d }: { d: OverviewData }) {
  const max = d.movers[0]?.value ?? 0n;
  return (
    <Panel id="overview-movers" icon={IconTrendingUp} title="Best sellers" subtitle={`${d.live ? 'Tonight' : 'Last night'}, by sales`} href="/console/reports/sales" hrefLabel="Sales report">
      {d.movers.length === 0 ? (
        <PanelEmpty icon={IconTrendingUp} title="Nothing sold yet" body="The best sellers show here as the night trades." />
      ) : (
        <ol className="flex flex-col py-8">
          {d.movers.map((m, i) => (
            <li key={m.productId}>
              <Link href={`/console/catalogue/products/${m.productId}`} className="group flex items-center gap-12 px-20 py-8 transition-hover hover:bg-band">
                <span className={cx('flex size-control-sm shrink-0 items-center justify-center rounded-pill font-mono text-num-sm', i === 0 ? 'bg-accent text-accent-ink' : i < 3 ? 'bg-accent-wash text-accent-text' : 'bg-band text-ink-subtle')}>{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-4">
                  <span className="flex items-baseline gap-8">
                    <span className="min-w-0 flex-1 truncate text-ui text-ink">{m.name}</span>
                    <span className="font-mono tabular text-micro text-ink-subtle">× {m.units}</span>
                  </span>
                  <span aria-hidden="true" className="relative h-4 overflow-hidden rounded-pill bg-band-strong">
                    <span className="gauge-grow-x absolute inset-y-0 left-0 rounded-pill bg-accent" style={{ width: `${max > 0n ? ((Number(m.value) / Number(max)) * 100).toFixed(1) : 0}%` }} />
                  </span>
                </span>
                <span className="flex w-96 shrink-0 flex-col items-end">
                  <Money value={m.value} size="num-sm" decimals="whole" currency={false} />
                  <span className={cx('font-mono text-micro', m.marginBps === null ? 'text-ink-subtle' : m.marginBps < 3500 ? 'text-low' : 'text-poured')}>{m.marginBps === null ? 'No cost' : `${formatBps(m.marginBps)} margin`}</span>
                </span>
                <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-2" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
