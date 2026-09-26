import type { Shift, Staff } from '@bliss/shared/domain';
import * as pins from '@/modules/identity/pins';
import * as identity from '@/modules/identity/service';
import type { StaffRow } from './staff-table';

/** One person as the list and the record show them. Server only. */
export function staffRow(s: Staff, shifts: readonly Shift[], devices: ReturnType<typeof identity.devices>, actorId: string): StaffRow {
  const own = shifts.filter((x) => x.staffId === s.id).sort((a, b) => b.startedAt - a.startedAt);
  return {
    id: s.id,
    name: s.fullName,
    displayName: s.displayName,
    colourIndex: s.colourIndex,
    roleId: s.roleId,
    role: identity.roleFor(s.id)?.name ?? '',
    status: s.employmentStatus,
    pinState: identity.pinState(s),
    avatarUrl: s.avatarUrl,
    contactNumber: s.contactNumber,
    pinLocked: identity.pinLocked(s.id),
    pin: { status: pins.pinStatus(s), length: s.pinLength ?? 6, setAt: s.pinSetAt ?? null, expiresAt: s.pinExpiresAt ?? null },
    canSetPin: pins.maySetPin(actorId, s),
    lastShiftAt: own[0]?.startedAt ?? null,
    shifts: own.length,
    signedInOn: devices.filter((d) => d.signedInStaffId === s.id).map((d) => d.label),
    isSelf: s.id === actorId,
  };
}
