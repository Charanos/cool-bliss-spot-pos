'use client';

import { formatElapsed, formatTime } from '@bliss/shared/format';
import { Avatar } from '@bliss/ui/components/atmosphere';
import { BlissMark } from '@bliss/ui/components/brand';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot, Signal } from '@bliss/ui/components/status';
import { LiveRegion } from '@bliss/ui/components/surface';
import { CountBadge } from '@bliss/ui/components/working';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconBeer, IconCash, IconLogout, IconReceipt, IconReceipt2, IconShoppingBag } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { BaseLayerContext } from '@/app/_pos/base-layer';
import { useCounterTabs, useDrawerState, useTickets } from '@/lib/pos/counter-queries';
import { useOutlet } from '@/lib/pos/queries';
import { signOut, useSession } from '@/lib/pos/session';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { useSync } from '@/lib/pos/sync';

interface NavItem {
  href: string;
  label: string;
  icon: TablerIcon;
  count?: number;
  tone?: 'accent' | 'stop';
  dot?: boolean;
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname.startsWith(item.href);
  const Glyph = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cx('relative flex h-nav-item w-full flex-col items-center justify-center gap-4 press-feedback', active ? 'bg-accent-wash text-accent-text' : 'text-ink-subtle hover:text-ink')}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-[12px] left-0 w-[3px] rounded-r-sm bg-accent" /> : null}
      <span className="relative">
        <Glyph size={24} stroke={ICON_STROKE} aria-hidden="true" />
        {item.count ? <CountBadge count={item.count} tone={item.tone ?? 'accent'} className="absolute -right-[14px] -top-[8px]" /> : null}
        {item.dot ? (
          <span className="absolute -right-[6px] -top-[2px]">
            <Dot tone="low" />
          </span>
        ) : null}
      </span>
      <span className="text-label">
        {item.label}
        {item.count ? <span className="sr-only">, {item.count}</span> : null}
        {item.dot ? <span className="sr-only">, needs opening</span> : null}
      </span>
    </Link>
  );
}

/**
 * The Counter shell. docs/14 section 5: a 72px rail of the Counter's views, the view, and a 72px base
 * layer with the person, the drawer, the connection, and the view's primary action on the right. One
 * layout for a tablet and a desktop at the counter.
 */
export function CounterShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const sync = useSync();
  const hydrated = useHydrated();
  const now = useNow(30_000);
  const outlet = useOutlet();
  const tickets = useTickets();
  const tabs = useCounterTabs();
  const drawer = useDrawerState();
  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (session === null) router.replace('/counter/sign-in');
  }, [session, router]);

  if (!session) return <div className="h-dvh bg-page" aria-busy="true" />;

  const waiting = tickets?.waiting.length ?? 0;
  const ranOut = tickets?.waiting.some((t) => t.ranOut > 0) ?? false;
  const drawerOpen = Boolean(drawer?.open && drawer.open.status === 'open');
  const link = sync.link === 'synced' ? 'synced' : sync.link === 'sending' ? 'sending' : sync.link === 'offline' ? 'offline' : 'unreachable';
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const nav: NavItem[] = [
    { href: '/counter/orders', label: 'Orders', icon: IconBeer, count: waiting || undefined, tone: ranOut ? 'stop' : 'accent' },
    { href: '/counter/tabs', label: 'Tabs', icon: IconReceipt2, count: tabs?.length || undefined, tone: 'accent' },
    { href: '/counter/sale', label: 'Quick sale', icon: IconShoppingBag },
    { href: '/counter/drawer', label: 'Drawer', icon: IconCash, dot: drawer !== undefined && !drawer.open },
    { href: '/counter/bills', label: 'Bills', icon: IconReceipt },
  ];

  return (
    <BaseLayerContext.Provider value={actionTarget}>
      <div className="grid h-dvh grid-cols-[72px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_72px] bg-page">
        <nav aria-label="Counter" className="row-span-2 flex flex-col items-center border-r border-hairline pb-12 pt-16">
          <Link href="/counter/orders" aria-label="Bliss Counter, orders" className="mb-16 flex size-control-lg items-center justify-center rounded-md">
            <BlissMark size={32} />
          </Link>
          <div className="flex w-full flex-col">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-8">
            <Avatar size="sm" src={staffPhoto(session.displayName)} name={session.displayName} />
            <button
              type="button"
              aria-label={`Sign ${session.displayName} out of this counter`}
              onClick={() => void signOut().then(() => router.replace('/counter/sign-in'))}
              className="flex size-control-lg items-center justify-center rounded-md text-ink-subtle press-feedback hover:bg-control hover:text-ink"
            >
              <IconLogout size={20} stroke={ICON_STROKE} aria-hidden="true" />
            </button>
          </div>
        </nav>

        <main className="min-h-0 min-w-0 overflow-hidden">{children}</main>

        <footer className="flex min-w-0 items-center border-t border-rule-raised bg-sunken">
          <div className="flex min-w-0 flex-1 items-center gap-16 px-16">
            <span className="shrink-0 text-body font-medium text-ink">{session.displayName}</span>
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
            <span className="shrink-0 font-mono tabular text-num text-ink-muted" suppressHydrationWarning>
              {formatElapsed(Math.max(0, (hydrated ? now : session.signedInAt) - session.signedInAt))}
            </span>
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
            {drawer === undefined ? null : drawerOpen ? (
              <Signal tone="poured" className="shrink-0 text-body text-ink-muted">
                Drawer open since {formatTime(drawer.open!.openedAt, tz)}
              </Signal>
            ) : drawer.open ? (
              <Signal tone="info" className="shrink-0 text-body">
                Drawer being counted
              </Signal>
            ) : (
              <Signal tone="low" className="shrink-0 text-body">
                Drawer not open
              </Signal>
            )}
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
            <ConnectionChip state={link} heldOrders={sync.heldOrders} compact />
            {sync.rejected > 0 ? (
              <span className="min-w-0 truncate text-body text-stop" title="A manager can see why in Console, Settings, Sync.">
                {sync.rejected} {sync.rejected === 1 ? 'change' : 'changes'} could not be sent
              </span>
            ) : null}
          </div>
          <div ref={setActionTarget} className="flex h-full shrink-0 items-center justify-end gap-12 px-16" />
        </footer>
      </div>
      <LiveRegion>{sync.announcements.join(' ')}</LiveRegion>
    </BaseLayerContext.Provider>
  );
}
