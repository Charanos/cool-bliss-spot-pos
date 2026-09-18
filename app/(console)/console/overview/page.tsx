import { formatDateTime, formatIsoDate, formatWeekday } from '@bliss/shared/format';
import { PageHeader, RevealSection } from '@bliss/ui/components/console/shell';
import { Dot } from '@bliss/ui/components/status';
import { IconArrowRight } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as reporting from '@/modules/reporting/service';
import * as identity from '@/modules/identity/service';
import { HeadlineMetrics, SalesByHour, TopMovers, VarianceByProduct } from './_parts';

export const metadata: Metadata = { title: 'Overview' };

/**
 * The screen the owner opens at 09:00. It answers three questions above the fold with no scrolling
 * and no interaction: how did last night go, where is the money leaking, and what needs me today.
 */
export default function OverviewPage() {
  const clock = reporting.clock();
  const outlet = identity.outlet();
  const date = clock.lastNight;
  const headline = reporting.headline(date);
  const hours = reporting.salesByHour(date);
  const attention = reporting.needsAttention();
  const movers = reporting.topMovers(date, date);
  const variance = reporting.latestCommittedVariance();

  return (
    <>
      <PageHeader
        title="Last night"
        description={`${formatWeekday(date)} ${formatIsoDate(date)} · ${headline.tabs} tabs · ${clock.tradingInProgress ? 'trading now' : 'business day closed'}`}
      />

      <div className="mt-24">
        <HeadlineMetrics
          netSales={headline.netSales}
          delta={headline.salesDeltaBps === null ? null : { bps: headline.salesDeltaBps, against: headline.comparedWith }}
          marginBps={headline.grossMarginBps}
          seats={headline.seatsServed}
          tabs={headline.tabs}
          avgSeatsTenths={Math.round(headline.avgSeats * 10)}
          variance={headline.varianceAtCost}
          varianceLines={headline.varianceLines}
        />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-16 desktop:grid-cols-[3fr_2fr]">
        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <div className="flex items-baseline justify-between gap-16">
            <h2 className="text-subtitle text-ink">Sales by hour</h2>
            <span className="text-body-sm text-ink-subtle">Fired lines, KES</span>
          </div>
          <div className="mt-20">
            <SalesByHour data={hours.map((h) => ({ key: h.hour, label: h.hour.slice(0, 2), value: h.value }))} />
          </div>
        </RevealSection>

        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <div className="flex items-baseline justify-between gap-16">
            <h2 className="text-subtitle text-ink">Needs attention</h2>
            <span className="font-mono tabular text-num-sm text-ink-subtle">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <p className="mt-16 text-body text-ink-muted">Nothing needs you today.</p>
          ) : (
            <ul className="mt-8">
              {attention.map((item) => (
                <li key={item.text} className="border-b border-rule last:border-b-0">
                  <Link href={item.href} className="group flex min-h-[52px] items-center gap-12 py-8">
                    <Dot tone={item.tone} />
                    <span className="min-w-0 flex-1 text-body text-ink">{item.text}</span>
                    <span className="inline-flex shrink-0 items-center gap-4 text-body-sm text-accent-text group-hover:underline">
                      {item.cta}
                      <IconArrowRight size={14} stroke={1.5} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </RevealSection>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-16 desktop:grid-cols-2">
        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <div className="flex items-baseline justify-between gap-16 pb-12">
            <h2 className="text-subtitle text-ink">Top movers</h2>
            <Link href="/console/reports/sales" className="text-body-sm text-accent-text hover:underline">
              Sales report
            </Link>
          </div>
          <TopMovers rows={movers} />
        </RevealSection>
        <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
          <div className="flex items-baseline justify-between gap-16 pb-12">
            <h2 className="text-subtitle text-ink">Variance by product</h2>
            <span className="text-body-sm text-ink-subtle">
              {variance ? `Count committed ${formatDateTime(variance.count.committedAt ?? variance.count.openedAt, outlet.timezone)}` : 'No committed count yet'}
            </span>
          </div>
          <VarianceByProduct rows={(variance?.rows ?? []).slice(0, 8)} />
        </RevealSection>
      </div>
    </>
  );
}
