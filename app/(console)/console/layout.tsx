import { formatIsoDate } from '@bliss/shared/format';
import { ConsoleMotionRoot, ConsolePage, ConsoleRail, type WorkspaceLink } from '@bliss/ui/components/console/shell';
import { ConnectionChip } from '@bliss/ui/components/connection-chip';
import {
  IconBuildingStore,
  IconChartBar,
  IconCoins,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt2,
  IconSettings,
  IconTags,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as reporting from '@/modules/reporting/service';
import * as sync from '@/modules/sync/service';
import * as trade from '@/modules/trade/service';
import { ThemeToggle } from './_components/theme-toggle';

export const dynamic = 'force-dynamic';

const icon = (Glyph: typeof IconChartBar) => <Glyph size={20} stroke={1.5} />;

/**
 * The Console shell. docs/06-design-system.md section 7.4: a 220px rail of workspaces, the page, and
 * a base layer with the outlet, the business date and the devices online. Every tab is a route.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get('bliss-console-theme')?.value === 'dark' ? 'dark' : 'light';
  const outlet = identity.outlet();
  const actor = identity.currentConsoleActor();
  const clock = reporting.clock();
  const devices = identity.devices();
  const online = devices.filter((d) => d.online).length;
  const holding = devices.filter((d) => !d.online && d.status === 'active' && d.unsyncedCount > 0);
  const counting = inventory.counts().filter((c) => c.status === 'counting' || c.status === 'review').length;

  const links: WorkspaceLink[] = [
    { href: '/console/overview', label: 'Overview', icon: icon(IconLayoutDashboard) },
    { href: '/console/trade', label: 'Trade', icon: icon(IconReceipt2), count: trade.openTabs().length || undefined },
    { href: '/console/inventory', label: 'Inventory', icon: icon(IconPackage), count: inventory.activeHolds().length + counting || undefined, countTone: 'attention' },
    { href: '/console/purchasing', label: 'Purchasing', icon: icon(IconTruckDelivery), count: procurement.reorderSuggestions().length || undefined },
    { href: '/console/catalogue', label: 'Catalogue', icon: icon(IconBuildingStore) },
    { href: '/console/pricing', label: 'Pricing', icon: icon(IconTags) },
    { href: '/console/people', label: 'People', icon: icon(IconUsers) },
    { href: '/console/reports', label: 'Reports', icon: icon(IconChartBar) },
    { href: '/console/settings', label: 'Settings', icon: icon(IconSettings), count: sync.unresolvedCount() || undefined, countTone: 'stop' },
  ];

  return (
    <ConsoleMotionRoot>
      <div className="flex min-h-dvh">
        <ConsoleRail
          links={links}
          footer={
            <div className="flex flex-col gap-12 px-4">
              <div className="flex items-center gap-12">
                <span className="flex size-control-md shrink-0 items-center justify-center rounded-sm bg-control text-body-sm text-ink">{actor.staff.displayName.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate text-body text-ink">{actor.staff.displayName}</span>
                  <span className="block truncate text-body-sm text-ink-subtle">{actor.role.name}</span>
                </span>
              </div>
              <ThemeToggle theme={theme} />
              <span className="pb-4 text-body-sm text-ink-subtle">
                <IconCoins size={14} stroke={1.5} className="mr-4 inline" aria-hidden="true" />
                KES, prices include VAT
              </span>
            </div>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
            <ConsolePage>{children}</ConsolePage>
          </main>
          <footer className="sticky bottom-0 z-10 flex h-base-console items-center gap-16 border-t border-hairline bg-page px-32 text-body-sm text-ink-subtle">
            <span className="text-ink-muted">{outlet.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              Business date <span className="font-mono tabular text-num-sm text-ink-muted">{formatIsoDate(clock.current)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-mono tabular text-num-sm text-ink-muted">{online}</span> {online === 1 ? 'device' : 'devices'} online
            </span>
            {holding.length > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <ConnectionChip state="offline" heldOrders={holding.reduce((n, d) => n + d.unsyncedCount, 0)} className="[&_span:last-child]:text-body-sm" />
                <span className="text-info">on {holding.map((d) => d.label).join(', ')}</span>
              </>
            ) : null}
          </footer>
        </div>
      </div>
    </ConsoleMotionRoot>
  );
}
