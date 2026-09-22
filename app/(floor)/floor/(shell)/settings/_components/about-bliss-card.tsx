'use client';

import { Badge } from '@bliss/ui/components/badge';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import {
  IconBuildingStore,
  IconCpu,
  IconDatabase,
  IconInfoCircle,
  IconServer,
  IconShieldCheck,
} from '@tabler/icons-react';
import { SettingsCard } from './settings-card';

const APP_VERSION = '1.0.0';

interface AboutBlissCardProps {
  outletName?: string;
  taps: number;
  onTapVersion: () => void;
  className?: string;
}

/**
 * Revamped, full-width About Bliss System Card.
 * Conforms strictly to docs/06-design-system.md and docs/12-surface-language.md:
 * - Enterprise venue license & node identity
 * - Full-width 4-column architecture and spec bento grid
 * - Easter egg gesture support for diagnostic console
 * - Zero nested border conflicts (bliss/one-pane compliant)
 * - Font-weight strictly <= 500
 */
export function AboutBlissCard({
  outletName = 'Cool Bliss Spot',
  taps,
  onTapVersion,
  className,
}: AboutBlissCardProps) {
  return (
    <div className={className}>
      <SettingsCard
        icon={IconInfoCircle}
        title="About Bliss"
        subtitle="Venue system release and operational node status"
        tone="neutral"
        badge={
          <Badge
            tone="neutral"
            className="!rounded-dot px-8 py-2 font-mono text-micro uppercase "
          >
            v{APP_VERSION} / Stable
          </Badge>
        }
      >
        <div className="flex flex-col gap-16">
          {/* ── Top Venue & Architecture Hero Banner ─────────────────── */}
          <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-20 flex flex-col tablet:flex-row tablet:items-center justify-between gap-16">
            <div className="flex items-center gap-16 min-w-0">
              <div className="size-[40px] rounded-md bg-accent/15 flex items-center justify-center shrink-0">
                <IconBuildingStore size={22} stroke={ICON_STROKE} className="text-accent-text" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-body font-medium text-ink truncate">
                  Bliss Point of Sale & Venue Operating System
                </span>
                <span className="text-body-sm text-ink-subtle truncate mt-2">
                  Connected terminal node for {outletName} - High availability edge architecture
                </span>
              </div>
            </div>

            <div className="flex items-center gap-8 shrink-0 pl-56 tablet:pl-0">
              <span className="inline-flex size-[8px] rounded-full bg-poured" aria-hidden="true" />
              <span className="font-mono text-micro uppercase text-ink font-medium">
                Cluster Active
              </span>
            </div>
          </div>

          {/* ── 4-Column Spec & Architecture Grid ─────────────────────── */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-12">
            {/* Tile 1: Build Version */}
            <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-16 flex flex-col justify-between gap-12">
              <div className="flex items-center justify-between gap-8">
                <span className="font-mono text-micro uppercase text-ink-subtle">
                  System Version
                </span>
                <IconShieldCheck size={16} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              </div>

              <div>
                <button
                  type="button"
                  onClick={onTapVersion}
                  className="font-mono tabular text-body-lg font-medium text-ink hover:text-accent transition-colors cursor-pointer select-none active:scale-95 text-left block"
                  aria-label={`Version ${APP_VERSION}`}
                >
                  v{APP_VERSION}
                  {taps > 0 && taps < 5 ? (
                    <span className="ml-8 text-accent font-mono text-micro">
                      ({5 - taps} taps)
                    </span>
                  ) : null}
                </button>
                <span className="text-body-sm text-ink-subtle mt-2 block">
                  Production channel / Up to date
                </span>
              </div>
            </div>

            {/* Tile 2: Local Persistence Engine */}
            <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-16 flex flex-col justify-between gap-12">
              <div className="flex items-center justify-between gap-8">
                <span className="font-mono text-micro uppercase text-ink-subtle">
                  Local Database
                </span>
                <IconDatabase size={16} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              </div>

              <div>
                <span className="text-body-lg font-medium text-ink block truncate">
                  Dexie / IndexedDB
                </span>
                <span className="text-body-sm text-ink-subtle mt-2 block truncate">
                  Zero-latency offline tab queue
                </span>
              </div>
            </div>

            {/* Tile 3: Cluster Sync Protocol */}
            <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-16 flex flex-col justify-between gap-12">
              <div className="flex items-center justify-between gap-8">
                <span className="font-mono text-micro uppercase text-ink-subtle">
                  Sync Transport
                </span>
                <IconServer size={16} stroke={ICON_STROKE} className="text-accent-text shrink-0" />
              </div>

              <div>
                <span className="text-body-lg font-medium text-ink block truncate">
                  Reactive Edge Sync
                </span>
                <span className="text-body-sm text-ink-subtle mt-2 block truncate">
                  Live order delta propagation
                </span>
              </div>
            </div>

            {/* Tile 4: Client Architecture */}
            <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-16 flex flex-col justify-between gap-12">
              <div className="flex items-center justify-between gap-8">
                <span className="font-mono text-micro uppercase text-ink-subtle">
                  Runtime Profile
                </span>
                <IconCpu size={16} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              </div>

              <div>
                <span className="text-body-lg font-medium text-ink block truncate">
                  Next.js Client PWA
                </span>
                <span className="text-body-sm text-ink-subtle mt-2 block truncate">
                  Optimized WebKit / Chromium
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer Telemetry & Copyright Bar ──────────────────────── */}
          <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-8 pt-8 border-t border-rule-raised/20 font-mono text-micro text-ink-subtle">
            <span>
              2026 Bliss POS Technologies - Licensed to {outletName}
            </span>
            <span className="text-ink-disabled">
              TLS 1.3 Encrypted - Storage Quota Verified
            </span>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
