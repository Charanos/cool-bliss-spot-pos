'use client';

import { formatDate, formatTime } from '@bliss/shared/format';
import { BlissMark } from '@bliss/ui/components/brand';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { LiveRegion } from '@bliss/ui/components/surface';
import { CountBadge } from '@bliss/ui/components/working';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconBuildingStore,
  IconClockHour4,
  IconHome,
  IconLayoutGrid,
  IconReceipt2,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { BaseLayerContext } from '@/app/_pos/base-layer';
import { useFiredOrders, useOpenTabs } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { useSync } from '@/lib/pos/sync';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { SearchDialog } from './search-dialog';
import { AmbientFloorArtwork } from '@bliss/ui/components/artwork/floor-workspace';

interface DockNavItem {
  href: string;
  label: string;
  icon: TablerIcon;
  badge?: number;
  badgeTone?: 'accent' | 'stop';
  alertDot?: boolean;
}

/**
 * A dock navigation item matching the Apple dock aesthetic (media_1789669259603.png).
 * Has a minimum 48px touch target for Floor tablets.
 * Active state renders a glowing luminous cyan dot right below the icon.
 */
function DockLink({ item, active }: { item: DockNavItem; active: boolean }) {
  const Glyph = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cx(
        'relative flex size-[46px] tablet:size-[50px] desktop:size-[56px] flex-col items-center justify-center rounded-full transition-colors press-feedback active:scale-95',
        active ? 'text-ink' : 'text-ink-subtle hover:bg-control-hover/50 hover:text-ink',
      )}
    >
      <span className="relative flex items-center justify-center">
        <Glyph size={23} stroke={ICON_STROKE} aria-hidden="true" className={cx(active ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" : "", "desktop:scale-110")} />
        {item.badge ? (
          <CountBadge
            count={item.badge}
            tone={item.badgeTone ?? 'accent'}
            className="absolute -right-[10px] -top-[6px] shadow-sm ring-2 ring-sunken scale-90 desktop:scale-100"
          />
        ) : null}
        {item.alertDot ? (
          <span
            aria-hidden="true"
            className="absolute -right-[3px] -top-[2px] size-2 rounded-dot bg-stop shadow-sm ring-2 ring-sunken"
          />
        ) : null}
      </span>
      {/* Sleek Mac-style active dot */}
      {active && (
        <span className="absolute bottom-[3px] desktop:bottom-[4px] size-[4px] rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      )}
    </Link>
  );
}

/**
 * Revamped Floor Shell matching high-fidelity Bliss design specifications:
 *
 * 1. Top Bar:
 *    - Brand: BlissMark + lowercase 'bliss' typography
 *    - Surface switcher: 'Floor' active pill, 'Bar', 'Counter' linking to /counter
 *    - Center search: 'Search items, seats, tabs' with ⌘K shortcut badge
 *    - Right telemetry: 24h mono clock, live formatted date, staff avatar monogram with AW styling,
 *      staff name & role display, and connection status.
 *
 * 2. Floating Bottom Dock (Apple-style pill dock, media_1789669259603.png):
 *    - Tabs (with active glowing dot and open tab count badge)
 *    - Orders (with active glowing dot and needsMe attention badge)
 *    - Center raised action button (Search trigger)
 *    - Shift
 *    - Settings (with sync alert dot if sync issues occur)
 *    - Primary Action Portal (BaseAction for 'Fire order', 'Walk-up tab', 'End shift')
 *
 * 3. Full-Width Floor View:
 *    - The left 72px rail is removed, giving 100% viewport width to the tables grid and ticket builder.
 */
export function FloorShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isTabDetail = pathname.startsWith('/floor/tabs/') && pathname !== '/floor/tabs';
  const sync = useSync();
  const now = useNow(30_000);
  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const tabs = useOpenTabs();
  const orders = useFiredOrders(session?.staffId);

  useEffect(() => {
    if (session === null) router.replace('/floor/sign-in');
  }, [session, router]);

  // Global ⌘K / Ctrl+K keyboard shortcut to toggle quick search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const mine = tabs?.filter((t) => t.tab.assignedTo === session?.staffId).length ?? 0;
  const needsMe = orders?.filter((o) => o.state === 'needs_you').length ?? 0;
  const link =
    sync.link === 'synced' ? 'synced' : sync.link === 'sending' ? 'sending' : sync.link === 'offline' ? 'offline' : 'unreachable';

  if (!session) {
    return <div className="h-dvh bg-page" aria-busy="true" />;
  }

  // Parse staff name into firstName and role/lastName for the top bar
  const nameParts = session.displayName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? session.displayName;
  const secondLine =
    nameParts.length > 1
      ? nameParts.slice(1).join(' ')
      : session.roleKey.charAt(0).toUpperCase() + session.roleKey.slice(1);

  const initials = nameParts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const photoUrl = staffPhoto(session.displayName);

  // Formatted date string (e.g., 'Sun, 6 Sep 2026')
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentWeekday = weekdayNames[new Date(now).getDay()] ?? '';
  const formattedDate = `${currentWeekday}, ${formatDate(now)}`;

  const navTabs: DockNavItem = {
    href: '/floor/tabs',
    label: 'Tabs',
    icon: IconLayoutGrid,
    badge: mine || undefined,
  };

  const navOrders: DockNavItem = {
    href: '/floor/orders',
    label: 'Orders',
    icon: IconReceipt2,
    badge: needsMe || undefined,
    badgeTone: 'stop',
  };

  const navShift: DockNavItem = {
    href: '/floor/shift',
    label: 'Shift',
    icon: IconClockHour4,
  };

  const navSettings: DockNavItem = {
    href: '/floor/settings',
    label: 'Settings',
    icon: IconSettings,
    alertDot: sync.rejected > 0,
  };

  return (
    <BaseLayerContext.Provider value={actionTarget}>
      <AmbientFloorArtwork />
      <div className="relative flex h-dvh flex-col bg-page/5 overflow-hidden z-0 backdrop-blur-[2px]">
        {/* ── Top Bar: High-fidelity matching Bliss design screenshot ──── */}
        <header className="relative flex h-strip shrink-0 items-center justify-between border-b border-rule/10 bg-page/20 px-16 tablet:px-20 z-10 backdrop-blur-md">
          {/* Left: Brand + Search Bar */}
          <div className="flex flex-1 items-center gap-16 tablet:gap-20 min-w-0">
            {/* Bliss Brand Logo */}
            <Link
              href="/floor/tabs"
              aria-label="Bliss, floor tabs"
              className="flex items-center justify-center rounded-md press-feedback active:scale-95"
            >
              <BlissMark size={32} />
            </Link>

            {/* Elegant Divider */}
            <div className="hidden h-24 w-px bg-rule-raised/60 tablet:block" aria-hidden="true" />

            {/* Search Bar with ⌘K Badge */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search items, seats, tabs (⌘K)"
              className="hidden h-control-sm w-[260px] tablet:flex desktop:w-[320px] items-center gap-8 rounded-md bg-control px-12 text-ink-subtle border border-transparent hover:border-hairline transition-colors cursor-pointer select-none"
            >
              <IconSearch size={14} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
              <span className="flex-1 truncate text-left text-body-sm text-ink-subtle">Search items, seats, tabs</span>
              <kbd className="shrink-0 rounded border border-rule bg-sunken px-4 py-0.5 font-mono text-micro text-ink-muted uppercase">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Center: Surface Switcher Pills */}
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8 rounded-dot p-1 bg-sunken/50 border border-rule-raised/30 shadow-inner" aria-label="Surfaces">
            {/* Floor (Active Surface) */}
            <Link
              href="/floor/tabs"
              aria-current="page"
              className="flex h-[32px] items-center gap-6 rounded-dot border border-accent/30 bg-accent/15 px-12 text-body-sm font-medium text-accent-text shadow-[0_2px_8px_-2px_var(--color-accent-subtle),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-transform active:scale-95"
            >
              <IconHome size={16} stroke={ICON_STROKE} aria-hidden="true" />
              <span>Floor</span>
            </Link>

            {/* Counter (Switches to Counter surface) */}
            <Link
              href="/counter"
              className="flex h-[32px] items-center gap-6 rounded-dot border border-transparent px-12 text-body-sm text-ink-subtle transition-all hover:bg-page hover:text-ink hover:border-rule-raised/50 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
            >
              <IconBuildingStore size={16} stroke={ICON_STROKE} aria-hidden="true" />
              <span>Counter</span>
            </Link>
          </nav>

          {/* Right: Telemetry + Staff Profile */}
          <div className="flex flex-1 items-center justify-end gap-16 tablet:gap-20">
            {/* Live Clock & Date */}
            <div className="hidden tablet:block text-right leading-tight select-none">
              <div className="font-mono tabular text-body-sm font-medium text-ink">
                {formatTime(now)}
              </div>
              <div className="text-micro text-ink-subtle">
                {formattedDate}
              </div>
            </div>

            {/* Staff Profile (Avatar circle + Name & Role) */}
            <Link
              href="/floor/shift"
              aria-label={`${session.displayName}, view shift`}
              className="flex items-center gap-8 rounded-md p-2 hover:bg-control/40 transition-colors press-feedback"
            >
              {/* Avatar circle */}
              <div
                aria-hidden="true"
                className="flex size-control-sm items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-label font-medium text-accent-text select-none shadow-sm"
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={firstName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* Staff name & role */}
              <div className="hidden leading-tight text-left tablet:block">
                <div className="text-body-sm font-medium text-ink truncate max-w-[120px]">{firstName}</div>
                <div className="text-micro text-ink-subtle truncate max-w-[120px]">{secondLine}</div>
              </div>
            </Link>
          </div>
        </header>

        {/* ── Main content: Full width responsive floor workspace ────────── */}
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>

        {/* ── Floating Bottom Dock (Sleek Dashboard Glass Dock) ──────────── */}
        <footer
          className={cx(
            'pointer-events-none fixed bottom-16 desktop:bottom-24 z-40 flex transition-all duration-300',
            pathname.startsWith('/floor/tabs') ? 'tablet:justify-start justify-center' : 'justify-center',
            isTabDetail
              ? 'tablet:left-[180px] tablet:right-[340px] px-4 tablet:px-16 inset-x-0'
              : pathname === '/floor/tabs'
                ? 'inset-x-0 px-8 tablet:px-24'
                : 'inset-x-0 px-4 tablet:px-8 desktop:px-12',
          )}
        >
          <nav
            aria-label="Floor Navigation"
            style={{
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              backgroundColor: 'rgba(12, 18, 24, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 40px -8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
            className={cx(
              'pointer-events-auto flex items-center justify-between rounded-full shadow-2xl transition-all duration-300',
              'px-5 py-2.5 tablet:px-7 tablet:py-3 desktop:px-9 desktop:py-3.5 gap-3 tablet:gap-5 desktop:gap-8',
              isTabDetail
                ? 'w-full tablet:max-w-[540px] desktop:max-w-[780px] wide:max-w-[840px]'
                : 'w-auto max-w-[calc(100%-32px)]',
            )}
          >
            {/* Nav icons group (Hidden on mobile inside Tab Detail to make room for Fire Order) */}
            <div className={cx("flex items-center gap-2 tablet:gap-4 desktop:gap-6 shrink-0", isTabDetail ? "hidden tablet:flex" : "")}>
              <DockLink item={navTabs} active={pathname.startsWith('/floor/tabs')} />
              <DockLink item={navOrders} active={pathname.startsWith('/floor/orders')} />

              {/* Separator */}
              <div className="mx-1 tablet:mx-2 desktop:mx-4 h-[24px] desktop:h-[28px] w-px" style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden="true" />

              <DockLink item={navShift} active={pathname.startsWith('/floor/shift')} />
              <DockLink item={navSettings} active={pathname.startsWith('/floor/settings')} />
            </div>

            {/* Right side: Search + Action */}
            <div className="flex items-center gap-2 tablet:gap-4 desktop:gap-6 shrink-0">
              {/* Search button */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Quick search"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                className="flex size-[48px] tablet:size-[56px] items-center justify-center rounded-full text-ink-subtle hover:text-ink transition-colors active:scale-95 press-feedback shrink-0"
              >
                <IconSearch size={22} stroke={ICON_STROKE} aria-hidden="true" className="desktop:scale-110" />
              </button>

              {/* Separator */}
              {pathname.startsWith('/floor/tabs') && (
                <div className="h-[24px] desktop:h-[28px] w-px mx-0 tablet:mx-1 desktop:mx-2" style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden="true" />
              )}

              {/* Primary Action Slot (Walk-up tab, Fire order, End shift) portaled here */}
              <div
                ref={setActionTarget}
                className="flex items-center gap-2 tablet:gap-4 desktop:gap-6 empty:hidden shrink-0"
              />
            </div>
          </nav>
        </footer>
      </div>

      {/* Quick Search Dialog (⌘K) */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <LiveRegion>{sync.announcements.join(' ')}</LiveRegion>
    </BaseLayerContext.Provider>
  );
}
