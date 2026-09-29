import { formatBps, formatIsoDate, formatWeekday, plural } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { zonedParts } from '@bliss/shared/time';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { WeekBars } from '@bliss/ui/components/console/week-bars';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowDownRight, IconArrowUpRight, IconCash, IconLayoutGrid, IconPackage, IconReceipt2 } from '@tabler/icons-react';
import type { OverviewData } from '../_data';

function greeting(now: number, tz: string): string {
  const h = zonedParts(now, tz).hour;
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * The head of the Overview: who is looking, which night the page is about and whether it is still
 * trading, the night's takings with how they compare, the week behind it as bars, and the pages a
 * manager opens next.
 */
export function OverviewHero({ d }: { d: OverviewData }) {
  const h = d.headline;
  const delta = h.salesDeltaBps;
  const up = delta !== null && delta >= 0;
  const weekTotal = sum(d.week.map((w) => w.value));
  const hasWeek = d.week.some((w) => w.value > 0n);

  return (
    <section aria-labelledby="overview-hero" className="texture-dots-accent relative overflow-hidden rounded-card bg-accent-wash px-24 py-24 desktop:px-32 desktop:py-32">
      <div className="grid grid-cols-1 items-end gap-24 desktop:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] desktop:gap-40">
        <div className="flex min-w-0 flex-col gap-16">
          <p className="flex flex-wrap items-center gap-8 label-caps text-accent-text">
            <span aria-hidden="true" className={cx('size-dot rounded-dot', d.live ? 'animate-breathe bg-poured' : 'bg-ink-subtle')} />
            {d.live ? 'Trading now' : 'Last night'}
            <span className="text-ink-subtle">
              · {formatWeekday(d.date)} {formatIsoDate(d.date)}
            </span>
          </p>
          <h2 id="overview-hero" className="text-title-page text-ink">
            {greeting(d.now, d.tz)}, {d.viewer}.
          </h2>
          <div className="flex flex-wrap items-end gap-x-16 gap-y-8">
            <AnimatedMoney value={h.netSales} animation="metric.count" size="display" fromZeroOnMount decimals="whole" />
            {delta !== null ? (
              <span className={cx('mb-8 inline-flex items-center gap-4 rounded-pill px-8 py-2 font-mono tabular text-num-sm', up ? 'bg-poured-wash text-poured' : 'bg-low-wash text-low')}>
                {up ? <IconArrowUpRight size={14} stroke={2} aria-hidden="true" /> : <IconArrowDownRight size={14} stroke={2} aria-hidden="true" />}
                {formatBps(delta, { signed: true })}
                <span className="font-sans text-micro text-ink-subtle">vs {h.comparedWith}</span>
              </span>
            ) : null}
          </div>
          <p className="measure text-ui text-ink-muted">
            {d.live ? 'Taken so far tonight' : 'Taken last night'}, from {plural(d.summary.bills, 'bill')} and {plural(h.seatsServed, 'guest')}
            {d.floor.tabs > 0 ? (
              <>
                . <Money value={d.floor.value} size="num-sm" decimals="whole" /> more is on {plural(d.floor.tabs, 'open tab')} now.
              </>
            ) : (
              '.'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <p className="flex items-baseline justify-between gap-12 text-body-sm">
            <span className="text-ink-muted">The last seven nights</span>
            <Money value={weekTotal} size="num-sm" decimals="round" tone="muted" />
          </p>
          {hasWeek ? (
            <WeekBars
              caption="Net sales over the last seven nights"
              currentKey={d.date}
              height={170}
              nights={d.week.map((w) => ({ key: w.date, label: formatWeekday(w.date).slice(0, 3), title: `${formatWeekday(w.date)} ${formatIsoDate(w.date)}`, shillings: Math.round(Number(w.value) / 100), tabs: w.tabs }))}
            />
          ) : (
            <span className="flex h-72 items-center text-body-sm text-ink-subtle">The week fills in as nights are traded.</span>
          )}
        </div>
      </div>

      <nav aria-label="Go to" className="mt-24 flex flex-wrap gap-8 border-t border-edge pt-16">
        <ButtonLink href="/console/trade/open" variant="secondary" icon={IconLayoutGrid}>
          {`Open tabs${d.floor.tabs > 0 ? ` · ${d.floor.tabs}` : ''}`}
        </ButtonLink>
        <ButtonLink href="/console/trade/bills?range=tonight" variant="secondary" icon={IconReceipt2}>
          Bills
        </ButtonLink>
        <ButtonLink href="/console/trade/drawers" variant="secondary" icon={IconCash}>
          Drawers
        </ButtonLink>
        <ButtonLink href="/console/inventory/stock" variant="secondary" icon={IconPackage}>
          Stock
        </ButtonLink>
      </nav>
    </section>
  );
}
