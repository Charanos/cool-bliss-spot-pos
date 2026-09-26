import { formatDayShort } from '@bliss/shared/format';
import { ConsoleMotionRoot, ConsolePage, ConsoleSheet } from '@bliss/ui/components/console/shell';
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
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { CommandMenu } from './_components/shell/command-menu';
import { CrumbProvider } from './_components/shell/crumbs';
import { DeskNav, type DeskGroup, type DeskItem } from './_components/shell/desk-nav';
import { SHEET_SCROLL_ID, SheetHeader } from './_components/shell/sheet-header';
import type { ThemePreference } from './_actions/settings';
import { navCounts } from './_lib/counts';
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
 * The Console shell. docs/19 section 4: the navigation on a sunken desk, and the page on one
 * floating sheet beside it, with the sheet's header (where you are, the workspace's views, the
 * stations) riding at its top. Everything it names comes from the nav manifest; every count comes
 * from `navCounts`, read once per request.
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
  const counts = navCounts();

  const visible = WORKSPACES.filter((w) => !w.permission || identity.can(actor.staffId, w.permission));
  const item = (key: WorkspaceKey): DeskItem => {
    const w = WORKSPACES.find((x) => x.key === key)!;
    const Glyph = ICONS[key];
    const c = counts.workspaces[key];
    return { href: w.href, label: w.label, icon: <Glyph size={16} stroke={1.5} />, count: c?.count || undefined, tone: c?.count ? c.tone : undefined };
  };
  const groups: DeskGroup[] = NAV_GROUPS.map((g) => ({ label: g.label, items: visible.filter((w) => w.group === g.key).map((w) => item(w.key)) })).filter((g) => g.items.length > 0);
  const icons = Object.fromEntries(
    WORKSPACES.map((w) => {
      const Glyph = ICONS[w.key];
      return [w.href, <Glyph key={w.key} size={16} stroke={1.5} />];
    }),
  );

  // Tonight while the business day trades; the night before once it has closed.
  const night = clock.tradingInProgress ? clock.current : clock.lastNight;
  const byHour = reporting.salesByHour(night);
  const figures = byHour.map((h) => Number(h.value));
  const peakAt = figures.indexOf(Math.max(...figures));
  const tonight = {
    label: clock.tradingInProgress ? 'Tonight' : 'Last night',
    netSales: settlement.netSales(night),
    bills: settlement.billsOn(night).filter((b) => b.status === 'settled').length,
    openTabs: trade.openTabs().length,
    byHour: figures,
    peakHour: figures[peakAt] ? byHour[peakAt]!.hour : null,
  };

  return (
    <ConsoleMotionRoot scrollerId={SHEET_SCROLL_ID}>
      <CrumbProvider>
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-16 focus:top-12 focus:z-toast focus:rounded-md focus:bg-card focus:px-12 focus:py-8 focus:text-body-sm focus:text-ink focus:shadow-popover">
          Skip to content
        </a>
        <div className="flex h-dvh min-w-frame-min overflow-hidden bg-desk">
          <DeskNav
            venue={{ name: outlet.name, day: formatDayShort(clock.current), trading: clock.tradingInProgress }}
            groups={groups}
            settings={item('settings')}
            account={{ name: actor.staff.displayName, role: actor.role.name, photo: actor.staff.avatarUrl, theme }}
            tonight={tonight}
            initialCollapsed={jar.get('bliss-console-rail')?.value === 'collapsed'}
          />
          <ConsoleSheet
            scrollerId={SHEET_SCROLL_ID}
            header={
              <SheetHeader
                timezone={outlet.timezone}
                icons={icons}
                counts={counts.pages}
                stations={devices.map((d) => ({ id: d.id, label: d.label, kind: d.kind, online: d.online, lastSeenAt: d.lastSeenAt, unsynced: d.unsyncedCount }))}
              />
            }
          >
            <main id="content" tabIndex={-1} className="flex-1 outline-none">
              <ConsolePage scrollerId={SHEET_SCROLL_ID}>{children}</ConsolePage>
            </main>
          </ConsoleSheet>
        </div>
        <CommandMenu theme={theme} />
      </CrumbProvider>
    </ConsoleMotionRoot>
  );
}
