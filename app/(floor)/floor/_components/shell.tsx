'use client';

import { AmbientFloorArtwork } from '@bliss/ui/components/artwork/floor-workspace';
import { BlissMark } from '@bliss/ui/components/brand';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { LiveRegion } from '@bliss/ui/components/surface';
import { IconClockHour4, IconHistory, IconLayoutGrid, IconReceipt2, IconSearch, IconSettings } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BaseLayerContext } from '@/app/_pos/base-layer';
import { Dock, DockButton, type DockItem, DockLink, LiveClock, SurfaceSwitcher, TopBar, useQuietChrome } from '@/app/_pos/chrome';
import { UpdateBar } from '@/app/_pos/update-bar';
import { useFloorWatch } from '@/app/_pos/watchers';
import { useFiredOrders, useOpenTabs, useOutlet } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { useSync } from '@/lib/pos/sync';
import { SearchDialog } from './search-dialog';

/**
 * The Floor shell: a top bar, the view, and a dock. The chrome itself is shared with the Counter
 * (app/_pos/chrome.tsx); what is the Floor's own is the nav, the search and the avatar that opens
 * the waiter's shift.
 *
 * Phone, phone on its side and tablet are one layout with three sizes, not three layouts: the top
 * bar loses the clock and the search field, the dock stacks the page's action above the nav, and
 * `short` (a phone on its side, or a tablet with the keyboard up) takes the dock labels away.
 */
export function FloorShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  useQuietChrome();
  const pathname = usePathname();
  const sync = useSync();
  const outlet = useOutlet();
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const tabs = useOpenTabs();
  const orders = useFiredOrders(session?.staffId);
  const openTab = useCallback((tabId: string) => router.push(`/floor/tabs/${tabId}`), [router]);
  useFloorWatch(orders, openTab);

  useEffect(() => {
    if (session === null) router.replace('/floor/sign-in');
  }, [session, router]);

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

  if (!session) return <div className="h-dvh bg-page" aria-busy="true" />;

  const mine = tabs?.filter((t) => t.tab.assignedTo === session.staffId).length ?? 0;
  const needsMe = orders?.filter((o) => o.state === 'needs_you').length ?? 0;
  const firstName = session.displayName.trim().split(/\s+/)[0] ?? session.displayName;
  const photoUrl = staffPhoto(session.displayName);

  const nav: DockItem[] = [
    { href: '/floor/tabs', label: 'Tabs', icon: IconLayoutGrid, badge: mine || undefined },
    { href: '/floor/orders', label: 'Orders', icon: IconReceipt2, badge: needsMe || undefined, badgeTone: 'stop' },
    { href: '/floor/shift', label: 'Shift', icon: IconClockHour4 },
    { href: '/floor/history', label: 'History', icon: IconHistory },
    { href: '/floor/settings', label: 'Settings', icon: IconSettings, dot: sync.rejected > 0 ? 'stop' : undefined, dotLabel: 'needs attention' },
  ];

  return (
    <BaseLayerContext.Provider value={actionTarget}>
      <AmbientFloorArtwork />
      <div className="relative z-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-page/5">
        <TopBar
          start={
            <>
              <Link href="/floor/tabs" aria-label="Bliss, floor tabs" className="flex shrink-0 items-center justify-center rounded-md press-feedback">
                <BlissMark size={32} />
              </Link>
              <div className="hidden h-24 w-px bg-rule-raised/60 tablet:block" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden h-control-sm w-[240px] items-center gap-8 rounded-md border border-transparent bg-control px-12 text-ink-subtle press-feedback hover:border-hairline tablet:flex desktop:w-[300px]"
              >
                <IconSearch size={14} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" />
                <span className="flex-1 truncate text-left text-body-sm">Search items, seats, tabs</span>
                <kbd className="shrink-0 rounded-sm bg-sunken px-4 font-mono text-micro text-ink-muted">⌘K</kbd>
              </button>
            </>
          }
          centre={<SurfaceSwitcher current="floor" />}
          end={
            <>
              <LiveClock timeZone={outlet?.timezone} />
              <Link href="/floor/shift" aria-label={`${session.displayName}, view shift`} className="flex shrink-0 items-center gap-8 rounded-md p-2 press-feedback hover:bg-control/40">
                <span aria-hidden="true" className="flex size-control-sm items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-label font-medium text-accent-text">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    firstName.slice(0, 1)
                  )}
                </span>
                <span className="hidden min-w-0 text-left tablet:block">
                  <span className="block max-w-[120px] truncate text-body-sm font-medium text-ink">{firstName}</span>
                  <span className="block max-w-[120px] truncate text-micro text-ink-subtle">{session.roleKey}</span>
                </span>
              </Link>
            </>
          }
        />

        <UpdateBar />

        {/* A flex column, so a page's own scroll region has a height to scroll inside. */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>

        <Dock
          label="Floor"
          actionRef={setActionTarget}
          nav={
            <>
              {nav.map((item) => (
                <DockLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
              ))}
              <DockButton label="Search items, seats, tabs" icon={IconSearch} onClick={() => setSearchOpen(true)} shortcut="⌘K" />
            </>
          }
        />
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <LiveRegion>{sync.announcements.join(' ')}</LiveRegion>
    </BaseLayerContext.Provider>
  );
}
