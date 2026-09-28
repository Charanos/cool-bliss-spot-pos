import { formatAgo } from '@bliss/shared/format';
import { Card, CardHeader, IconTile } from '@bliss/ui/components/console/card';
import { Sparkline } from '@bliss/ui/components/console/sparkline';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconChevronRight, IconCircleCheck, IconDeviceDesktop, IconDeviceTablet, IconGlassFull, IconLayoutDashboard, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type * as health from '@/modules/health/service';

export const TONE: Record<health.HealthStatus, Tone> = { ok: 'poured', warn: 'low', fail: 'stop', info: 'info' };
export const WORD: Record<health.HealthStatus, string> = { ok: 'Healthy', warn: 'Look', fail: 'Problem', info: 'Note' };
const TEXT: Record<health.HealthStatus, string> = { ok: 'text-ink', warn: 'text-low', fail: 'text-stop', info: 'text-ink' };

/** One vital sign: its name, the figure now, its last hour as a line, and a note under it. */
export function VitalCard({ icon, label, value, unit, tone = 'neutral', values, note, sparkLabel }: { icon: TablerIcon; label: string; value: ReactNode; unit?: string; tone?: Tone; values?: readonly number[]; note: ReactNode; sparkLabel?: string }) {
  return (
    <Card as="article" aria-label={label} className="min-h-kpi-min">
      <div className="flex flex-1 flex-col gap-12 px-20 pb-16 pt-16">
        <span className="flex items-center gap-8">
          <IconTile icon={icon} tone={tone} />
          <span className="text-body-sm font-medium text-ink-muted">{label}</span>
        </span>
        <p className="flex items-baseline gap-4">
          <span className={cx('font-mono tabular text-num-kpi', tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : 'text-ink')}>{value}</span>
          {unit ? <span className="font-mono text-body-sm text-ink-subtle">{unit}</span> : null}
        </p>
        <div className="mt-auto flex flex-col gap-8">
          {values === undefined ? null : values.length > 1 ? <Sparkline values={values} variant="area" label={sparkLabel ?? label} /> : <span className="flex h-24 items-center text-micro text-ink-subtle">The line fills in as the minutes pass.</span>}
          <p className="text-body-sm text-ink-muted">{note}</p>
        </div>
      </div>
    </Card>
  );
}

/** A check as a row: its state, what it is, the figure, and the way to it. */
export function CheckRow({ check, system }: { check: health.HealthCheck; system?: string }) {
  const body = (
    <>
      <span className={cx('mt-4 flex size-20 shrink-0 items-center justify-center rounded-pill', check.status === 'fail' ? 'bg-stop-wash' : check.status === 'warn' ? 'bg-low-wash' : check.status === 'ok' ? 'bg-poured-wash' : 'bg-info-wash')}>
        <Dot tone={TONE[check.status]} className={check.status === 'fail' ? 'animate-breathe' : undefined} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-ui text-ink">{check.label}</span>
          {system ? <span className="label-caps text-ink-subtle">{system}</span> : null}
        </span>
        <span className="text-body-sm text-ink-muted">{check.detail}</span>
      </span>
      <span className={cx('max-w-[40%] shrink-0 truncate text-right font-mono tabular text-num-sm', TEXT[check.status])}>{check.value}</span>
      {check.href ? <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="mt-4 shrink-0 text-ink-subtle transition-hover group-hover:translate-x-2 group-hover:text-ink" /> : <span className="w-16 shrink-0" />}
    </>
  );
  return (
    <li className="border-t border-edge first:border-t-0">
      {check.href ? (
        <Link href={check.href} className="group flex items-start gap-12 px-20 py-12 transition-hover hover:bg-band">
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-12 px-20 py-12">{body}</div>
      )}
    </li>
  );
}

/**
 * A system's checks: anything wrong or worth a note as full rows, first; everything passing as a
 * compact grid under them, so what needs a person is never lost in what is fine.
 */
export function CheckList({ checks }: { checks: readonly health.HealthCheck[] }) {
  const rank = { fail: 0, warn: 1, info: 2, ok: 3 } as const;
  const open = checks.filter((c) => c.status !== 'ok').sort((a, b) => rank[a.status] - rank[b.status]);
  const passing = checks.filter((c) => c.status === 'ok');
  return (
    <div className="flex flex-col border-t border-edge">
      {open.length > 0 ? (
        <ul className="flex flex-col">
          {open.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      ) : null}
      {passing.length > 0 ? (
        <div className={cx('flex flex-col gap-8 px-20 py-16', open.length > 0 && 'border-t border-edge')}>
          <p className="flex items-center gap-8 label-caps text-poured">
            <IconCircleCheck size={14} stroke={ICON_STROKE} aria-hidden="true" />
            {passing.length === checks.length ? 'All passing' : `${passing.length} passing`}
          </p>
          <ul className="grid grid-cols-1 gap-x-16 compact:grid-cols-2">
            {passing.map((c) => {
              const inner = (
                <>
                  <IconCheck size={14} stroke={2} aria-hidden="true" className="shrink-0 text-poured" />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{c.label}</span>
                  <span className="max-w-[45%] shrink-0 truncate font-mono tabular text-micro text-ink-subtle">{c.value}</span>
                </>
              );
              return (
                <li key={c.id} title={c.detail}>
                  {c.href ? (
                    <Link href={c.href} className="-mx-8 flex items-center gap-8 rounded-md px-8 py-6 transition-hover hover:bg-band">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-8 py-6">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const KIND: Record<health.StationTile['kind'], TablerIcon> = { floor: IconDeviceTablet, counter: IconDeviceDesktop, bar: IconGlassFull, console: IconLayoutDashboard };
const STATE: Record<health.StationTile['state'], { word: string; tone: Tone }> = {
  online: { word: 'Online', tone: 'poured' },
  offline: { word: 'Offline', tone: 'neutral' },
  pairing: { word: 'Waiting to pair', tone: 'low' },
  never: { word: 'Never seen', tone: 'neutral' },
};

/** A station as a tile: what it is, whether it is reaching the server, who is on it, what it holds. */
export function StationTileView({ s }: { s: health.StationTile }) {
  const Glyph = s.personal ? IconUser : KIND[s.kind];
  const state = STATE[s.state];
  const warn = s.unsynced > 0 || s.behind || s.state === 'pairing';
  return (
    <li>
      <Link href={`/console/settings/devices/${s.id}`} className="group flex h-full flex-col gap-12 rounded-control bg-band px-16 py-12 transition-hover hover:bg-band-strong">
        <span className="flex items-center gap-12">
          <span className={cx('relative flex size-control-md shrink-0 items-center justify-center rounded-md', s.state === 'online' ? 'bg-poured-wash text-poured' : 'bg-neutral-wash text-ink-subtle')}>
            <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" />
            {s.state === 'online' ? <span aria-hidden="true" className="absolute -right-2 -top-2 size-8 animate-breathe rounded-pill bg-poured" /> : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-ui text-ink">{s.label}</span>
            <span className="flex items-center gap-6 text-micro text-ink-muted">
              <Dot tone={state.tone} />
              {state.word}
              {s.state === 'offline' && s.lastSeenAt ? <span className="text-ink-subtle">· {formatAgo(Date.now() - s.lastSeenAt)}</span> : null}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-12 gap-y-4 text-micro">
          <span className="text-ink-muted">{s.who ?? 'Nobody signed in'}</span>
          <span className={cx('ml-auto font-mono tabular', s.unsynced > 0 ? 'text-low' : 'text-ink-subtle')}>{s.unsynced > 0 ? `${s.unsynced} to send` : 'All sent'}</span>
        </span>
        {warn && s.behind ? <span className="text-micro text-low">Running {s.version}: reload for the latest.</span> : null}
      </Link>
    </li>
  );
}

/** A small figure with its label, for a card's strip of counts. */
export function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'low' | 'stop' }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="label-caps text-ink-subtle">{label}</dt>
      <dd className={cx('font-mono tabular text-num-md', tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : 'text-ink')}>{value}</dd>
    </div>
  );
}

/** A system's card: the header with its state, what it shows at a glance, then every check. */
export function SystemCard({ id, icon, title, summary, status, children, checks, className }: { id: string; icon: TablerIcon; title: string; summary: string; status: health.HealthStatus; children?: ReactNode; checks: readonly health.HealthCheck[]; className?: string }) {
  const tone = TONE[status];
  return (
    <Card aria-labelledby={`${id}-title`} tone={status === 'fail' ? 'stop' : status === 'warn' ? 'low' : undefined} className={cx('scroll-mt-96', className)}>
      <span id={id} className="sr-only" />
      <CardHeader
        band
        level="h2"
        titleId={`${id}-title`}
        icon={icon}
        tone={status === 'ok' ? 'poured' : tone}
        title={title}
        subtitle={summary}
        actions={
          <span className={cx('inline-flex items-center gap-6 rounded-pill px-8 py-2 text-micro', status === 'fail' ? 'bg-stop-wash text-stop' : status === 'warn' ? 'bg-low-wash text-low' : 'bg-poured-wash text-poured')}>
            <Dot tone={tone} />
            {WORD[status]}
          </span>
        }
      />
      {children ? <div className="flex flex-col gap-20 px-20 py-20">{children}</div> : null}
      <CheckList checks={checks} />
    </Card>
  );
}
