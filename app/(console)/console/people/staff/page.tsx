import { addDays } from '@bliss/shared/time';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { type StaffRow, StaffTable } from './staff-table';

export const metadata: Metadata = { title: 'Staff' };

export default function StaffPage() {
  const actor = identity.currentConsoleActor();
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
      pinLocked: s.pinLockedUntil !== null && s.pinLockedUntil > clock.now,
      lastShiftAt: own[0]?.startedAt ?? null,
      shifts: own.length,
      signedInOn: devices.filter((d) => d.signedInStaffId === s.id).map((d) => d.label),
      isSelf: s.id === actor.staffId,
    };
  });

  return (
    <StaffTable
      rows={rows}
      roles={identity.roles().map((r) => ({ value: r.id, label: r.name }))}
      canManage={identity.can(actor.staffId, 'staff.manage')}
      timezone={identity.outlet().timezone}
    />
  );
}
