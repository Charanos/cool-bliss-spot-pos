import { formatIsoDate } from '@bliss/shared/format';
import { cx } from '@bliss/ui/lib/cx';
import { ConsoleMotionRoot, ConsolePage, type StationLink, type WorkspaceLink } from '@bliss/ui/components/console/shell';
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
import { DeskNav } from './_components/shell/desk-nav';
import { SheetHeader } from './_components/shell/sheet-header';

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
  const actor = await identity.currentConsoleActor();
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
    { href: '/console/people', label: 'People & Zoning', icon: icon(IconUsers), section: 'Management & System' },
    { href: '/console/reports', label: 'Reports', icon: icon(IconChartBar), section: 'Management & System' },
    { href: '/console/settings', label: 'Settings', icon: icon(IconSettings), count: sync.unresolvedCount() || undefined, countTone: 'stop', section: 'Management & System' },
  ];

  const stations: StationLink[] = [
    { href: '/floor', label: 'Floor station', icon: <IconDeviceTablet size={18} stroke={1.5} />, subtitle: 'Waiter' },
    { href: '/counter', label: 'Counter station', icon: <IconCash size={18} stroke={1.5} />, subtitle: 'Cashier' },
  ];

  const tonightDate = clock.current;
  const tonightHeadline = reporting.headline(tonightDate);
  const tonightHours = reporting.salesByHour(tonightDate);
  
  const tonight = {
    sales: tonightHeadline.netSales,
    bills: tonightHeadline.tabs,
    open: trade.openTabs().length,
    hours: tonightHours.map(h => Number(h.value))
  };

  return (
    <ConsoleMotionRoot>
      <div className="flex h-dvh w-full bg-desk overflow-hidden">
        <DeskNav
          links={links}
          stations={stations}
          tonight={tonight}
          footer={
            <div className="flex flex-col pt-8 gap-12 group-data-[collapsed]/nav:gap-0">
              <Link
                href="/console/people"
                className="group flex items-center rounded-[12px] hover:bg-desk-hover transition-all duration-200 press-feedback gap-12 -mx-8 px-8 py-8 group-data-[collapsed]/nav:justify-center group-data-[collapsed]/nav:p-0"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="shrink-0 rounded-full object-cover ring-2 ring-desk shadow-sm size-[40px] group-data-[collapsed]/nav:size-[32px] transition-all duration-300"
                  />
                ) : (
                  <span className="flex shrink-0 items-center justify-center rounded-full bg-desk-hover font-medium text-desk-ink ring-2 ring-desk shadow-sm size-[40px] text-subtitle group-data-[collapsed]/nav:size-[32px] group-data-[collapsed]/nav:text-[12px] transition-all duration-300">
                    {actor.staff.displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                
                <div className="min-w-0 flex-1 flex flex-col justify-center transition-opacity duration-300 group-data-[collapsed]/nav:hidden group-data-[collapsed]/nav:opacity-0">
                  <span className="block truncate text-[14px] font-semibold text-desk-ink leading-tight mb-[2px]">
                    {actor.staff.displayName}
                  </span>
                  <span className="block truncate text-[12px] font-medium text-desk-muted group-hover:text-desk-ink transition-colors">
                    {actor.role.name}
                  </span>
                </div>
                <div className="flex items-center justify-center size-[24px] rounded-full bg-desk-hover/50 group-hover:bg-desk-muted/10 transition-colors shrink-0 group-data-[collapsed]/nav:hidden group-data-[collapsed]/nav:opacity-0">
                  <IconChevronRight
                    size={14}
                    stroke={2.5}
                    className="text-desk-muted group-hover:text-desk-ink transition-colors"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </div>
          }
        />
        
        {/* Floating Sheet */}
        <div className="flex-1 p-inset-sheet min-w-0 flex flex-col h-dvh overflow-hidden">
          <div 
            id="sheet-scroll-container" 
            className="flex-1 w-full max-w-[1400px] mx-auto rounded-[24px] bg-page shadow-[0_8px_40px_rgba(0,0,0,0.06)] flex flex-col relative overflow-y-auto no-scrollbar ring-1 ring-hairline/20"
          >
            <SheetHeader
              businessDate={formatIsoDate(clock.current)}
              tradingInProgress={clock.tradingInProgress}
              onlineDevices={online}
              totalDevices={devices.length}
              heldOrders={holding.reduce((n, d) => n + d.unsyncedCount, 0)}
              syncState={holding.length > 0 ? 'offline' : 'synced'}
              theme={theme}
            />
            <main className="flex-1 flex flex-col relative z-0">
              <ConsolePage>{children}</ConsolePage>
            </main>
          </div>
        </div>
      </div>
    </ConsoleMotionRoot>
  );
}
