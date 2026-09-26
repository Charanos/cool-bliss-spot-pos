import { addDays } from '@bliss/shared/time';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { type StaffRow, StaffTable } from './staff-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const actor = await identity.currentConsoleActor();
  const clock = reporting.clock();
  const shifts = trade.shiftsBetween(addDays(clock.current, -27), clock.current);
  const devices = identity.devices();

  const rows: StaffRow[] = identity.staffList().map((s) => {
    const own = shifts.filter((x) => x.staffId === s.id).sort((a, b) => b.startedAt - a.startedAt);
    const role = identity.roleFor(s.id);
    return {
      id: s.id,
      name: s.fullName,
      displayName: s.displayName,
      colourIndex: s.colourIndex,
      roleId: s.roleId,
      role: role?.name ?? '',
      status: s.employmentStatus,
      pinState: identity.pinState(s),
      avatarUrl: s.avatarUrl,
      contactNumber: s.contactNumber,
      pinLocked: identity.pinLocked(s.id),
      lastShiftAt: own[0]?.startedAt ?? null,
      shifts: own.length,
      signedInOn: devices.filter((d) => d.signedInStaffId === s.id).map((d) => d.label),
      isSelf: s.id === actor.staffId,
    };
  });

  return (
    <>
      <ViewHeader page="/console/people/staff" />

    <StaffTable
      rows={rows}
      roles={identity.roles().map((r) => ({ value: r.id, label: r.name }))}
      canManage={identity.can(actor.staffId, 'staff.manage')}
      timezone={identity.outlet().timezone}
    />
    </>
  );
}
