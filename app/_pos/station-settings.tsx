'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { Switch } from '@bliss/ui/components/fields';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconAdjustmentsHorizontal, IconCloudUpload, IconLogout, IconRefresh, IconUserCircle } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { META, getMeta, setMeta } from '@/lib/pos/db';
import { haptic, refreshHaptics } from '@/lib/pos/haptics';
import { useOutlet } from '@/lib/pos/queries';
import { signOut, useDevice, useSession } from '@/lib/pos/session';
import { syncNow, useSync } from '@/lib/pos/sync';
import { canKeepAwake } from '@/lib/pos/wake';
import { PageHeader } from './chrome';
import { DeviceCard } from './device-card';

/**
 * A settings panel on a station: an icon tile, a title and one line about it, then its controls. The
 * same frosted card as every station surface; what sits inside it is solid, never a second glass.
 */
export function Panel({ title, id, icon: Glyph, lede, children, className }: { title: string; id: string; icon?: TablerIcon; lede?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cx('flex flex-col gap-20 rounded-sheet border border-rule-raised/40 p-20 surface-card tablet:p-24', className)}>
      <header className="flex items-start gap-12">
        {Glyph ? (
          <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-accent-wash text-accent-text">
            <Glyph size={20} stroke={ICON_STROKE} />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id={id} className="text-title font-medium text-ink">
            {title}
          </h2>
          {lede ? <p className="text-body-sm text-ink-muted">{lede}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/** A figure in a panel: a label over a value, on a solid well. */
function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: 'stop' }) {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-sunken/80 px-16 py-12">
      <dt className="text-label text-ink-subtle">{label}</dt>
      <dd className={cx('text-body font-medium', tone === 'stop' ? 'text-stop' : 'text-ink')}>{children}</dd>
    </div>
  );
}

/**
 * A station's own settings, the same on the Floor and the Counter, laid out like every other station
 * page: the header with its facts and Sync now, then panels two across from a tablet up. This device,
 * who is signed in, whether everything has reached the server, and the device's habits. Everything
 * about the venue is set in the Console, and nothing here pretends otherwise.
 */
export function StationSettings({ surface, extra }: { surface: 'floor' | 'counter'; /** A station's own section, after the device habits. */ extra?: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const device = useDevice();
  const outlet = useOutlet();
  const sync = useSync();
  const now = useNow(15_000);
  const [syncing, setSyncing] = useState(false);
  const keepAwake = useLiveQuery(() => getMeta<boolean>(META.screenKeepAwake), []);
  const haptics = useLiveQuery(() => getMeta<boolean>(META.hapticsEnabled), []);
  const tz = outlet?.timezone;
  const signedInAt = session?.signedInAt ?? null;
  const linkWord = sync.link === 'synced' ? 'Up to date' : sync.link === 'sending' ? 'Sending' : sync.link === 'offline' ? 'Offline' : 'Server unreachable';

  const sendNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Settings"
        facts={[{ key: 'device', text: device?.label ?? (surface === 'floor' ? 'This tablet' : 'This counter') }, session ? { key: 'who', text: session.displayName } : null, { key: 'link', text: linkWord }]}
        aside={
          <Button variant="secondary" shape="pill" icon={IconRefresh} loading={syncing} onClick={() => void sendNow()}>
            Sync now
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-12 pb-32 pt-16 pad:px-24 tablet:pt-24">
        <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 tablet:gap-20">
          <DeviceCard />

          {session ? (
            <Panel title="Signed in" id="settings-you" icon={IconUserCircle} lede="Tabs stay open and in your name. Hand them over from Shift first if you are leaving.">
              <div className="flex flex-wrap items-center gap-12 rounded-card bg-sunken/80 px-16 py-12">
                <span aria-hidden="true" className="flex size-control-lg shrink-0 items-center justify-center rounded-dot bg-accent-wash text-title font-medium text-accent-text">
                  {session.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-ink">{session.displayName}</span>
                  <span className="text-body-sm text-ink-muted">{signedInAt ? `Since ${formatTime(signedInAt, tz)}, ${formatAgo(now - signedInAt)}` : 'Signed in'}</span>
                </div>
                <Button
                  variant="secondary"
                  shape="pill"
                  icon={IconLogout}
                  onClick={async () => {
                    await signOut();
                    router.replace(`/${surface}/sign-in`);
                  }}
                >
                  Sign out
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Sending to the server" id="settings-sync" icon={IconCloudUpload} lede="Orders are kept on this device and sent as soon as the network allows.">
            <div className="flex items-center justify-between gap-12">
              <ConnectionChip state={sync.link} heldOrders={sync.heldOrders} />
            </div>
            <dl className="grid grid-cols-1 gap-8 pad:grid-cols-3">
              <Figure label="Last reached the server">{sync.lastSyncedAt ? formatAgo(now - sync.lastSyncedAt) : 'Not yet'}</Figure>
              <Figure label="Waiting to send">{sync.unsentLines === 0 && sync.heldOrders === 0 ? 'Nothing' : `${sync.heldOrders} orders, ${sync.unsentLines} lines`}</Figure>
              <Figure label="Could not be sent" tone={sync.rejected > 0 ? 'stop' : undefined}>
                {sync.rejected > 0 ? `${sync.rejected}, see the Console` : 'Nothing'}
              </Figure>
            </dl>
          </Panel>

          <Panel title="On this device" id="settings-habits" icon={IconAdjustmentsHorizontal} lede="Habits of this device only. The venue, its menu and its prices are set in the Console.">
            <div className="flex flex-col gap-4 rounded-card bg-sunken/80 px-16 py-8">
              <Switch
                checked={Boolean(keepAwake)}
                onChange={(on) => void setMeta(META.screenKeepAwake, on)}
                disabled={!canKeepAwake()}
                label="Keep the screen on"
                helper={
                  canKeepAwake()
                    ? 'While Bliss is open. The system still turns it off when the battery runs low.'
                    : 'This device cannot be kept awake by a web page. Set Auto-Lock to Never in its Display settings instead.'
                }
              />
              <div aria-hidden="true" className="h-px bg-rule-raised/30" />
              <Switch
                checked={Boolean(haptics)}
                onChange={async (on) => {
                  await setMeta(META.hapticsEnabled, on);
                  await refreshHaptics();
                  if (on) haptic('success');
                }}
                label="A tap you can feel"
                helper="A short vibration when an order is sent or something needs you, on devices that can vibrate."
              />
            </div>
          </Panel>

          {extra}
        </div>
        <p className="mt-24 text-center text-body-sm text-ink-subtle">
          Bliss {process.env.NEXT_PUBLIC_BLISS_VERSION ?? ''}
          {outlet ? ` · ${outlet.name}` : ''}
        </p>
      </div>
    </div>
  );
}
