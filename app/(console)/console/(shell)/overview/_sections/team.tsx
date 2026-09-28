import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { RingGauge } from '@bliss/ui/components/console/gauges';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconActivityHeartbeat, IconBrandWhatsapp, IconChevronRight, IconDatabase, IconDeviceTablet, IconUsersGroup } from '@tabler/icons-react';
import Link from 'next/link';
import { StaffAvatar } from '../../people/staff/avatar';
import type { OverviewData } from '../_data';
import { Panel, PanelEmpty } from './panel';

/** Who is working now: each person on shift, their role, how long they have been on and what they have taken. */
export function TeamPanel({ d }: { d: OverviewData }) {
  return (
    <Panel
      id="overview-team"
      icon={IconUsersGroup}
      tone={d.onShift > 0 ? 'accent' : 'neutral'}
      title={d.onShift > 0 ? 'On shift' : 'Who worked'}
      subtitle={d.onShift > 0 ? `${plural(d.onShift, 'person', 'people')} signed in now` : d.shifts.length > 0 ? `Nobody on now; ${plural(d.shifts.length, 'shift')} ${d.live ? 'tonight' : 'that night'}` : 'Nobody on now'}
      href="/console/trade/shifts"
      hrefLabel="Shifts"
    >
      {d.shifts.length === 0 ? (
        <PanelEmpty icon={IconUsersGroup} title="Nobody on shift" body="Staff appear here when they sign in on a station." />
      ) : (
        <ul className="flex flex-col py-8">
          {d.shifts.map((s) => {
            const until = s.endedAt ?? d.now;
            const long = s.endedAt === null && d.now - s.startedAt > 12 * 3_600_000;
            return (
              <li key={s.id}>
                <Link href={`/console/people/staff/${s.staffId}`} className="group flex items-center gap-12 px-20 py-8 transition-hover hover:bg-band">
                  <StaffAvatar name={s.name} avatarUrl={s.avatarUrl} colourIndex={s.colourIndex} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ui text-ink">{s.name}</span>
                    <span className="truncate text-micro text-ink-subtle">
                      {s.role} · {s.endedAt === null ? `since ${formatTime(s.startedAt, d.tz)}` : `${formatTime(s.startedAt, d.tz)} to ${formatTime(s.endedAt, d.tz)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className={cx('flex items-center gap-6 font-mono tabular text-num-sm', long ? 'text-low' : s.endedAt === null ? 'text-ink' : 'text-ink-muted')}>
                      {s.endedAt === null ? <Dot tone="poured" className="animate-breathe" /> : null}
                      {formatElapsed(until - s.startedAt)}
                    </span>
                    {s.sales > 0n ? <Money value={s.sales} size="num-sm" decimals="whole" tone="subtle" /> : <span className="text-micro text-ink-subtle">{plural(s.tabs, 'tab')}</span>}
                  </span>
                  <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-2" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The app's own health in a glance: the score, and the three things that most often go wrong. */
export function PulsePanel({ d }: { d: OverviewData }) {
  const h = d.health;
  const tone: Tone = h.status === 'fail' ? 'stop' : h.status === 'warn' ? 'low' : 'poured';
  const stations = h.stations.filter((s) => !s.personal);
  const online = stations.filter((s) => s.state === 'online').length;
  const unsent = stations.reduce((n, s) => n + s.unsynced, 0);
  const failed = h.alerts.funnel.failed;
  const rows: { icon: typeof IconDatabase; label: string; value: string; tone: Tone; href: string }[] = [
    { icon: IconDeviceTablet, label: 'Stations', value: `${online} of ${stations.length} online${unsent > 0 ? `, ${unsent} unsent` : ''}`, tone: stations.length > 0 && online === stations.length && unsent === 0 ? 'poured' : 'low', href: '/console/settings/health#health-stations' },
    { icon: IconBrandWhatsapp, label: 'WhatsApp alerts', value: !h.alerts.configured ? 'Not connected' : failed > 0 ? `${failed} failed` : 'Sending', tone: !h.alerts.configured ? 'neutral' : failed > 0 ? 'stop' : 'poured', href: '/console/settings/whatsapp' },
    { icon: IconDatabase, label: 'Checks', value: h.counts.fail + h.counts.warn > 0 ? `${h.counts.fail + h.counts.warn} to see to` : `All ${h.counts.ok} pass`, tone, href: '/console/settings/health' },
  ];
  return (
    <Panel id="overview-pulse" icon={IconActivityHeartbeat} tone={tone} title="System health" subtitle={h.status === 'fail' ? 'Something needs fixing' : h.status === 'warn' ? 'Running, a few things to look at' : 'Everything is healthy'} href="/console/settings/health" hrefLabel="Health">
      <div className="flex items-center gap-20 px-20 py-16">
        <RingGauge value={h.score / 100} tone={tone} size="md" label={`Health score ${h.score} of 100`}>
          <span className="font-mono tabular text-num-md text-ink">{h.score}</span>
        </RingGauge>
        <ul className="flex min-w-0 flex-1 flex-col gap-4">
          {rows.map((r) => {
            const Glyph = r.icon;
            return (
              <li key={r.label}>
                <Link href={r.href} className="group -mx-8 flex items-center gap-8 rounded-md px-8 py-4 transition-hover hover:bg-band">
                  <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{r.label}</span>
                  <span className="flex shrink-0 items-center gap-6 text-micro text-ink-muted">
                    <Dot tone={r.tone} />
                    {r.value}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
