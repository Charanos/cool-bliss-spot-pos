'use client';

import { formatTime } from '@bliss/shared/format';
import { AmbientCounterArtwork } from '@bliss/ui/components/artwork/counter-workspace';
import { Eyebrow } from '@bliss/ui/components/atmosphere';
import { BlissMark } from '@bliss/ui/components/brand';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { LiveRegion } from '@bliss/ui/components/surface';
import { cx } from '@bliss/ui/lib/cx';
import { IconBeer, IconCash, IconLayoutGrid, IconLogout, IconHistory, IconReceipt2, IconSearch, IconShoppingBag } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BaseLayerContext } from '@/app/_pos/base-layer';
import { Dock, type DockItem, DockLink, LiveClock, SurfaceSwitcher, TopBar } from '@/app/_pos/chrome';
import { UpdateBar } from '@/app/_pos/update-bar';
import { useCounterWatch } from '@/app/_pos/watchers';
import { useCounterTabs, useDrawerState, useTickets } from '@/lib/pos/counter-queries';
import { useOutlet } from '@/lib/pos/queries';
import { signOut, useDevice, useSession } from '@/lib/pos/session';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { useSync } from '@/lib/pos/sync';

/**
 * The Counter shell. The same chrome as the Floor (app/_pos/chrome.tsx) with the Counter's own
 * contents, so moving between the two stations mid-shift costs nobody a second to find their way.
 *
 *   top bar   the station, a tab finder, the surface switcher, the drawer, the link, the person
 *   view      one page, its own scroll region
 *   dock      Orders, Tabs, Quick sale, Drawer, Bills, and the page's action beside them
 *
 * The Counter runs on a tablet or on a desktop monitor. The dock keeps the page's action in its own
 * row until `tablet`, because settling carries an amount and a 768 tablet needs the width for it.
 * On a keyboard, Alt and a number moves between the five views, and Ctrl K finds a tab.
 */
export function CounterShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const device = useDevice();
  const router = useRouter();
  const pathname = usePathname();
  const sync = useSync();
  const outlet = useOutlet();
  const tickets = useTickets();
  const tabs = useCounterTabs();
  const drawer = useDrawerState();
  const openOrders = useCallback(() => router.push('/counter/orders'), [router]);
  useCounterWatch(tickets?.waiting, pathname.startsWith('/counter/orders'), openOrders);
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (session === null) router.replace('/counter/sign-in');
  }, [session, router]);

  // Alt and a number for the five views, Ctrl or Cmd K to find a tab. Digits alone are left to the
  // tender keypad, which listens for them on the settle and sale screens.
  useEffect(() => {
    const routes = ['/counter/orders', '/counter/tabs', '/counter/sale', '/counter/drawer', '/counter/history'];
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/counter/tabs?find=1');
        return;
      }
      if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        router.push(routes[Number(e.key) - 1]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (!session) return <div className="h-dvh bg-page" aria-busy="true" />;

  const waiting = tickets?.waiting.length ?? 0;
  const ranOut = tickets?.waiting.some((t) => t.ranOut > 0) ?? false;
  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const link = sync.link === 'synced' ? 'synced' : sync.link === 'sending' ? 'sending' : sync.link === 'offline' ? 'offline' : 'unreachable';
  const drawerState: { tone: Tone; short: string; long: string } =
    drawer === undefined
      ? { tone: 'neutral', short: 'Drawer', long: 'Reading the drawer' }
      : !drawer.open
        ? { tone: 'low', short: 'Not open', long: 'Drawer not open' }
        : drawer.open.status === 'open'
          ? { tone: 'poured', short: `Open ${formatTime(drawer.open.openedAt, tz)}`, long: `Drawer open since ${formatTime(drawer.open.openedAt, tz)}` }
          : { tone: 'info', short: 'Counting', long: 'Drawer being counted' };

  const nav: DockItem[] = [
    { href: '/counter/orders', label: 'Orders', icon: IconBeer, badge: waiting || undefined, badgeTone: ranOut ? 'stop' : 'accent', shortcut: 'Alt 1' },
    { href: '/counter/tabs', label: 'Tabs', icon: IconReceipt2, badge: tabs?.length || undefined, shortcut: 'Alt 2' },
    { href: '/counter/sale', label: 'Sale', icon: IconShoppingBag, shortcut: 'Alt 3' },
    { href: '/counter/drawer', label: 'Drawer', icon: IconCash, dot: drawer === undefined ? undefined : drawerState.tone, dotLabel: drawerState.long, shortcut: 'Alt 4' },
    { href: '/counter/history', label: 'History', icon: IconHistory, shortcut: 'Alt 5' },
  ];

  const photo = staffPhoto(session.displayName);
  const firstName = session.displayName.trim().split(/\s+/)[0] ?? session.displayName;

  return (
    <BaseLayerContext.Provider value={actionTarget}>
      <AmbientCounterArtwork />
      <div className="relative z-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-page/5">
        <TopBar
          start={
            <>
              <Link href="/counter/orders" aria-label="Bliss Counter, orders" className="flex shrink-0 items-center justify-center rounded-md press-feedback">
                <BlissMark size={32} />
              </Link>
              <div className="hidden h-24 w-px bg-rule-raised/60 tablet:block" aria-hidden="true" />
              <Eyebrow as="p" className="hidden desktop:block">
                {device?.label ?? 'Counter'}
              </Eyebrow>
              <Link
                href="/counter/tabs?find=1"
                className="hidden h-control-sm w-[220px] items-center gap-8 rounded-md border border-transparent bg-control px-12 text-ink-subtle press-feedback hover:border-hairline tablet:flex desktop:w-[260px]"
              >
                <IconSearch size={14} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" />
                <span className="flex-1 truncate text-body-sm">Find a tab</span>
                <kbd className="shrink-0 rounded-sm bg-sunken px-4 font-mono text-micro text-ink-muted">⌘K</kbd>
              </Link>
            </>
          }
          centre={<SurfaceSwitcher current="counter" />}
          end={
            <>
              <Link
                href="/counter/drawer"
                aria-label={drawerState.long}
                className={cx(
                  'hidden h-control-sm shrink-0 items-center gap-8 rounded-dot px-12 text-body-sm press-feedback pad:flex',
                  drawerState.tone === 'low' ? 'bg-low/10 text-low hover:bg-low/15' : 'bg-sunken/60 text-ink-muted hover:bg-control hover:text-ink',
                )}
              >
                <Dot tone={drawerState.tone} />
                <span className="whitespace-nowrap">{drawerState.short}</span>
              </Link>
              <span className="hidden tablet:block">
                <ConnectionChip state={link} heldOrders={sync.heldOrders} compact />
              </span>
              <LiveClock timeZone={tz} />
              <OverflowMenu
                label={`${session.displayName}, account`}
                align="end"
                trigger={
                  <span aria-hidden="true" className="flex size-control-sm items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-label font-medium text-accent-text">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      firstName.slice(0, 1)
                    )}
                  </span>
                }
                items={[
                  { key: 'floor', label: 'Switch to the Floor', icon: IconLayoutGrid, onSelect: () => router.push('/floor/tabs') },
                  { key: 'out', label: `Sign ${firstName} out`, icon: IconLogout, destructive: true, onSelect: () => void signOut().then(() => router.replace('/counter/sign-in')) },
                ]}
              />
            </>
          }
        />

        <UpdateBar />

        {sync.rejected > 0 ? (
          <p role="status" className="safe-x flex shrink-0 items-center gap-8 border-b border-stop/30 bg-stop-wash py-8 text-body-sm text-stop [--bliss-gutter-x:12px] pad:[--bliss-gutter-x:24px]">
            <Dot tone="stop" />
            {sync.rejected} {sync.rejected === 1 ? 'change' : 'changes'} could not be sent. A manager can see why in Console, Settings, Sync.
          </p>
        ) : null}

        <main className="page-flow relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>

        <Dock label="Counter" inlineFrom="tablet" actionRef={setActionTarget} nav={nav.map((item) => <DockLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)} />
      </div>
      <LiveRegion>{sync.announcements.join(' ')}</LiveRegion>
    </BaseLayerContext.Provider>
  );
}
