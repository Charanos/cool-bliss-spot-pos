import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { OpenTabsTable, type OpenTabRow } from './open-tabs-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Open tabs' };

/** Every tab still open on the floor, oldest first: the one that has been open longest is the one to ask about. */
export default function OpenTabsPage() {
  const outlet = identity.outlet();
  const clock = reporting.clock();
  const rows: OpenTabRow[] = trade.openTabs().map((s) => ({
    id: s.tab.id,
    number: s.tab.tabNumber,
    table: s.tableLabel,
    zone: s.zoneName,
    zoneId: s.tab.zoneId,
    waiter: identity.displayName(s.tab.assignedTo),
    waiterId: s.tab.assignedTo,
    openedAt: s.tab.openedAt,
    businessDate: s.tab.businessDate,
    guests: s.tab.guestCount,
    seats: s.seats.filter((x) => x.status !== 'removed').map((x) => ({ seatNo: x.seatNo, label: x.label, settled: x.status === 'settled' })),
    lines: s.lineCount,
    pending: s.pendingCount,
    lastFiredAt: s.lastFiredAt,
    total: s.total,
    partSettled: s.tab.status === 'part_settled',
  }));

  return (
    <>
      <ViewHeader page="/console/trade/open" />

    <OpenTabsTable
      rows={rows}
      now={clock.now}
      currentBusinessDate={clock.current}
      timezone={outlet.timezone}
      zones={trade.zones().map((z) => ({ value: z.id, label: z.name }))}
      waiters={[...new Map(rows.map((r) => [r.waiterId, r.waiter])).entries()].map(([value, label]) => ({ value, label }))}
    />
    </>
  );
}
