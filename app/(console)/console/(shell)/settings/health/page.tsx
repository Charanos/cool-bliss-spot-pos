import { formatAgo, formatTime } from '@bliss/shared/format';
import { BarChart } from '@bliss/ui/components/console/bar-chart';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Funnel, RingGauge, SegmentBar } from '@bliss/ui/components/console/gauges';
import { StackedColumns } from '@bliss/ui/components/console/stacked-columns';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconActivityHeartbeat,
  IconBrandWhatsapp,
  IconClockHour4,
  IconCpu,
  IconDatabase,
  IconDeviceTablet,
  IconGauge,
  IconPackage,
  IconReceipt2,
  IconSettingsCheck,
  IconShieldCheck,
  IconUrgent,
} from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as health from '@/modules/health/service';
import * as identity from '@/modules/identity/service';
import { ViewHeader } from '../../_components/workspace';
import { CheckRow, MiniStat, StationTileView, SystemCard, TONE, VitalCard, WORD } from './_parts';

export const metadata: Metadata = { title: 'Health' };
export const dynamic = 'force-dynamic';

const ICON: Record<health.HealthSystem['key'], TablerIcon> = {
  server: IconDatabase,
  stations: IconDeviceTablet,
  trade: IconReceipt2,
  stock: IconPackage,
  alerts: IconBrandWhatsapp,
  setup: IconSettingsCheck,
};

const SHORT: Record<health.HealthSystem['key'], string> = { server: 'Server', stations: 'Stations', trade: 'Trade', stock: 'Stock', alerts: 'Alerts', setup: 'Set-up' };

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * The app's vital signs, docs/21. A score and one verdict; the server's pulse over the last hour;
 * what needs a person, most pressing first; then each system with what it shows at a glance and
 * every check behind it. It reads live and refreshes itself with the rest of the Console, so it can
 * be left open on a screen in the office.
 */
export default async function HealthPage() {
  const r = await health.report();
  const tz = identity.outlet().timezone;
  const system = (key: health.HealthSystem['key']) => r.systems.find((s) => s.key === key)!;
  const statusOf = (key: health.HealthSystem['key']) => health.worstOf(system(key).checks);
  const scoreTone = r.status === 'fail' ? 'stop' : r.status === 'warn' ? 'low' : 'poured';
  const verdict =
    r.status === 'fail'
      ? { title: `${r.counts.fail} ${r.counts.fail === 1 ? 'thing needs' : 'things need'} fixing`, body: r.counts.warn > 0 ? `And ${r.counts.warn} to look at. The most pressing is first in the list below.` : 'Each is in the list below, with where to go.' }
      : r.status === 'warn'
        ? { title: `Running well, ${r.counts.warn} to look at`, body: 'Nothing is broken. Seeing to these keeps the night clean.' }
        : { title: 'Everything is healthy', body: `All ${r.counts.ok} checks pass across the server, the stations, trade, stock and alerts.` };

  const v = r.vitals;
  const db = v.samples.map((s) => s.dbMs).filter((n): n is number => n !== null);
  const heap = v.samples.map((s) => s.heapMb);
  const loop = v.samples.map((s) => s.loopMs);
  const minutes = Math.max(1, Math.round((r.at - v.since) / 60_000));
  const over = v.samples.length > 1 ? `over the last ${minutes < 60 ? `${minutes} min` : 'hour'}` : 'since this page opened';
  const peak = r.trade.hours.reduce<(typeof r.trade.hours)[number] | null>((best, h) => (h.value > (best?.value ?? 0n) ? h : best), null);
  const online = r.stations.filter((s) => s.state === 'online').length;
  const f = r.alerts.funnel;
  const upMin = Math.floor(v.uptimeMs / 60_000);
  const up = upMin < 60 ? { value: String(upMin), unit: 'min' } : upMin < 1440 ? { value: `${Math.floor(upMin / 60)}h${String(upMin % 60).padStart(2, '0')}`, unit: undefined } : { value: String(Math.floor(upMin / 1440)), unit: `days ${Math.floor((upMin % 1440) / 60)}h` };

  return (
    <>
      <ViewHeader page="/console/settings/health" />
      <div className="flex flex-col gap-32">
        {/* ── The verdict ─────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="health-verdict"
          className={cx(
            'grid grid-cols-1 items-center gap-24 rounded-card px-24 py-24 desktop:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)] desktop:gap-32 desktop:px-32',
            r.status === 'fail' ? 'bg-stop-wash texture-dots-stop' : r.status === 'warn' ? 'bg-low-wash texture-dots-stop' : 'bg-poured-wash texture-dots-accent',
          )}
        >
          <RingGauge value={r.score / 100} tone={scoreTone} size="lg" label={`Health score ${r.score} of 100`} className="mx-auto desktop:mx-0">
            <span className="font-mono tabular text-num-kpi text-ink">{r.score}</span>
            <span className="label-caps text-ink-subtle">of 100</span>
          </RingGauge>

          <div className="flex min-w-0 flex-col gap-12 text-center desktop:text-left">
            <span className={cx('inline-flex items-center gap-8 self-center label-caps desktop:self-start', r.status === 'fail' ? 'text-stop' : r.status === 'warn' ? 'text-low' : 'text-poured')}>
              <IconActivityHeartbeat size={16} stroke={ICON_STROKE} aria-hidden="true" className={r.status === 'ok' ? 'animate-breathe' : undefined} />
              Health score
            </span>
            <h2 id="health-verdict" className="text-title-page text-ink">
              {verdict.title}
            </h2>
            <p className="text-ui text-ink-muted">{verdict.body}</p>
            <dl className="mt-4 flex flex-wrap justify-center gap-x-24 gap-y-8 desktop:justify-start">
              {(['ok', 'warn', 'fail'] as const).map((k) => (
                <div key={k} className="flex items-center gap-8">
                  <Dot tone={TONE[k]} />
                  <dt className="text-body-sm text-ink-muted">{k === 'ok' ? 'Passing' : k === 'warn' ? 'To look at' : 'Problems'}</dt>
                  <dd className={cx('font-mono tabular text-num-sm', k === 'fail' && r.counts.fail > 0 ? 'text-stop' : k === 'warn' && r.counts.warn > 0 ? 'text-low' : 'text-ink')}>{r.counts[k]}</dd>
                </div>
              ))}
            </dl>
            <p className="text-micro text-ink-subtle">Checked at {formatTime(r.at, tz)}. Checks again by itself as things change.</p>
          </div>

          <nav aria-label="Systems" className="flex flex-col gap-4 rounded-control bg-card/70 px-8 py-8 shadow-chip">
            {r.systems.map((s) => {
              const st = health.worstOf(s.checks);
              const Glyph = ICON[s.key];
              return (
                <a key={s.key} href={`#health-${s.key}`} className="group flex items-center gap-12 rounded-md px-8 py-6 transition-hover hover:bg-band">
                  <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle group-hover:text-ink" />
                  <span className="flex-1 text-body-sm text-ink">{SHORT[s.key]}</span>
                  <span className={cx('flex items-center gap-6 text-micro', st === 'fail' ? 'text-stop' : st === 'warn' ? 'text-low' : 'text-poured')}>
                    <Dot tone={TONE[st]} className={st === 'fail' ? 'animate-breathe' : undefined} />
                    {WORD[st]}
                  </span>
                </a>
              );
            })}
          </nav>
        </section>

        {/* ── The server's pulse ──────────────────────────────────────────────── */}
        <section aria-label="Vital signs" className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
          <VitalCard
            icon={IconDatabase}
            label="Database answers in"
            value={v.latest.dbMs ?? (v.latest.dbOk ? '–' : 'No answer')}
            unit={v.latest.dbMs !== null ? 'ms' : undefined}
            tone={!v.latest.dbOk ? 'stop' : (v.latest.dbMs ?? 0) > 800 ? 'low' : 'poured'}
            values={db}
            sparkLabel={`Database answer time ${over}`}
            note={db.length > 0 ? `Typically ${median(db)} ms ${over}.` : 'No database is set on this server.'}
          />
          <VitalCard icon={IconCpu} label="Memory in use" value={v.latest.heapMb} unit="MB" tone={v.latest.heapMb > 900 ? 'low' : 'accent'} values={heap} sparkLabel={`Memory ${over}`} note={`${v.latest.rssMb} MB held by the process in all.`} />
          <VitalCard
            icon={IconGauge}
            label="Waiting for the server"
            value={v.latest.loopMs}
            unit="ms"
            tone={v.latest.loopMs > 200 ? 'low' : 'accent'}
            values={loop}
            sparkLabel={`Event loop delay ${over}`}
            note={v.latest.loopMs > 200 ? 'The server is busy: pages may feel slow.' : 'Under 50 ms feels instant.'}
          />
          <VitalCard icon={IconClockHour4} label="Server up for" value={up.value} unit={up.unit} tone="neutral" note={`Node ${v.node.replace(/^v/, '')}, build ${v.build}. The lines start again after a restart.`} />
        </section>

        {/* ── What needs a person ─────────────────────────────────────────────── */}
        <Card aria-labelledby="health-attention">
          <CardHeader
            band
            level="h2"
            titleId="health-attention"
            icon={r.attention.length > 0 ? IconUrgent : IconShieldCheck}
            tone={r.counts.fail > 0 ? 'stop' : r.attention.length > 0 ? 'low' : 'poured'}
            title="Needs you"
            subtitle={r.attention.length > 0 ? 'Problems first, then things to look at. Each opens where to fix it.' : 'Nothing is waiting on anyone.'}
            meta={r.attention.length > 0 ? <span className="rounded-pill bg-band-strong px-8 font-mono tabular text-micro text-ink">{r.attention.length}</span> : null}
          />
          {r.attention.length > 0 ? (
            <ul className="flex flex-col">
              {r.attention.map((c) => (
                <CheckRow key={`${c.system}-${c.id}`} check={c} system={SHORT[c.system]} />
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-16 px-20 py-24">
              <span className="flex size-control-lg items-center justify-center rounded-pill bg-poured-wash text-poured">
                <IconShieldCheck size={24} stroke={ICON_STROKE} aria-hidden="true" />
              </span>
              <p className="text-ui text-ink-muted">Every check passes. This list fills the moment something slips.</p>
            </div>
          )}
        </Card>

        {/* ── System by system ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
          <div className="flex flex-col gap-24">
            <SystemCard id="health-stations" icon={IconDeviceTablet} title="Stations and sync" summary={`${online} of ${r.stations.length} online. ${system('stations').summary}`} status={statusOf('stations')} checks={system('stations').checks.filter((c) => !c.id.startsWith('device-'))}>
              {r.stations.length > 0 ? (
                <ul className="grid grid-cols-1 gap-8 compact:grid-cols-2">
                  {r.stations.map((s) => (
                    <StationTileView key={s.id} s={s} />
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-muted">No station is registered yet.</p>
              )}
            </SystemCard>

            <SystemCard id="health-stock" icon={IconPackage} title="Stock and menu" summary={system('stock').summary} status={statusOf('stock')} checks={system('stock').checks}>
              <div className="flex flex-col gap-8">
                <p className="flex items-baseline justify-between gap-12">
                  <span className="text-body-sm font-medium text-ink">Items kept in stock</span>
                  <span className="font-mono tabular text-num-md text-ink">{r.stock.tracked}</span>
                </p>
                <SegmentBar segments={r.stock.segments} label="Items kept in stock, by state" />
              </div>
              <ul className="grid grid-cols-2 gap-12 tablet:grid-cols-4">
                {r.stock.coverage.map((c) => {
                  const share = c.total > 0 ? c.done / c.total : 1;
                  return (
                    <li key={c.key} className="flex flex-col items-center gap-8 text-center">
                      <RingGauge value={share} size="md" tone={share >= 1 ? 'poured' : share >= 0.75 ? 'accent' : 'low'} label={`${c.label}: ${c.done} of ${c.total}`}>
                        <span className="font-mono tabular text-num-sm text-ink">
                          {Math.floor(share * 100)}
                          <span className="text-micro text-ink-subtle">%</span>
                        </span>
                      </RingGauge>
                      <span className="flex flex-col">
                        <span className="text-body-sm text-ink">{c.label}</span>
                        <span className="font-mono tabular text-micro text-ink-subtle">
                          {c.done} of {c.total}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SystemCard>

            <SystemCard id="health-setup" icon={IconSettingsCheck} title="Set-up" summary={system('setup').summary} status={statusOf('setup')} checks={system('setup').checks}>
              <div className="flex items-center gap-16">
                <RingGauge value={r.setup.total > 0 ? r.setup.done / r.setup.total : 1} size="sm" tone={r.setup.done === r.setup.total ? 'poured' : 'low'} label={`Set-up: ${r.setup.done} of ${r.setup.total} in place`}>
                  <span className="font-mono tabular text-micro text-ink">
                    {r.setup.done}/{r.setup.total}
                  </span>
                </RingGauge>
                <p className="text-body-sm text-ink-muted">{r.setup.done === r.setup.total ? 'Everything the outlet needs is in place.' : `${r.setup.total - r.setup.done} left to put in place before the handover is complete.`}</p>
              </div>
            </SystemCard>
          </div>

          <div className="flex flex-col gap-24">
            <SystemCard id="health-trade" icon={IconReceipt2} title="Trade tonight" summary={system('trade').summary} status={statusOf('trade')} checks={system('trade').checks}>
              <dl className="grid grid-cols-2 gap-16 tablet:grid-cols-4">
                <MiniStat label="Open tabs" value={r.trade.openTabs} />
                <MiniStat label="Bills" value={r.trade.bills} />
                <MiniStat label="Drawers" value={r.trade.drawers} />
                <MiniStat label="On shift" value={r.trade.shifts} />
              </dl>
              {peak ? (
                <div className="flex flex-col gap-8">
                  <p className="flex items-baseline justify-between gap-12 text-body-sm">
                    <span className="font-medium text-ink">Takings by hour</span>
                    <span className="text-ink-subtle">{r.trade.lastBillAt ? `Last bill ${formatAgo(r.at - r.trade.lastBillAt)}` : 'Orders fired so far'}</span>
                  </p>
                  <BarChart data={r.trade.hours} height={140} highlightKey={peak.key} caption="Takings by hour tonight" />
                </div>
              ) : (
                <p className="rounded-control bg-band px-16 py-12 text-body-sm text-ink-muted">No orders fired yet today. The hours fill in as the night goes.</p>
              )}
            </SystemCard>

            <SystemCard id="health-alerts" icon={IconBrandWhatsapp} title="WhatsApp alerts" summary={system('alerts').summary} status={statusOf('alerts')} checks={system('alerts').checks}>
              {f.created > 0 ? (
                <>
                  <StackedColumns
                    caption="Alerts over the last seven days, by how far they got"
                    series={[
                      { key: 'reached', label: 'Delivered', tone: 'poured' },
                      { key: 'sent', label: 'Sent', tone: 'accent' },
                      { key: 'waiting', label: 'Waiting', tone: 'info' },
                      { key: 'failed', label: 'Failed', tone: 'stop' },
                    ]}
                    data={r.alerts.days.map((d) => ({ key: d.key, label: d.label, values: { reached: d.reached, sent: d.sent, waiting: d.waiting, failed: d.failed } }))}
                    height={120}
                  />
                  <Funnel
                    stages={[
                      { key: 'made', label: 'Made', value: f.created, tone: 'neutral' },
                      { key: 'sent', label: 'Sent', value: f.sent, tone: 'accent' },
                      { key: 'delivered', label: 'Delivered', value: f.delivered, tone: 'poured' },
                      { key: 'read', label: 'Read', value: f.read, tone: 'poured' },
                    ]}
                  />
                </>
              ) : (
                <p className="rounded-control bg-band px-16 py-12 text-body-sm text-ink-muted">{r.alerts.configured ? 'No alerts in the last seven days.' : 'Nothing sent yet: connect the business number in Settings, WhatsApp.'}</p>
              )}
            </SystemCard>

            <SystemCard id="health-server" icon={IconDatabase} title="Server and database" summary={system('server').summary} status={statusOf('server')} checks={system('server').checks.filter((c) => c.id !== 'uptime' && c.id !== 'memory')} />
          </div>
        </div>
      </div>
    </>
  );
}
