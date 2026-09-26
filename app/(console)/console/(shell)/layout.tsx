import { formatDayShort } from '@bliss/shared/format';
import { ConsoleMotionRoot, ConsolePage } from '@bliss/ui/components/console/shell';
import {
  IconBuildingStore,
  IconChartBar,
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
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as reporting from '@/modules/reporting/service';
import * as sync from '@/modules/sync/service';
import * as trade from '@/modules/trade/service';
import { CommandMenu } from './_components/shell/command-menu';
import { CrumbProvider } from './_components/shell/crumbs';
import { Rail, type RailGroup, type RailItem } from './_components/shell/rail';
import { TopBar } from './_components/shell/top-bar';
import type { ThemePreference } from './_actions/settings';
import { NAV_GROUPS, WORKSPACES, type WorkspaceKey } from './_lib/nav';

export const dynamic = 'force-dynamic';

const ICONS: Record<WorkspaceKey, typeof IconChartBar> = {
  overview: IconLayoutDashboard,
  trade: IconReceipt2,
  inventory: IconPackage,
  purchasing: IconTruckDelivery,
  catalogue: IconBuildingStore,
  pricing: IconTags,
  reports: IconChartBar,
  people: IconUsers,
  settings: IconSettings,
};

/**
 * The Console shell. docs/19 section 4: the rail (venue, search, workspaces, account), the top bar
 * (where you are, the stations), the page column, and the command menu. Everything it names comes
 * from the nav manifest; every count comes from the services, read once per request.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  // The Console reads the outlet as last committed, whichever server instance wrote it.
  await fresh();
  const jar = await cookies();
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const clock = reporting.clock();
  const devices = identity.devices().filter((d) => d.status === 'active');
  const raw = jar.get('bliss-console-theme')?.value;
  const theme: ThemePreference = raw === 'dark' || raw === 'system' ? raw : 'light';

  const counts: Partial<Record<WorkspaceKey, { count: number; tone?: RailItem['tone'] }>> = {
    trade: { count: trade.openTabs().length },
    inventory: { count: inventory.activeHolds().length + inventory.counts().filter((c) => c.status === 'review').length, tone: 'attention' },
    purchasing: { count: procurement.reorderSuggestions().length },
    settings: { count: sync.unresolvedCount(), tone: 'stop' },
  };

  const visible = WORKSPACES.filter((w) => !w.permission || identity.can(actor.staffId, w.permission));
  const item = (key: WorkspaceKey): RailItem => {
    const w = WORKSPACES.find((x) => x.key === key)!;
    const Glyph = ICONS[key];
    const c = counts[key];
    return { href: w.href, label: w.label, icon: <Glyph size={16} stroke={1.5} />, count: c?.count || undefined, tone: c?.count ? c.tone : undefined };
  };
  const groups: RailGroup[] = NAV_GROUPS.map((g) => ({ label: g.label, items: visible.filter((w) => w.group === g.key).map((w) => item(w.key)) })).filter((g) => g.items.length > 0);

  return (
    <ConsoleMotionRoot>
      <CrumbProvider>
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-16 focus:top-12 focus:z-toast focus:rounded-md focus:bg-card focus:px-12 focus:py-8 focus:text-body-sm focus:text-ink focus:shadow-popover">
          Skip to content
        </a>
        <div className="flex min-h-dvh min-w-frame-min">
          <Rail
            venue={{ name: outlet.name, day: formatDayShort(clock.current), trading: clock.tradingInProgress }}
            groups={groups}
            settings={item('settings')}
            account={{ name: actor.staff.displayName, role: actor.role.name, photo: actor.staff.avatarUrl, theme }}
            initialCollapsed={jar.get('bliss-console-rail')?.value === 'collapsed'}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              timezone={outlet.timezone}
              stations={devices.map((d) => ({ id: d.id, label: d.label, kind: d.kind, online: d.online, lastSeenAt: d.lastSeenAt, unsynced: d.unsyncedCount }))}
            />
            <main id="content" tabIndex={-1} className="flex-1 outline-none">
              <ConsolePage>{children}</ConsolePage>
            </main>
          </div>
        </div>
        <CommandMenu theme={theme} />
      </CrumbProvider>
    </ConsoleMotionRoot>
  );
}
