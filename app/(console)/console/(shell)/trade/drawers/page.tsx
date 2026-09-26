import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { type DrawerRow, DrawersTable } from './drawers-table';

export const metadata: Metadata = { title: 'Drawers' };

/**
 * Drawer sessions, newest first. Each row is read through drawerFor, so a session still counting
 * arrives here with no expected figure in it at all. docs/01 R7.
 */
export default async function DrawersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '7');
  const outlet = identity.outlet();
  const devices = identity.devices();

  const rows: DrawerRow[] = settlement
    .drawerSessionsBetween(range.from, range.to)
    .map((s) => settlement.drawerFor(s.businessDate))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => ({
      id: d.id,
      businessDate: d.businessDate,
      device: devices.find((x) => x.id === d.deviceId)?.label ?? '',
      openedBy: identity.displayName(d.openedBy),
      openedAt: d.openedAt,
      float: d.openingFloatCents,
      closedBy: d.closedBy ? identity.displayName(d.closedBy) : null,
      closedAt: d.closedAt,
      counted: d.stage === 'closed' ? d.countedCashCents : null,
      expected: d.stage === 'closed' ? d.expectedCashCents : null,
      variance: d.stage === 'closed' ? d.varianceCents : null,
      reason: d.varianceReason,
      stage: d.stage,
      status: d.status,
    }));

  return (
    <DrawersTable
      rows={rows}
      timezone={outlet.timezone}
      threshold={outlet.drawerVarianceThresholdCents}
      rangeOptions={rangeOptions(true)}
      rangeKey={range.key}
      rangeLabel={range.label}
      exportDate={range.to}
    />
  );
}
