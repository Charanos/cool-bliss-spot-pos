import { formatIsoDate } from '@bliss/shared/format';
import { ConsoleMotionRoot, ConsolePage, ConsoleRail, type StationLink, type WorkspaceLink } from '@bliss/ui/components/console/shell';
import {
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconChevronRight,
  IconDeviceTablet,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt2,
  IconSettings,
  IconTags,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as reporting from '@/modules/reporting/service';
import { fresh } from '@/modules/_data/store';
import * as sync from '@/modules/sync/service';
import * as trade from '@/modules/trade/service';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { ThemeToggle } from './_components/theme-toggle';
import { ConsoleTopBar } from './_components/top-bar';

export const dynamic = 'force-dynamic';

const icon = (Glyph: typeof IconChartBar) => <Glyph size={18} stroke={1.5} />;

/**
 * The Console shell. docs/06-design-system.md section 7.4: a 220px rail of workspaces,
 * a frosted command masthead, the page surface, and a base telemetry layer.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  // The Console reads the outlet as last committed, whichever server instance wrote it.
  await fresh();
  const theme = (await cookies()).get('bliss-console-theme')?.value === 'dark' ? 'dark' : 'light';
  const outlet = identity.outlet();
  const actor = identity.currentConsoleActor();
  const clock = reporting.clock();
  const devices = identity.devices();
  const online = devices.filter((d) => d.online).length;
  const holding = devices.filter((d) => !d.online && d.status === 'active' && d.unsyncedCount > 0);
  const counting = inventory.counts().filter((c) => c.status === 'counting' || c.status === 'review').length;
  const photo = staffPhoto(actor.staff.displayName);

  const links: WorkspaceLink[] = [
    { href: '/console/overview', label: 'Overview', icon: icon(IconLayoutDashboard), section: 'Operations' },
    { href: '/console/trade', label: 'Trade', icon: icon(IconReceipt2), count: trade.openTabs().length || undefined, section: 'Operations' },
    { href: '/console/inventory', label: 'Inventory', icon: icon(IconPackage), count: inventory.activeHolds().length + counting || undefined, countTone: 'attention', section: 'Operations' },
    { href: '/console/purchasing', label: 'Purchasing', icon: icon(IconTruckDelivery), count: procurement.reorderSuggestions().length || undefined, section: 'Operations' },
    { href: '/console/catalogue', label: 'Catalogue', icon: icon(IconBuildingStore), section: 'Catalogue & Pricing' },
    { href: '/console/pricing', label: 'Pricing', icon: icon(IconTags), section: 'Catalogue & Pricing' },
    { href: '/console/people', label: 'People', icon: icon(IconUsers), section: 'Management & System' },
    { href: '/console/reports', label: 'Reports', icon: icon(IconChartBar), section: 'Management & System' },
    { href: '/console/settings', label: 'Settings', icon: icon(IconSettings), count: sync.unresolvedCount() || undefined, countTone: 'stop', section: 'Management & System' },
  ];

  const stations: StationLink[] = [
    { href: '/floor', label: 'Floor station', icon: <IconDeviceTablet size={18} stroke={1.5} />, subtitle: 'Waiter' },
    { href: '/counter', label: 'Counter station', icon: <IconCash size={18} stroke={1.5} />, subtitle: 'Cashier' },
  ];

  return (
    <ConsoleMotionRoot>
      <div className="flex min-h-dvh">
        <ConsoleRail
          links={links}
          stations={stations}
          footer={
            <div className="flex flex-col gap-12">

              {/* ── Profile Card: tap → /console/people ─────────── */}
              <Link
                href="/console/people"
                className="group flex items-center gap-12 -mx-12 px-12 py-8 rounded-[10px] hover:bg-control/50 transition-all duration-150 press-feedback"
              >
                {/* Avatar */}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="size-[36px] shrink-0 rounded-full object-cover ring-1 ring-hairline/20 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                  />
                ) : (
                  <span className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-control-hover text-subtitle font-medium text-ink ring-1 ring-hairline/20 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    {actor.staff.displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}

                {/* Name + Role */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-ink leading-snug">
                    {actor.staff.displayName}
                  </span>
                  <span className="block truncate text-micro text-ink-subtle group-hover:text-ink transition-colors">
                    {actor.role.name}
                  </span>
                </div>

                {/* Navigate affordance */}
                <IconChevronRight
                  size={16}
                  stroke={1.5}
                  className="shrink-0 text-ink-disabled group-hover:text-ink-subtle transition-colors ml-auto"
                  aria-hidden="true"
                />
              </Link>

              {/* Theme Toggle */}
              <ThemeToggle theme={theme} />

              {/* Venue · Terminal */}
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-ink-disabled pt-8 border-t border-hairline/40">
                <span>KES · VAT incl.</span>
                <span>Station #1</span>
              </div>

            </div>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <ConsoleTopBar
            outletName={outlet.name}
            businessDate={formatIsoDate(clock.current)}
            tradingInProgress={clock.tradingInProgress}
            onlineDevices={online}
            totalDevices={devices.length}
            heldOrders={holding.reduce((n, d) => n + d.unsyncedCount, 0)}
            syncState={holding.length > 0 ? 'offline' : 'synced'}
          />
          <main className="flex-1">
            <ConsolePage>{children}</ConsolePage>
          </main>
        </div>
      </div>
    </ConsoleMotionRoot>
  );
}
