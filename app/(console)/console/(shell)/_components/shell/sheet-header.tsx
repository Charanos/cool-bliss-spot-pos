'use client';

import { cx } from '@bliss/ui/lib/cx';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import {
  IconClock,
  IconDeviceTablet,
  IconSearch,
  IconChevronLeft,
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import Link from 'next/link';
import { ThemeToggle } from '../theme-toggle';

export interface SheetHeaderProps {
  businessDate: string;
  tradingInProgress: boolean;
  onlineDevices: number;
  totalDevices: number;
  heldOrders?: number;
  syncState?: 'synced' | 'sending' | 'offline' | 'unreachable';
  tabs?: ReactNode;
  backHref?: string;
  backLabel?: string;
  theme?: 'light' | 'dark';
}

export function SheetHeader({
  businessDate,
  tradingInProgress,
  onlineDevices,
  totalDevices,
  heldOrders = 0,
  syncState = 'synced',
  tabs,
  backHref,
  backLabel,
  theme = 'light',
}: SheetHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Note: Since this is inside a custom scroll container (the sheet),
    // we would ideally attach to its scroll event. For now, assuming window or a known ID.
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      setScrolled(target.scrollTop > 10);
    };
    const scroller = document.getElementById('sheet-scroll-container') || window;
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const currentWorkspace = segments[1]
    ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
    : 'Overview';
  const subSection = segments[2]
    ? segments[2].charAt(0).toUpperCase() + segments[2].slice(1)
    : null;

  return (
    <header
      className={cx(
        'sticky top-0 z-20 flex flex-col shrink-0 bg-page transition-colors duration-300',
        scrolled ? 'shadow-sm ring-1 ring-hairline/40 bg-page/90 backdrop-blur-glass' : ''
      )}
    >
      {/* Row 1: Context, Search, Telemetry */}
      <div className="flex h-[56px] items-center justify-between px-24 select-none">
        <div className="flex items-center gap-16 min-w-0">
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

          {/* Trading State */}
          <div className="hidden tablet:flex items-center gap-12 border-l border-hairline/40 pl-12">
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

            <div className="flex items-center gap-6 text-micro text-ink-subtle">
              <IconClock size={12} stroke={ICON_STROKE} className="text-ink-subtle shrink-0" aria-hidden="true" />
              <span className="font-medium text-ink tabular">{businessDate}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12 shrink-0">
          {/* Compact Search Trigger */}
          <button className="flex items-center justify-center size-[32px] rounded-full hover:bg-control/60 text-ink-subtle hover:text-ink transition-colors">
            <IconSearch size={18} stroke={ICON_STROKE} />
          </button>

          {/* Telemetry Chips */}
          <div className="hidden pad:flex items-center gap-8">
            <ThemeToggle theme={theme} />
            <div className="flex items-center gap-6 text-micro text-ink-subtle px-8 py-4 rounded-full bg-control/40 ring-1 ring-hairline/40">
              <IconDeviceTablet size={12} stroke={ICON_STROKE} className="text-ink-subtle shrink-0" aria-hidden="true" />
              <span className="font-medium text-ink">{onlineDevices}</span>
              <span className="text-ink-disabled">/</span>
              <span>{totalDevices}</span>
            </div>
            <ConnectionChip state={syncState} heldOrders={heldOrders} />
          </div>
        </div>
      </div>

      {/* Row 2: Tabs or Back navigation */}
      {(tabs || backHref) && (
        <div className="flex items-center px-24 pb-12 pt-4">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-6 px-12 py-6 rounded-full bg-control/40 hover:bg-control/80 text-body-sm font-medium text-ink-muted hover:text-ink ring-1 ring-hairline/40 transition-all press-feedback shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <IconChevronLeft size={16} stroke={ICON_STROKE} />
              {backLabel || 'Back'}
            </Link>
          ) : (
            tabs
          )}
        </div>
      )}
    </header>
  );
}
