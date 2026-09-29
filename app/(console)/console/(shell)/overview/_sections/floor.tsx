import { formatAgo, formatElapsed, plural } from '@bliss/shared/format';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconArmchair, IconChevronRight, IconDeviceDesktop, IconDeviceTablet, IconFlame, IconGlassFull, IconLayoutDashboard, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import type { OverviewData } from '../_data';
import { Figure, Panel, PanelEmpty } from './panel';

const KIND = { floor: IconDeviceTablet, counter: IconDeviceDesktop, bar: IconGlassFull, console: IconLayoutDashboard } as const;

/**
 * What is happening this moment: the open tabs with the biggest first, how long each has run and
 * whether it has orders waiting, and every station with whether it is reaching the server.
 */
export function LiveFloor({ d }: { d: OverviewData }) {
  const f = d.floor;
  const stations = d.health.stations.filter((s) => !s.personal);
  const online = stations.filter((s) => s.state === 'online').length;
  return (
    <Panel
      id="overview-floor"
      icon={IconArmchair}
      tone={f.tabs > 0 ? 'accent' : 'neutral'}
      title="On the floor now"
      subtitle={f.tabs > 0 ? `${plural(f.tabs, 'tab')} open, ${plural(f.guests, 'guest')} seated` : 'Nobody seated'}
      meta={f.tabs > 0 ? <span className="inline-flex items-center gap-6 rounded-pill bg-poured-wash px-8 py-2 text-micro text-poured"><Dot tone="poured" className="animate-breathe" />Live</span> : null}
      href="/console/trade/open"
      hrefLabel="All open tabs"
    >
      <dl className="grid grid-cols-3 gap-12 px-20 pt-16">
        <Figure label="On tabs">
          <Money value={f.value} size="num-md" decimals="whole" />
        </Figure>
        <Figure label="Guests">{f.guests}</Figure>
        <Figure label="To fire" tone={f.pending > 0 ? 'low' : undefined}>
          {f.pending}
        </Figure>
      </dl>

      {f.top.length > 0 ? (
        <ul className="mt-12 flex flex-col">
          {f.top.map((t) => {
            const long = d.now - t.openedAt > 5 * 3_600_000;
            return (
              <li key={t.id} className="border-t border-edge">
                <Link href={`/console/trade/tabs/${t.id}`} className="group flex items-center gap-12 px-20 py-12 transition-hover hover:bg-band">
                  <span className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-band font-mono text-num-sm text-ink">{t.label.match(/\d+/)?.[0] ?? t.label.slice(0, 1)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex items-center gap-8">
                      <span className="truncate text-ui text-ink">{t.label}</span>
                      {t.pending > 0 ? (
                        <span className="inline-flex items-center gap-4 rounded-pill bg-low-wash px-6 text-micro text-low">
                          <IconFlame size={12} stroke={2} aria-hidden="true" />
                          {t.pending} to fire
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-body-sm text-ink-muted">
                      {[t.zone, plural(t.guests, 'guest'), t.waiter].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <Money value={t.total} size="num-md" decimals="whole" currency={false} />
                    <span className={cx('font-mono tabular text-micro', long ? 'text-low' : 'text-ink-subtle')}>{formatElapsed(d.now - t.openedAt)}</span>
                  </span>
                  <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-2" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <PanelEmpty icon={IconArmchair} title="The floor is quiet" body="Tabs appear here the moment a waiter opens one, biggest first." />
      )}

      {stations.length > 0 ? (
        <div className="flex flex-col gap-8 border-t border-edge px-20 py-12">
          <p className="flex items-center justify-between label-caps text-ink-subtle">
            <span>Stations</span>
            <span className={online === stations.length ? 'text-poured' : 'text-low'}>
              {online} of {stations.length} online
            </span>
          </p>
          <ul className="flex flex-wrap gap-6">
            {stations.map((s) => {
              const Glyph = s.personal ? IconUser : KIND[s.kind];
              return (
                <li key={s.id}>
                  <Link
                    href={`/console/settings/devices/${s.id}`}
                    title={s.state === 'online' ? `${s.who ?? 'Nobody'} signed in` : s.lastSeenAt ? `Last seen ${formatAgo(d.now - s.lastSeenAt)}` : 'Never seen'}
                    className={cx('inline-flex items-center gap-6 rounded-pill px-8 py-4 text-micro transition-hover', s.state === 'online' ? 'bg-poured-wash text-poured hover:bg-band-strong' : 'bg-band text-ink-subtle hover:bg-band-strong')}
                  >
                    <Glyph size={14} stroke={ICON_STROKE} aria-hidden="true" />
                    {s.label}
                    {s.unsynced > 0 ? <span className="font-mono text-low">{s.unsynced}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
