import { formatDateTime, formatIsoDate, formatWeekday } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { PageHeader } from '@bliss/ui/components/console/shell';
import { ConsoleBentoCard } from '@bliss/ui/components/console/metric';
import { ButtonLink } from '@bliss/ui/components/button-link';
import {
  IconAlertCircle,
  IconBuildingStore,
  IconChartBar,
  IconClock,
  IconPackage,
  IconReceipt2,
} from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import {
  AttentionBoard,
  FloorPulseStrip,
  HeadlineMetrics,
  SalesByHour,
  TopMovers,
  VarianceByProduct,
} from './_parts';

export const metadata: Metadata = { title: 'Overview' };

const icon = (Glyph: typeof IconClock) => <Glyph size={18} stroke={1.5} />;

/**
 * The executive operational command dashboard opened at 09:00 or mid-service.
 * Polished to match the fidelity, elegance, and depth of the Floor and Counter surfaces:
 * - Executive command masthead with session telemetry and quick station shortcuts
 * - Ambient Bento metric grid answering revenue, margin, volume, and shrinkage in one glance
 * - Sales velocity rhythm by hour with peak trade callout
 * - Operations action center with prioritized severity indicators and one-click actions
 * - Live floor exposure and device fleet pulse
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

  // Real-time floor telemetry
  const openTabs = trade.openTabs();
  const openExposure = sum(openTabs.map((t) => t.total));
  const openGuests = openTabs.reduce((n, t) => n + t.tab.guestCount, 0);
  const devices = identity.devices();
  const onlineDevices = devices.filter((d) => d.online).length;

  return (
    <div className="flex flex-col gap-24">
      {/* ── Executive Command Header ────────────────────────────────── */}
      <PageHeader
        eyebrow="OPERATIONAL INTELLIGENCE · VENUE OVERVIEW"
        title="Executive Overview"
        badge={null}
        description={`Reporting for ${formatWeekday(date)}, ${formatIsoDate(date)} (closing session) · ${headline.tabs} tabs closed · ${headline.seatsServed} guests served.`}
        actions={
          <>
            <ButtonLink
              href="/console/trade/open"
              variant="secondary"
              size="md"
              icon={IconReceipt2}
            >
              <span>{openTabs.length} open {openTabs.length === 1 ? 'tab' : 'tabs'}</span>
            </ButtonLink>
            <ButtonLink
              href="/console/reports/sales"
              variant="secondary"
              size="md"
              icon={IconChartBar}
            >
              <span>Sales analytics</span>
            </ButtonLink>
          </>
        }
      />

      {/* ── Top Bento Row: Executive Financials & Exposure ───────────── */}
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

      {/* ── Floor Active Pulse: Real-time Floor Exposure & Seating ───── */}
      {openTabs.length > 0 ? (
        <FloorPulseStrip
          openTabsCount={openTabs.length}
          openExposure={openExposure}
          seatedGuests={openGuests}
          devicesOnline={onlineDevices}
          totalDevices={devices.length}
        />
      ) : null}

      {/* ── Visual Separator: Transition to Analytics ──────────────────── */}
      <div className="my-40 tablet:my-48 flex items-center justify-center relative">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-hairline/60 to-transparent" />
        <span className="relative z-10 bg-page px-16">
          <span className="flex items-center gap-8 rounded-full border border-hairline/40 bg-control/40 px-12 py-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-md">
            <span className="size-[4px] rounded-full bg-ink-subtle/50" />
            <span className="text-micro font-medium uppercase tracking-[0.08em] text-ink-subtle">Performance & Exceptions</span>
            <span className="size-[4px] rounded-full bg-ink-subtle/50" />
          </span>
        </span>
      </div>

      {/* ── Middle Bento Row: Sales by Hour & Action Center (3:2) ────── */}
      <div className="grid grid-cols-1 gap-20 desktop:grid-cols-[3fr_2fr]">
        <ConsoleBentoCard
          icon={icon(IconClock)}
          title="Sales by hour"
          subtitle="Fired line volume by hour of evening"
          tone="default"
        >
          <SalesByHour data={hours.map((h) => ({ key: h.hour, label: h.hour.slice(0, 2), value: h.value }))} />
        </ConsoleBentoCard>

        <ConsoleBentoCard
          icon={icon(IconAlertCircle)}
          title="Needs attention"
          subtitle="Exceptions requiring operational clearance"
          tone={attention.length > 0 ? 'attention' : 'poured'}
          badge={
            attention.length > 0 ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest tabular-nums rounded-full px-8 py-[2px] bg-control/60 text-ink shadow-sm ring-1 ring-hairline/40">
                {attention.length} {attention.length === 1 ? 'Alert' : 'Alerts'}
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-widest tabular-nums rounded-full px-8 py-[2px] bg-transparent text-ink-subtle ring-1 ring-hairline/40">
                Clean
              </span>
            )
          }
        >
          <AttentionBoard items={attention} />
        </ConsoleBentoCard>
      </div>

      {/* ── Lower Bento Row: Velocity Leaders & Inventory Shrinkage ──── */}
      <div className="grid grid-cols-1 gap-20 desktop:grid-cols-2 pt-24 tablet:pt-32">
        <ConsoleBentoCard
          icon={icon(IconBuildingStore)}
          title="Top movers last night"
          subtitle="Best performing products by revenue and volume"
          tone="default"
          action={
            <Link href="/console/reports/sales" className="text-body-sm text-ink-subtle hover:text-ink transition-colors">
              Sales report
            </Link>
          }
        >
          <TopMovers rows={movers} />
        </ConsoleBentoCard>

        <ConsoleBentoCard
          icon={icon(IconPackage)}
          title="Variance by product"
          subtitle={
            variance
              ? `Count committed ${formatDateTime(variance.count.committedAt ?? variance.count.openedAt, outlet.timezone)}`
              : 'No committed count yet'
          }
          tone={variance && variance.outside > 0 ? 'attention' : 'default'}
          action={
            <Link href="/console/inventory/counts" className="text-body-sm text-ink-subtle hover:text-ink transition-colors">
              Audit counts
            </Link>
          }
        >
          <VarianceByProduct rows={(variance?.rows ?? []).slice(0, 8)} />
        </ConsoleBentoCard>
      </div>
    </div>
  );
}
