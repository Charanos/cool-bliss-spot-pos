import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { type ShiftRow, ShiftsTable } from './shifts-table';

export const metadata: Metadata = { title: 'Shifts' };

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', supervisor: 'Supervisor', cashier: 'Cashier', waiter: 'Waiter', stock_controller: 'Stock controller' };

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '1');
  const outlet = identity.outlet();
  const rows: ShiftRow[] = trade
    .shiftsBetween(range.from, range.to)
    .map((s) => ({
      id: s.id,
      businessDate: s.businessDate,
      staff: identity.displayName(s.staffId),
      staffId: s.staffId,
      role: ROLE_LABEL[s.roleAtShift] ?? s.roleAtShift,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      handoverTo: s.handoverTo ? identity.displayName(s.handoverTo) : null,
      tabsOpened: s.tabsOpened,
      tabsHandedOver: s.tabsHandedOver,
      sales: s.salesCents,
      voids: s.voidsCents,
      discounts: s.discountsCents,
      open: s.status === 'open',
    }));

  return (
    <ShiftsTable
      rows={rows}
      timezone={outlet.timezone}
      rangeOptions={rangeOptions(true)}
      rangeKey={range.key}
      staff={[...new Map(rows.map((r) => [r.staffId, r.staff])).entries()].map(([value, label]) => ({ value, label }))}
      exportDate={range.to}
    />
  );
}
