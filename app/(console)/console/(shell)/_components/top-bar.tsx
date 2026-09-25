'use client';

import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconClock,
  IconDeviceTablet,
  IconRefresh,
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export interface ConsoleTopBarProps {
  outletName: string;
  businessDate: string;
  tradingInProgress: boolean;
  onlineDevices: number;
  totalDevices: number;
  heldOrders?: number;
  syncState?: 'synced' | 'sending' | 'offline' | 'unreachable';
}

export function ConsoleTopBar({
  outletName: _outletName,
  businessDate,
  tradingInProgress,
  onlineDevices,
  totalDevices,
  heldOrders = 0,
  syncState = 'synced',
}: ConsoleTopBarProps) {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const segments = pathname.split('/').filter(Boolean);
  const currentWorkspace = segments[1]
    ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
    : 'Overview';
  const subSection = segments[2]
    ? segments[2].charAt(0).toUpperCase() + segments[2].slice(1)
    : null;

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center justify-between border-b border-hairline/40 bg-raised/80 px-20 tablet:px-24 backdrop-blur-glass select-none relative">
      {/* Hairline glint — delicate top edge */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-glint/20 to-transparent pointer-events-none" aria-hidden="true" />

      {/* ── Left: Breadcrumb · Trading State · Date ── */}
      <div className="flex items-center gap-12 min-w-0">

        {/* Breadcrumb */}
        <nav aria-label="Location" className="flex items-center gap-8 text-body-sm min-w-0">
          <span className="text-ink-subtle hidden tablet:inline">Console</span>
          <span aria-hidden="true" className="text-ink-disabled hidden tablet:inline text-[10px]">›</span>
          <span className="font-medium text-ink">{currentWorkspace}</span>
          {subSection ? (
            <>
              <span aria-hidden="true" className="text-ink-disabled text-[10px]">›</span>
              <span className="text-ink-muted">{subSection}</span>
            </>
          ) : null}
        </nav>

        {/* Mid separator dot */}
        <span className="size-[3px] rounded-full bg-hairline/60 shrink-0 hidden tablet:block" aria-hidden="true" />

        {/* Trading State pill — no border box, just ambient fill */}
        {tradingInProgress ? (
          <span className="inline-flex items-center gap-6 rounded-full bg-poured/10 px-8 py-4 text-micro font-medium text-poured uppercase tracking-[0.08em] shrink-0">
            <span className="size-[5px] rounded-full bg-poured animate-breathe shrink-0" aria-hidden="true" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-6 rounded-full bg-control/80 px-8 py-4 text-micro font-medium text-ink-subtle uppercase tracking-[0.08em] shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ring-1 ring-hairline/20">
            <span className="size-[5px] rounded-full bg-ink-disabled shrink-0" aria-hidden="true" />
            Closed
          </span>
        )}

        {/* Business Date — clean inline, no capsule border */}
        <div className="hidden desktop:flex items-center gap-6 text-micro text-ink-subtle">
          <IconClock size={12} stroke={ICON_STROKE} className="text-ink-subtle shrink-0" aria-hidden="true" />
          <span className="font-medium text-ink tabular">{businessDate}</span>
        </div>
      </div>

      {/* ── Right: Telemetry + Actions ── */}
      <div className="flex items-center gap-12 shrink-0">

        {/* Device Fleet — inline, no border */}
        <div className="hidden pad:flex items-center gap-6 text-micro text-ink-subtle">
          <IconDeviceTablet size={12} stroke={ICON_STROKE} className="text-ink-subtle shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-ink">{onlineDevices}</span>
            <span>/{totalDevices}</span>
          </span>
        </div>

        {/* Hairline vertical divider */}
        <span className="h-[16px] w-px bg-hairline/40 shrink-0 hidden pad:block" aria-hidden="true" />

        {/* Connection Chip — refined pill */}
        <div className="flex items-center rounded-full bg-control/80 border border-hairline/30 px-8 py-4 text-micro shadow-[0_1px_2px_rgba(0,0,0,0.02)] [&_.text-body]:text-micro [&_.text-body]:font-mono [&_.text-body]:leading-none">
          <ConnectionChip state={syncState} heldOrders={heldOrders} />
        </div>

        {/* Refresh — ghost icon button, no border */}
        <button
          type="button"
          disabled={isRefreshing}
          onClick={handleRefresh}
          className="flex size-[28px] items-center justify-center rounded-md text-ink-disabled hover:text-ink hover:bg-control/50 transition-all duration-150 press-feedback"
          title="Refresh"
          aria-label="Reload Console Data"
        >
          <IconRefresh size={13} stroke={ICON_STROKE} className={cx('shrink-0', isRefreshing && 'spin')} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
