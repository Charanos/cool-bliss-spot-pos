import { formatBps, plural } from '@bliss/shared/format';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as reporting from '@/modules/reporting/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { UrlSelect } from '../../_components/url-select';

export const metadata: Metadata = { title: 'Seats' };

/**
 * N-14: sales by seat position, to understand table composition. The attribution rate says how far
 * to trust it: a floor that leaves most lines on Shared makes the seat figures thin.
 */
export default async function SeatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const data = reporting.seatComposition(range.from, range.to);

  return (
    <>
      <div className="mb-24 flex flex-wrap items-end justify-between gap-16">
        <UrlSelect param="range" label="Range" options={rangeOptions(false)} allLabel={null} fallback={range.key} />
        <p className="max-w-[60ch] text-body-sm text-ink-subtle">Seat 1 is whoever the waiter took first. Positions describe the order people ordered in, not where they sat.</p>
      </div>

      <RevealSection className="mb-16 flex flex-wrap gap-x-40 gap-y-16 border-b border-hairline pb-20">
        <div>
          <span className="text-label text-ink-subtle">Lines on a seat, tables of two or more</span>
          <p className="font-mono tabular text-num-lg text-ink">{formatBps(data.attributionBps)}</p>
        </div>
        <div>
          <span className="text-label text-ink-subtle">Shared</span>
          <p className="flex items-baseline gap-8">
            <Money value={data.shared} size="num-lg" decimals="whole" />
            <span className="font-mono tabular text-num-sm text-ink-subtle">{formatBps(data.sharedShareBps)}</span>
          </p>
        </div>
        <div>
          <span className="text-label text-ink-subtle">All seated sales</span>
          <p>
            <Money value={data.total} size="num-lg" decimals="whole" />
          </p>
        </div>
      </RevealSection>

      <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <h2 className="text-subtitle text-ink">By seat position</h2>
          <div className="mt-12">
            <ShareBars rows={data.seats.map((s) => ({ key: s.seat, label: `Seat ${s.seat}`, value: s.total, detail: `${formatBps(s.shareBps)} · ${plural(s.lines, 'line')}` }))} />
          </div>
        </RevealSection>
        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <h2 className="text-subtitle text-ink">By party size</h2>
          <div role="table" aria-label="Sales by party size" className="mt-12">
            <div role="row" className="grid grid-cols-[minmax(100px,1fr)_80px_120px_120px] gap-16 border-b border-hairline py-8">
              {['Party', 'Tabs', 'Sales', 'Per guest'].map((h, i) => (
                <span key={h} role="columnheader" className={i > 0 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
                  {h}
                </span>
              ))}
            </div>
            {data.guests.map((g) => (
              <div key={g.guestCount} role="row" className="grid min-h-row grid-cols-[minmax(100px,1fr)_80px_120px_120px] items-center gap-16 border-b border-rule last:border-b-0">
                <span role="cell" className="text-body text-ink">
                  {g.guestCount === 1 ? 'On their own' : `${g.guestCount} guests`}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                  {g.tabs}
                </span>
                <span role="cell" className="text-right">
                  <Money value={g.total} currency={false} decimals="whole" />
                </span>
                <span role="cell" className="text-right">
                  <Money value={g.perSeat} currency={false} decimals="whole" tone="muted" />
                </span>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </>
  );
}
