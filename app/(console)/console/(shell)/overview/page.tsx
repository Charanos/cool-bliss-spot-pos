import { formatDateTime, formatIsoDate, formatWeekday, plural } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Callout } from '@bliss/ui/components/console/section';
import { PageHeader } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { ToneChip } from '@bliss/ui/components/status';
import { IconAlertCircle, IconArrowRight, IconChartBar, IconClock, IconPackage, IconScale, IconTrendingUp } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { AttentionBoard, HeadlineMetrics, SalesByHour, TopMovers, VarianceByProduct } from './_parts';

export const metadata: Metadata = { title: 'Overview' };

/**
 * The page opened at nine in the morning or in the middle of service: last night's figures, what
 * needs a person now, and what is on the floor at this moment.
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

  const openTabs = trade.openTabs();
  const onFloor = sum(openTabs.map((t) => t.total));
  const guests = openTabs.reduce((n, t) => n + t.tab.guestCount, 0);
  const devices = identity.devices();
  const online = devices.filter((d) => d.online).length;

  return (
    <div className="flex flex-col gap-32">
      <PageHeader
        title="Overview"
        description={`Last night, ${formatWeekday(date)} ${formatIsoDate(date)}, at a glance, and what needs you now.`}
        actions={
          <>
            <ButtonLink href="/console/reports/sales" variant="secondary" icon={IconChartBar}>
              Sales report
            </ButtonLink>
            <ButtonLink href="/console/reports/performance" variant="secondary" icon={IconScale}>
              Performance
            </ButtonLink>
          </>
        }
      />

      {openTabs.length > 0 ? (
        <Callout
          tone="info"
          texture
          title="On the floor now"
          aside={<Money value={onFloor} size="num-lg" decimals="whole" />}
          action={
            <ButtonLink href="/console/trade/open" variant="secondary" icon={IconArrowRight} iconPosition="end">
              See open tabs
            </ButtonLink>
          }
        >
          {plural(openTabs.length, 'open tab')}, {plural(guests, 'guest')} seated, {online} of {plural(devices.length, 'station')} online.
        </Callout>
      ) : null}

      <HeadlineMetrics
        netSales={headline.netSales}
        cogs={headline.cogs}
        grossProfit={headline.grossProfit}
        delta={headline.salesDeltaBps === null ? null : { bps: headline.salesDeltaBps, against: headline.comparedWith }}
        marginBps={headline.grossMarginBps}
        seats={headline.seatsServed}
        tabs={headline.tabs}
        avgSeatsTenths={Math.round(headline.avgSeats * 10)}
        variance={headline.varianceAtCost}
        varianceLines={headline.varianceLines}
      />

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[3fr_2fr]">
        <Card aria-labelledby="overview-hours">
          <CardHeader band level="h2" titleId="overview-hours" icon={IconClock} title="Sales by hour" subtitle="Last night, by the hour each line was fired" />
          <SalesByHour data={hours.map((h) => ({ key: h.hour, label: h.hour.slice(0, 2), value: h.value }))} />
        </Card>

        <Card aria-labelledby="overview-attention">
          <CardHeader
            band
            level="h2"
            titleId="overview-attention"
            icon={IconAlertCircle}
            tone={attention.length > 0 ? 'low' : 'poured'}
            title="Needs attention"
            subtitle={attention.length > 0 ? 'Most urgent first' : 'Nothing is waiting on you'}
            meta={attention.length > 0 ? <ToneChip tone="low">{attention.length}</ToneChip> : null}
          />
          <AttentionBoard items={attention} />
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="overview-movers">
          <CardHeader
            band
            level="h2"
            titleId="overview-movers"
            icon={IconTrendingUp}
            title="Top movers"
            subtitle="Last night, by sales"
            actions={
              <ButtonLink href="/console/reports/sales" variant="ghost" size="sm">
                Sales report
              </ButtonLink>
            }
          />
          <TopMovers rows={movers} />
        </Card>

        <Card aria-labelledby="overview-variance">
          <CardHeader
            band
            level="h2"
            titleId="overview-variance"
            icon={IconPackage}
            tone={variance && variance.outside > 0 ? 'low' : undefined}
            title="Variance by product"
            subtitle={variance ? `Count committed ${formatDateTime(variance.count.committedAt ?? variance.count.openedAt, outlet.timezone)}` : 'No count has been committed yet'}
            actions={
              <ButtonLink href="/console/inventory/counts" variant="ghost" size="sm">
                Counts
              </ButtonLink>
            }
          />
          <VarianceByProduct rows={(variance?.rows ?? []).slice(0, 8)} />
        </Card>
      </div>
    </div>
  );
}
