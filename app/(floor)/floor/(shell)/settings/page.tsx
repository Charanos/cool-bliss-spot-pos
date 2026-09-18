'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { SelectField, Switch } from '@bliss/ui/components/fields';
import { Dot } from '@bliss/ui/components/status';
import { useNow } from '@bliss/ui/hooks';
import { motionStore, useMotionState } from '@bliss/ui/motion';
import { cx } from '@bliss/ui/lib/cx';
import { useLiveQuery } from 'dexie-react-hooks';
import { type ReactNode, useState } from 'react';
import { api, setForcedOffline } from '@/lib/pos/api';
import { META, posDb, getMeta, setMeta } from '@/lib/pos/db';
import { useGrid, useOutlet } from '@/lib/pos/queries';
import { bindDevice, useDevice, useSession } from '@/lib/pos/session';
import { syncNow, useSync } from '@/lib/pos/sync';

const APP_VERSION = '1.0.0';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-20">
      <h2 className="pb-8 text-subtitle text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-row-floor items-center justify-between gap-16">
      <span className="text-body text-ink-muted">{label}</span>
      <span className="text-right text-body text-ink">{value}</span>
    </div>
  );
}

/**
 * This tablet only. Prices and products are set in the Console.
 * The motion debug panel opens with five taps on the version, per docs/07 section 9.
 */
export default function SettingsPage() {
  const device = useDevice();
  const outlet = useOutlet();
  const session = useSession();
  const sync = useSync();
  const motion = useMotionState();
  const now = useNow(5_000);
  const grid = useGrid(now, outlet?.timezone);
  const [taps, setTaps] = useState(0);
  const [simVariant, setSimVariant] = useState('');
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const forceOffline = useLiveQuery(() => getMeta<boolean>(META.forceOffline), []);
  const devices = useLiveQuery(() => posDb().devices.toArray(), []);
  const lastPulled = useLiveQuery(() => getMeta<number>(META.lastPulledAt), []);
  const isDev = process.env.NODE_ENV !== 'production';
  const debugOpen = taps >= 5;
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const simulate = async (target: string) => {
    if (!simVariant) return;
    setSimStatus('Writing the movement');
    try {
      await api.post('/api/dev/stock', { variantId: simVariant, target });
      await syncNow();
      setSimStatus('Done. The tile updates on every tablet at the next pull.');
    } catch {
      setSimStatus('No connection. The simulator needs the network.');
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto px-24 pb-40 pt-20">
      <div className="max-w-[760px]">
        <h1 className="text-title-lg text-ink">Settings</h1>
        <p className="mt-4 text-body text-ink-subtle">This tablet only. Prices and products are set in the Console.</p>

        <div className="mt-24">
          <Group title="This tablet">
            <Row label="Device" value={device?.label ?? 'Not registered'} />
            <Row label="Outlet" value={outlet?.name ?? ''} />
            <Row label="Signed in" value={session?.displayName ?? ''} />
          </Group>

          <Group title="Sync">
            <Row
              label="Connection"
              value={<ConnectionChip state={sync.link === 'synced' ? 'synced' : sync.link === 'sending' ? 'sending' : sync.link === 'offline' ? 'offline' : 'unreachable'} heldOrders={sync.heldOrders} />}
            />
            <Row label="Last sync" value={sync.lastSyncedAt ? `${formatTime(sync.lastSyncedAt, tz)} · ${formatAgo(now - sync.lastSyncedAt)}` : lastPulled ? formatTime(lastPulled, tz) : 'Not yet'} />
            <Row label="Orders held on this tablet" value={<span className="font-mono tabular">{sync.heldOrders}</span>} />
            <Row label="Lines not yet sent" value={<span className="font-mono tabular">{sync.unsentLines}</span>} />
            {sync.rejected > 0 ? (
              <p className="flex items-center gap-8 pt-8 text-body text-stop">
                <Dot tone="stop" />
                {sync.rejected} could not be sent. A manager can see why in Console, Settings, Sync.
              </p>
            ) : null}
            <div className="pt-12">
              <Button variant="secondary" size="lg" onClick={() => void syncNow()}>
                Sync now
              </Button>
            </div>
          </Group>

          <Group title="Motion">
            <Switch
              label="Reduce motion on this tablet"
              helper="Things change instantly. Nothing stops working."
              checked={motion.forcedReduced}
              onChange={(v) => motionStore.set({ forcedReduced: v })}
            />
            {motion.lowPower ? <p className="text-body text-low">Battery is below 15 per cent, so motion is off until it charges.</p> : null}
          </Group>

          <Group title="About">
            <Row
              label="Bliss"
              value={
                <button type="button" onClick={() => setTaps((t) => t + 1)} className="font-mono tabular text-ink-muted" aria-label={`Version ${APP_VERSION}`}>
                  {APP_VERSION}
                </button>
              }
            />
          </Group>

          {debugOpen ? (
            <Group title="Motion debug">
              <label className="flex min-h-row-floor items-center gap-16">
                <span className="w-[180px] text-body text-ink-muted">Global time scale</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={motion.timeScale}
                  onChange={(e) => motionStore.set({ timeScale: Number(e.target.value) })}
                  className="flex-1 accent-[var(--color-accent)]"
                />
                <span className="w-[48px] text-right font-mono tabular text-num text-ink">{motion.timeScale.toFixed(2)}</span>
              </label>
              <Switch label="Turn every animation off" helper="The product must work fully without motion." checked={motion.off} onChange={(v) => motionStore.set({ off: v })} />
              <Switch label="Outline animating elements" checked={motion.highlight} onChange={(v) => motionStore.set({ highlight: v })} />
              <Switch label="Force reduced motion" checked={motion.forcedReduced} onChange={(v) => motionStore.set({ forcedReduced: v })} />
              <h3 className="pb-4 pt-16 text-label text-ink-subtle">Last {Math.min(50, motion.log.length)} animations</h3>
              <ul className="max-h-[240px] overflow-y-auto">
                {motion.log.map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="flex items-center justify-between gap-16 py-4 font-mono tabular text-num-sm">
                    <span className="text-ink">{entry.name}</span>
                    <span className="text-ink-subtle">{entry.ms}ms</span>
                    <span className={cx(entry.longestFrameMs > 17 ? 'text-low' : 'text-ink-subtle')}>longest frame {entry.longestFrameMs}ms</span>
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}

          {isDev ? (
            <Group title="Development tools">
              <p className="pb-8 text-body text-ink-subtle">Only in development. Everything here writes real movements and holds through the dev data source.</p>
              <Switch
                label="Take this tablet offline"
                helper="Orders keep saving here and send when you turn this off."
                checked={Boolean(forceOffline)}
                onChange={(v) => {
                  setForcedOffline(v);
                  void setMeta(META.forceOffline, v).then(() => syncNow());
                }}
              />
              <div className="grid grid-cols-[1fr_auto] items-end gap-16 pt-12">
                <SelectField
                  label="Simulate stock for"
                  value={simVariant}
                  onChange={(e) => setSimVariant(e.target.value)}
                  options={[{ value: '', label: 'Choose an item' }, ...(grid?.tiles ?? []).map((t) => ({ value: t.variantId, label: t.name }))]}
                />
              </div>
              <div className="flex flex-wrap gap-8 pt-12">
                {[
                  ['low', 'Run it low'],
                  ['last_few', 'Last few'],
                  ['finished', 'Finish it'],
                  ['restock', 'Restock'],
                  ['hold', 'Put on hold'],
                  ['release', 'Take off hold'],
                ].map(([key, label]) => (
                  <Button key={key} variant="secondary" size="lg" disabled={!simVariant} onClick={() => void simulate(key!)}>
                    {label}
                  </Button>
                ))}
              </div>
              {simStatus ? <p className="pt-8 text-body text-ink-muted">{simStatus}</p> : null}
              <div className="pt-16">
                <SelectField
                  label="Bind this tablet to"
                  value={device?.id ?? ''}
                  onChange={(e) => {
                    const d = devices?.find((x) => x.id === e.target.value);
                    if (d) void bindDevice({ id: d.id, label: d.label });
                  }}
                  options={(devices ?? []).filter((d) => d.kind === 'floor').map((d) => ({ value: d.id, label: d.label }))}
                />
              </div>
            </Group>
          ) : null}
        </div>
      </div>
    </div>
  );
}
