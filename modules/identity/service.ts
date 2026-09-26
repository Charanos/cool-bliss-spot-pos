import 'server-only';

import type { Device, EmploymentStatus, PermissionKey, Role, Staff } from '@bliss/shared/domain';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { createUuidV7 } from '@bliss/shared/id';
import * as audit from '../audit/service';

const createId = createUuidV7();
import { identityTables } from './schema';

export function outlet() {
  return identityTables().outlet;
}

export function staffList(): Staff[] {
  return identityTables().staff;
}

export function staffById(id: string | null | undefined): Staff | null {
  if (!id) return null;
  return identityTables().staff.find((s) => s.id === id) ?? null;
}

export function displayName(id: string | null | undefined): string {
  return staffById(id)?.displayName ?? 'Unknown';
}

export function roles(): Role[] {
  return identityTables().roles;
}

export function roleFor(staffId: string): Role | null {
  const person = staffById(staffId);
  return person ? (identityTables().roles.find((r) => r.id === person.roleId) ?? null) : null;
}

/** Permission guards live at the service boundary, not in the route handler or the UI. */
export function can(staffId: string, permission: PermissionKey): boolean {
  // A suspended or departed person holds no permission, whatever their role says.
  if (staffById(staffId)?.employmentStatus !== 'active') return false;
  return roleFor(staffId)?.permissions.includes(permission) ?? false;
}

export function assertCan(staffId: string, permission: PermissionKey, doing: string): void {
  if (!can(staffId, permission)) {
    throw new Error(`Your role does not include ${doing}. A manager can do this, or change your permissions.`);
  }
}

export interface DeviceRow extends Device {
  online: boolean;
  lastSeenAt: number | null;
  signedInStaffId: string | null;
  unsyncedCount: number;
  appVersion: string;
}

export function devices(): DeviceRow[] {
  const { devices: list, presence } = identityTables();
  return list.map((d) => {
    const p = presence.find((x) => x.deviceId === d.id);
    return {
      ...d,
      online: d.status === 'active' && Boolean(p?.online),
      lastSeenAt: p?.lastSeenAt ?? d.lastSeenAt,
      signedInStaffId: d.status === 'active' ? (p?.staffId ?? null) : null,
      unsyncedCount: p?.unsyncedCount ?? 0,
      appVersion: p?.appVersion ?? d.appVersion,
    };
  });
}

/**
 * Withdraw a device. docs/08-ux-copy.md: "Floor 3 stops working within a minute. Any orders it is
 * holding can still be recovered." Revocation is a status transition, never a delete.
 */
export function withdrawDevice(input: { deviceId: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'device.manage', 'withdrawing devices');
  const device = identityTables().devices.find((d) => d.id === input.deviceId);
  if (!device) throw new Error('That device is not registered to this outlet.');
  if (device.status === 'lost' || device.status === 'retired') throw new Error(`${device.label} was already withdrawn.`);
  const before = { status: device.status };
  device.status = 'lost';
  device.revokedAt = Date.now();
  device.revokedReason = reason;
  audit.record({
    outletId: device.outletId,
    actorStaffId: actor.staffId,
    action: 'device.revoked',
    entityType: 'device',
    entityId: device.id,
    before,
    after: { status: device.status },
    reason,
    severity: 'sensitive',
  });
  return device;
}

/**
 * The Console session. Custom JWT with email, password and TOTP arrives in Phase 1; until then the
 * development session is the owner, so every permission guard still runs against a real role.
 */
export async function currentConsoleActor(): Promise<Actor & { staff: Staff; role: Role }> {
  try {
    const { cookies } = await import('next/headers');
    const { redirect } = await import('next/navigation');
    const cookieStore = await cookies();
    const staffId = cookieStore.get('bliss-console-session')?.value;
    let staff: Staff | null = null;
    if (staffId) {
      staff = identityTables().staff.find((s) => s.id === staffId) ?? null;
    }
    
    if (!staff) {
      redirect('/console/sign-in');
    }
    
    return { staffId: staff!.id, deviceId: null, staff: staff!, role: roleFor(staff!.id)! };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    const owner = identityTables().staff.find((s) => roleFor(s.id)?.key === 'owner') ?? identityTables().staff[0]!;
    return { staffId: owner.id, deviceId: null, staff: owner, role: roleFor(owner.id)! };
  }
}

/* ---------------------------------------------------------- people and roles */

function activeOwners(): Staff[] {
  const owner = identityTables().roles.find((r) => r.key === 'owner');
  return identityTables().staff.filter((s) => s.roleId === owner?.id && s.employmentStatus === 'active');
}

/** N-09: change a person's role. Audited as sensitive; nobody changes their own role. */
export function setStaffRole(input: { staffId: string; roleId: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'managing staff');
  if (input.staffId === actor.staffId) throw new Error('Ask another manager to change your own role.');
  const person = identityTables().staff.find((s) => s.id === input.staffId);
  const role = identityTables().roles.find((r) => r.id === input.roleId);
  if (!person || !role) throw new Error('That person or role is not part of this outlet.');
  if (person.roleId === role.id) throw new Error(`${person.displayName} is already ${role.name.toLowerCase()}.`);
  const before = roleFor(person.id);
  if (before?.key === 'owner' && activeOwners().length <= 1) throw new Error('The outlet needs at least one active owner. Make someone else owner first.');
  person.roleId = role.id;
  audit.record({ outletId: person.outletId, actorStaffId: actor.staffId, action: 'staff.role_changed', entityType: 'staff', entityId: person.id, before: { role: before?.name ?? null }, after: { role: role.name }, reason, severity: 'sensitive' });
  return person;
}

/** Suspend, reinstate or mark as left. A status transition, never a delete. */
export function setEmploymentStatus(input: { staffId: string; status: EmploymentStatus; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'managing staff');
  if (input.staffId === actor.staffId) throw new Error('Ask another manager to change your own access.');
  const person = identityTables().staff.find((s) => s.id === input.staffId);
  if (!person) throw new Error('That person is not part of this outlet.');
  if (person.employmentStatus === input.status) throw new Error(`${person.displayName} is already ${input.status}.`);
  if (person.employmentStatus === 'left') throw new Error(`${person.displayName} has left. Add them again as a new person if they return.`);
  if (input.status !== 'active' && roleFor(person.id)?.key === 'owner' && activeOwners().length <= 1) throw new Error('The outlet needs at least one active owner.');
  const before = { employmentStatus: person.employmentStatus };
  person.employmentStatus = input.status;
  audit.record({ outletId: person.outletId, actorStaffId: actor.staffId, action: `staff.${input.status === 'active' ? 'reinstated' : input.status}`, entityType: 'staff', entityId: person.id, before, after: { employmentStatus: input.status }, reason, severity: 'sensitive' });
  return person;
}

/**
 * N-09: grant or remove one permission on a role. The owner role is fixed, so nobody can remove the
 * last way back in; and nobody edits the role they hold themselves.
 */
export function setRolePermission(input: { roleId: string; permission: PermissionKey; granted: boolean; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'changing permissions');
  const role = identityTables().roles.find((r) => r.id === input.roleId);
  if (!role) throw new Error('That role is not part of this outlet.');
  if (role.key === 'owner') throw new Error('The owner role always holds every permission.');
  if (roleFor(actor.staffId)?.id === role.id) throw new Error('Ask another manager to change the role you hold.');
  const has = role.permissions.includes(input.permission);
  if (has === input.granted) return role;
  const before = [...role.permissions];
  role.permissions = input.granted ? [...role.permissions, input.permission] : role.permissions.filter((p) => p !== input.permission);
  audit.record({ outletId: outlet().id, actorStaffId: actor.staffId, action: 'role.permission_changed', entityType: 'role', entityId: role.id, before: { permissions: before }, after: { permissions: role.permissions }, reason, severity: 'sensitive' });
  return role;
}

export function createStaff(input: { fullName: string; displayName: string; roleId: string; pinHash: string | null; avatarUrl: string | null; contactNumber: string | null; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'add a new person');
  const { staff } = identityTables();
  const id = createId();
  const person: Staff = {
    id,
    outletId: staff[0]?.outletId ?? createId(),
    fullName: input.fullName,
    displayName: input.displayName,
    roleId: input.roleId,
    employmentStatus: 'active',
    colourIndex: staff.length % 7,
    pinHash: input.pinHash,
    avatarUrl: input.avatarUrl,
    contactNumber: input.contactNumber,
    pinLockedUntil: null,
  };
  staff.push(person);
  audit.record({
    outletId: person.outletId,
    actorStaffId: input.actor.staffId,
    action: 'staff.created',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: { fullName: input.fullName, displayName: input.displayName, roleId: input.roleId },
    reason: null,
    severity: 'sensitive',
  });
  return person;
}

export function updateStaff(input: { staffId: string; fullName: string; displayName: string; pinHash: string | null; avatarUrl: string | null; contactNumber: string | null; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'update a person');
  const person = staffById(input.staffId);
  if (!person) throw new Error('Person not found.');
  const before = { fullName: person.fullName, displayName: person.displayName, contactNumber: person.contactNumber, avatarUrl: person.avatarUrl };
  person.fullName = input.fullName;
  person.displayName = input.displayName;
  if (input.pinHash !== undefined) person.pinHash = input.pinHash;
  if (input.avatarUrl !== undefined) person.avatarUrl = input.avatarUrl;
  if (input.contactNumber !== undefined) person.contactNumber = input.contactNumber;
  audit.record({
    outletId: person.outletId,
    actorStaffId: input.actor.staffId,
    action: 'staff.updated',
    entityType: 'staff',
    entityId: person.id,
    before,
    after: { fullName: input.fullName, displayName: input.displayName, contactNumber: input.contactNumber, avatarUrl: input.avatarUrl },
    reason: null,
    severity: 'sensitive',
  });
  return person;
}
