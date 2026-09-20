'use client';

import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { Switch } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { motionStore, useMotionState } from '@bliss/ui/motion';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconBug,
  IconBuildingStore,
  IconDeviceTablet,
  IconRefresh,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useOutlet } from '@/lib/pos/queries';
import { useDevice } from '@/lib/pos/session';
import { syncNow, useSync } from '@/lib/pos/sync';
import { AboutBlissCard } from './_components/about-bliss-card';
import { DisplayMotionCard } from './_components/display-motion-card';
import { SettingsCard } from './_components/settings-card';
import { TabletStationCard } from './_components/tablet-station-card';

/**
 * Production-grade Floor Waiter Settings Console.
 * Conforms strictly to docs/06-design-system.md, docs/12-surface-language.md,
 * bliss/one-pane and bliss/max-font-weight guidelines:
 * - Responsive frosted-glass Bento panels (Desktop 2-col, Tablet/Mobile responsive)
 * - Realtime device identity, staff credentials, and station telemetry
 * - Cloud sync outbox status with instant refresh action
 * - Client-friendly display & accessibility preferences
 * - Revamped full-width About Bliss system release & architecture panel
 * - Easter egg 5-tap gesture on version to reveal the Motion Debug Console
 */
export default function SettingsPage() {
  const device = useDevice();
  const outlet = useOutlet();
  const sync = useSync();
  const motion = useMotionState();

  const [taps, setTaps] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const debugOpen = taps >= 5;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncNow();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent overflow-hidden">
      {/* ── Sticky Frosted Header & Hardware Telemetry ──────────────── */}
      <header className="shrink-0 z-10 border-b border-rule-raised/20 bg-page/85 px-16 tablet:px-24 desktop:px-32 py-20 tablet:py-24 backdrop-blur-md shadow-sm">
        <div className="flex flex-col gap-12 tablet:gap-16">
          {/* Main Masthead Row */}
          <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-16 tablet:gap-20">
            {/* Left: Icon + Title + Operational Status Badge */}
            <div className="flex items-center gap-16 min-w-0">
              <div className="flex items-center gap-8 min-w-0 flex-wrap">
                <h1 className="text-title-lg font-medium tracking-tight text-ink truncate leading-none">
                  Settings
                </h1>

                <Badge
                  tone="neutral"
                  className="!rounded-dot px-8 py-1 font-mono text-micro uppercase tracking-wider"
                >
                  Tablet Node
                </Badge>

                {/* Connection Live Chip */}
                <div className="hidden tablet:flex items-center px-8 py-1 rounded-dot bg-wash border border-rule-raised/30 font-mono text-micro">
                  <ConnectionChip
                    state={
                      sync.link === 'synced'
                        ? 'synced'
                        : sync.link === 'sending'
                          ? 'sending'
                          : sync.link === 'offline'
                            ? 'offline'
                            : 'unreachable'
                    }
                    heldOrders={sync.heldOrders}
                  />
                </div>
              </div>
            </div>

            {/* Right: Instant One-Tap Sync Action */}
            <div className="flex items-center gap-10 shrink-0">
              <Button
                variant="secondary"
                size="md"
                icon={IconRefresh}
                disabled={isSyncing}
                onClick={() => void handleSync()}
                className="!rounded-dot px-16 text-body-sm font-medium border border-rule-raised/40 hover:border-accent/40 transition-all shadow-sm"
              >
                <span className={cx(isSyncing && 'animate-spin inline-block')}>
                  {isSyncing ? 'Syncing...' : 'Sync now'}
                </span>
              </Button>
            </div>
          </div>

          {/* Subtitle Telemetry Row: Indented under Settings title */}
          <div className="flex items-center gap-8 pl-0 font-mono text-micro text-ink-subtle flex-wrap">
            <span className="inline-flex items-center gap-4 text-ink-subtle">
              <IconDeviceTablet size={12} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              <span>Device: {device?.label ?? 'Not registered'}</span>
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="inline-flex items-center gap-4 text-ink-subtle">
              <IconBuildingStore size={12} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              <span>Outlet: {outlet?.name ?? 'Cool Bliss Spot'}</span>
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="text-ink-muted">
              Prices & catalogue configured in Console
            </span>
          </div>
        </div>
      </header>

      {/* ── Scrollable Body: Responsive Bento Panels ────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-16 tablet:px-24 desktop:px-32 py-24 tablet:py-32 flex flex-col gap-24 tablet:gap-32"
        style={{ paddingBottom: '120px' }}
      >
        <div className="grid grid-cols-1 desktop:grid-cols-2 gap-16 tablet:gap-24 desktop:gap-32 max-w-full">
          {/* ── Panel 1: Device & Station Identity (Full CRUD) ────────── */}
          <TabletStationCard />

          {/* ── Panel 2: Display & Motion Preferences ─────────────────── */}
          <DisplayMotionCard />

          {/* ── Panel 3: Revamped Full-Width About Bliss System Panel ─── */}
          <AboutBlissCard
            outletName={outlet?.name}
            taps={taps}
            onTapVersion={() => setTaps((t) => t + 1)}
            className="desktop:col-span-2"
          />

          {/* ── Panel 4: Motion Debug Console (5-tap easter egg) ───────── */}
          {debugOpen ? (
            <div className="desktop:col-span-2">
              <SettingsCard
                icon={IconBug}
                title="Motion Debug Panel"
                subtitle="Live frame execution telemetry & animation curves"
                tone="attention"
                badge={
                  <Badge tone="attention" className="!rounded-dot px-8 py-1 font-mono text-micro">
                    Debug Gesture Active
                  </Badge>
                }
              >
                <div className="flex flex-col gap-16">
                  <label className="flex items-center gap-16 min-h-row-floor flex-wrap">
                    <span className="w-[180px] text-body font-medium text-ink-muted">
                      Global time scale
                    </span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={motion.timeScale}
                      onChange={(e) => motionStore.set({ timeScale: Number(e.target.value) })}
                      className="flex-1 accent-[var(--color-accent)] cursor-pointer"
                    />
                    <span className="w-[48px] text-right font-mono tabular text-num font-medium text-ink">
                      {motion.timeScale.toFixed(2)}
                    </span>
                  </label>

                  <div className="grid grid-cols-1 tablet:grid-cols-3 gap-12">
                    <div className="p-16 tablet:p-20 rounded-lg bg-sunken/60 border border-rule-raised/30 flex items-center justify-between">
                      <span className="text-body-sm text-ink font-medium">Turn all motion off</span>
                      <Switch
                        label=""
                        checked={motion.off}
                        onChange={(v) => motionStore.set({ off: v })}
                      />
                    </div>

                    <div className="p-16 tablet:p-20 rounded-lg bg-sunken/60 border border-rule-raised/30 flex items-center justify-between">
                      <span className="text-body-sm text-ink font-medium">Outline animating</span>
                      <Switch
                        label=""
                        checked={motion.highlight}
                        onChange={(v) => motionStore.set({ highlight: v })}
                      />
                    </div>

                    <div className="p-16 tablet:p-20 rounded-lg bg-sunken/60 border border-rule-raised/30 flex items-center justify-between">
                      <span className="text-body-sm text-ink font-medium">Force reduced motion</span>
                      <Switch
                        label=""
                        checked={motion.forcedReduced}
                        onChange={(v) => motionStore.set({ forcedReduced: v })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-8 pt-8">
                    <span className="font-mono text-micro uppercase tracking-wider text-ink-subtle">
                      Last {Math.min(50, motion.log.length)} animations
                    </span>
                    <ul className="max-h-[220px] overflow-y-auto rounded-lg bg-sunken/60 border border-rule-raised/30 p-12 tablet:p-16 divide-y divide-rule-raised/20">
                      {motion.log.map((entry, i) => (
                        <li
                          key={`${entry.at}-${i}`}
                          className="flex items-center justify-between gap-16 py-6 px-8 font-mono tabular text-num-sm"
                        >
                          <span className="text-ink font-medium">{entry.name}</span>
                          <span className="text-ink-subtle">{entry.ms}ms</span>
                          <span className={cx(entry.longestFrameMs > 17 ? 'text-attention font-medium' : 'text-ink-subtle')}>
                            longest {entry.longestFrameMs}ms
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </SettingsCard>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
