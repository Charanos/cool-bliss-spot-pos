import { formatDate, formatQty } from '@bliss/shared/format';
import { abs } from '@bliss/shared/money';
import { SegmentBar } from '@bliss/ui/components/console/gauges';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconChevronRight, IconClipboardList, IconPackage, IconShoppingCart } from '@tabler/icons-react';
import Link from 'next/link';
import type { OverviewData } from '../_data';
import { Panel } from './panel';

/**
 * The stock at a glance: every counted item by state in one bar, what to reorder and what it would
 * cost, and the lines the last count found out, each a way to where it is put right.
 */
export function StockPanel({ d }: { d: OverviewData }) {
  const s = d.stock;
  const recount = s.segments.find((x) => x.key === 'recount')?.value ?? 0;
  const v = d.variance;
  const worst = (v?.rows ?? []).filter((r) => r.outside).slice(0, 3);
  return (
    <Panel
      id="overview-stock"
      icon={IconPackage}
      tone={s.belowZero > 0 ? 'stop' : recount > 0 || s.reorder > 0 ? 'low' : 'poured'}
      title="Stock"
      subtitle={`${s.tracked} items kept in stock`}
      href="/console/inventory/stock"
      hrefLabel="Stock on hand"
    >
      <div className="flex flex-col gap-16 px-20 py-16">
        <SegmentBar segments={s.segments} label="Items kept in stock, by state" />
      </div>
      <ul className="flex flex-col border-t border-edge">
        <StockRow href="/console/purchasing/reorder" icon={IconShoppingCart} label="To reorder" tone={s.reorder > 0 ? 'low' : undefined} value={s.reorder > 0 ? <>{s.reorder} · <Money value={s.reorderCost} size="num-sm" decimals="whole" currency={false} /></> : 'None'} />
        <StockRow href="/console/inventory/counts/new" icon={IconClipboardList} label="Count needed" tone={recount > 0 ? 'low' : undefined} value={recount > 0 ? String(recount) : 'None'} />
      </ul>
      <div className="flex flex-col border-t border-edge">
        <p className="flex items-baseline justify-between px-20 pb-4 pt-12">
          <span className="label-caps text-ink-subtle">Last count</span>
          <span className="text-micro text-ink-subtle">{v ? formatDate(v.count.committedAt ?? v.count.openedAt, d.tz) : 'None committed'}</span>
        </p>
        {!v ? (
          <p className="px-20 pb-16 text-body-sm text-ink-muted">Commit a count and the lines that came out different show here.</p>
        ) : worst.length === 0 ? (
          <p className="px-20 pb-16 text-body-sm text-poured">Every line came out within tolerance.</p>
        ) : (
          <ul className="flex flex-col pb-8">
            {worst.map((r) => (
              <li key={r.variantId}>
                <Link href={`/console/inventory/counts/${v.count.id}`} className="group flex items-center gap-12 px-20 py-6 transition-hover hover:bg-band">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{r.name}</span>
                  <span className={cx('font-mono tabular text-micro', r.variance < 0 ? 'text-stop' : 'text-low')}>
                    {r.variance > 0 ? '+' : ''}
                    {formatQty(r.variance, 1)}
                  </span>
                  <Money value={abs(r.value)} size="num-sm" decimals="whole" tone="attention" className="w-72 justify-end" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function StockRow({ href, icon: Glyph, label, value, tone }: { href: string; icon: typeof IconPackage; label: string; value: React.ReactNode; tone?: 'low' }) {
  return (
    <li className="border-t border-edge first:border-t-0">
      <Link href={href} className="group flex items-center gap-12 px-20 py-8 transition-hover hover:bg-band">
        <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" className={tone === 'low' ? 'text-low' : 'text-ink-subtle'} />
        <span className="flex-1 text-body-sm text-ink">{label}</span>
        <span className={cx('font-mono tabular text-num-sm', tone === 'low' ? 'text-low' : 'text-ink-muted')}>{value}</span>
        <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-subtle transition-transform group-hover:translate-x-2" />
      </Link>
    </li>
  );
}
