import { formatTime } from '@bliss/shared/format';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot, type Tone, ToneChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconActivityHeartbeat, IconBrandWhatsapp, IconChevronRight, IconDatabase, IconDeviceTablet, IconPackage, IconReceipt2, IconSettingsCheck } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as health from '@/modules/health/service';
import * as identity from '@/modules/identity/service';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Health' };
export const dynamic = 'force-dynamic';

const TONE: Record<health.HealthStatus, Tone> = { ok: 'poured', warn: 'low', fail: 'stop', info: 'info' };
const WORD: Record<health.HealthStatus, string> = { ok: 'Healthy', warn: 'Look', fail: 'Problem', info: 'Note' };
const ICON: Record<health.HealthSystem['key'], TablerIcon> = {
  server: IconDatabase,
  stations: IconDeviceTablet,
  trade: IconReceipt2,
  stock: IconPackage,
  alerts: IconBrandWhatsapp,
  setup: IconSettingsCheck,
};

/**
 * The app's vital signs, docs/21: one verdict, a tile per system, and every check with the figure
 * behind it and where to go about it. It reads live and refreshes itself with the rest of the
 * Console, so it can be left open on a screen in the office.
 */
export default async function HealthPage() {
  const r = await health.report();
  const tz = identity.outlet().timezone;
  const verdict =
    r.status === 'fail'
      ? { title: `${r.counts.fail} ${r.counts.fail === 1 ? 'thing needs' : 'things need'} fixing`, body: r.counts.warn > 0 ? `and ${r.counts.warn} to look at. Each is below, with where to go.` : 'Each is below, with where to go.' }
      : r.status === 'warn'
        ? { title: `Running, with ${r.counts.warn} to look at`, body: 'Nothing is broken. The notes below keep the night clean.' }
        : { title: 'Everything is healthy', body: `${r.counts.ok} checks passed across the server, the stations, trade, stock and alerts.` };

  return (
    <>
      <ViewHeader page="/console/settings/health" />
      <div className="flex flex-col gap-32">
        {/* The verdict: one line anyone can read from across the room. */}
        <section aria-label="Overall" className={cx('flex flex-wrap items-center gap-x-32 gap-y-16 rounded-card px-24 py-24', r.status === 'fail' ? 'bg-stop-wash texture-dots-stop' : r.status === 'warn' ? 'bg-low-wash texture-dots-stop' : 'bg-poured-wash texture-dots-accent')}>
          <span aria-hidden="true" className={cx('relative flex size-[72px] shrink-0 items-center justify-center rounded-pill bg-card shadow-chip', r.status === 'fail' ? 'text-stop' : r.status === 'warn' ? 'text-low' : 'text-poured')}>
            <span className={cx('absolute inset-[6px] rounded-pill border-2 border-current opacity-30', r.status === 'ok' && 'animate-breathe')} />
            <IconActivityHeartbeat size={32} stroke={ICON_STROKE} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="text-title-page text-ink">{verdict.title}</h2>
            <p className="text-ui text-ink-muted">{verdict.body}</p>
          </div>
          <dl className="flex shrink-0 gap-24">
            {(['ok', 'warn', 'fail'] as const).map((k) => (
              <div key={k} className="flex flex-col items-end gap-2">
                <dt className="label-caps text-ink-subtle">{k === 'ok' ? 'Passing' : k === 'warn' ? 'To look at' : 'Problems'}</dt>
                <dd className={cx('font-mono tabular text-num-kpi', k === 'fail' && r.counts.fail > 0 ? 'text-stop' : k === 'warn' && r.counts.warn > 0 ? 'text-low' : 'text-ink')}>{r.counts[k]}</dd>
              </div>
            ))}
          </dl>
          <p className="basis-full text-body-sm text-ink-subtle">Checked at {formatTime(r.at, tz)}. This page checks again by itself as things change.</p>
        </section>

        {/* A tile per system: its state at a glance, and a jump to its checks. */}
        <nav aria-label="Systems" className="grid grid-cols-2 gap-12 tablet:grid-cols-3 desktop:grid-cols-6">
          {r.systems.map((s) => {
            const status = health.worstOf(s.checks);
            const Glyph = ICON[s.key];
            return (
              <a key={s.key} href={`#health-${s.key}`} className="card-surface card-interactive flex flex-col gap-12 rounded-card px-16 py-16">
                <span className="flex items-center justify-between">
                  <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-subtle" />
                  <Dot tone={TONE[status]} className={status === 'fail' ? 'animate-breathe' : undefined} />
                </span>
                <span className="flex flex-col gap-2">
                  <span className="text-ui text-ink">{s.title}</span>
                  <span className={cx('text-body-sm', status === 'fail' ? 'text-stop' : status === 'warn' ? 'text-low' : 'text-ink-muted')}>{s.summary}</span>
                </span>
              </a>
            );
          })}
        </nav>

        {/* Every check, system by system. */}
        <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
          {r.systems.map((s) => {
            const status = health.worstOf(s.checks);
            return (
              <Card key={s.key} aria-labelledby={`health-${s.key}-title`} tone={status === 'fail' ? 'stop' : status === 'warn' ? 'low' : undefined}>
                <span id={`health-${s.key}`} className="sr-only" />
                <CardHeader band level="h2" titleId={`health-${s.key}-title`} icon={ICON[s.key]} title={s.title} subtitle={s.summary} meta={<ToneChip tone={TONE[status]}>{WORD[status]}</ToneChip>} />
                <ul className="flex flex-col">
                  {s.checks.map((c) => {
                    const row = (
                      <>
                        <Dot tone={TONE[c.status]} className="mt-8" />
                        <span className="flex min-w-0 flex-1 flex-col gap-2">
                          <span className="text-ui text-ink">{c.label}</span>
                          <span className="text-body-sm text-ink-muted">{c.detail}</span>
                        </span>
                        <span className={cx('shrink-0 text-right font-mono tabular text-num-sm', c.status === 'fail' ? 'text-stop' : c.status === 'warn' ? 'text-low' : 'text-ink')}>{c.value}</span>
                        {c.href ? <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="mt-2 shrink-0 text-ink-subtle" /> : <span className="w-[16px] shrink-0" />}
                      </>
                    );
                    return (
                      <li key={c.id} className="border-t border-edge first:border-t-0">
                        {c.href ? (
                          <Link href={c.href} className="flex items-start gap-12 px-20 py-12 transition-hover hover:bg-band">
                            {row}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-12 px-20 py-12">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
