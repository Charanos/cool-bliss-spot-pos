'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { Switch } from '@bliss/ui/components/fields';
import { useNow } from '@bliss/ui/hooks';
import { IconLogout, IconRefresh, IconUserCircle } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { META, getMeta, setMeta } from '@/lib/pos/db';
import { haptic, refreshHaptics } from '@/lib/pos/haptics';
import { useOutlet } from '@/lib/pos/queries';
import { signOut, useDevice, useSession } from '@/lib/pos/session';
import { syncNow, useSync } from '@/lib/pos/sync';
import { canKeepAwake } from '@/lib/pos/wake';
import { DeviceCard } from './device-card';

export function Panel({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-16 rounded-card border border-rule-raised bg-raised p-20">
      <h2 id={id} className="text-title-section text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A station's own settings, the same on the Floor and the Counter: this device, who is signed in,
 * whether everything has reached the server, and two device habits. Everything about the venue is
 * set in the Console, and nothing here pretends otherwise.
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

  const sendNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-form flex-col gap-24 px-16 py-24 pad:px-24">
        <header className="flex flex-col gap-4">
          <h1 className="text-title-page text-ink">Settings</h1>
          <p className="text-body text-ink-muted">
            {device?.label ?? (surface === 'floor' ? 'This tablet' : 'This counter')}
            {outlet ? ` at ${outlet.name}` : ''}. The venue, its menu and its prices are set in the Console.
          </p>
        </header>

        <DeviceCard />

        {session ? (
          <Panel title="Signed in" id="settings-you">
            <div className="flex items-center gap-12">
              <IconUserCircle size={32} stroke={1.5} aria-hidden="true" className="shrink-0 text-ink-muted" />
              <div className="flex min-w-0 flex-col">
                <span className="text-ui font-medium text-ink">{session.displayName}</span>
                <span className="text-body-sm text-ink-muted">{signedInAt ? `Since ${formatTime(signedInAt, tz)}, ${formatAgo(now - signedInAt)}` : 'Signed in'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-8">
              <Button
                variant="secondary"
                icon={IconLogout}
                onClick={async () => {
                  await signOut();
                  router.replace(`/${surface}/sign-in`);
                }}
              >
                Sign out
              </Button>
            </div>
            <p className="text-body-sm text-ink-muted">Tabs stay open and in your name. Hand them over from Shift first if you are leaving.</p>
          </Panel>
        ) : null}

        <Panel title="Sending to the server" id="settings-sync">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <ConnectionChip state={sync.link} heldOrders={sync.heldOrders} />
            <Button variant="secondary" icon={IconRefresh} loading={syncing} onClick={() => void sendNow()}>
              Sync now
            </Button>
          </div>
          <dl className="grid grid-cols-1 gap-12 pad:grid-cols-3">
            <div className="flex flex-col gap-2">
              <dt className="text-body-sm text-ink-muted">Last reached the server</dt>
              <dd className="text-ui text-ink">{sync.lastSyncedAt ? formatAgo(now - sync.lastSyncedAt) : 'Not yet'}</dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="text-body-sm text-ink-muted">Waiting to send</dt>
              <dd className="text-ui text-ink">{sync.unsentLines === 0 && sync.heldOrders === 0 ? 'Nothing' : `${sync.heldOrders} orders, ${sync.unsentLines} lines`}</dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="text-body-sm text-ink-muted">Could not be sent</dt>
              <dd className={sync.rejected > 0 ? 'text-ui text-stop' : 'text-ui text-ink'}>{sync.rejected > 0 ? `${sync.rejected}, a manager can see why in the Console` : 'Nothing'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="On this device" id="settings-habits">
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
        </Panel>

        {extra}

        <p className="text-center text-body-sm text-ink-subtle">Bliss {process.env.NEXT_PUBLIC_BLISS_VERSION ?? ''}</p>
      </div>
    </div>
  );
}
