import 'server-only';

import { DomainError } from '../_data/errors';

import { DEV_PINS } from '@bliss/db/seed/organisation';
import type { Device, EmploymentStatus, PermissionKey, Role, RoleKey, Staff } from '@bliss/shared/domain';
import { canSignInOn } from '@bliss/shared/identity';
import { createUuidV7 } from '@bliss/shared/id';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { bumpCatalogueVersion } from '../_data/source';
import { UPLOAD_PATH } from '../_data/uploads';
import * as audit from '../audit/service';
import * as credentials from './credentials';
import { identityTables } from './schema';

const createId = createUuidV7();

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
  return identityTables().roles.filter((r) => !r.archived);
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
    throw new DomainError(`Your role does not include ${doing}. A manager can do this, or change your permissions.`);
  }
}

export interface DeviceRow extends Omit<Device, 'pairingHash'> {
  /** A pairing code has been issued and not yet used. */
  pairingPending: boolean;
  online: boolean;
  lastSeenAt: number | null;
  signedInStaffId: string | null;
  unsyncedCount: number;
  appVersion: string;
}

export function devices(): DeviceRow[] {
  const { devices: list, presence } = identityTables();
  const now = Date.now();
  return list.map(({ pairingHash, ...d }) => {
    const p = presence.find((x) => x.deviceId === d.id);
    return {
      ...d,
      // The code itself never leaves the server; only whether one is waiting to be used.
      pairingPending: Boolean(pairingHash) && (d.pairingExpiresAt ?? 0) > now,
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
  if (!device) throw new DomainError('That device is not registered to this outlet.');
  if (device.status === 'lost' || device.status === 'retired') throw new DomainError(`${device.label} was already withdrawn.`);
  const before = { status: device.status };
  device.status = 'lost';
  device.revokedAt = Date.now();
  device.revokedReason = reason;
  bumpCatalogueVersion();
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

/* ------------------------------------------------------------ PINs and sessions */

export const CONSOLE_COOKIE = 'bliss-console-session';
/** A Console session lasts one working day, then asks for the PIN again. */
export const CONSOLE_SESSION_MS = 12 * 60 * 60_000;
/** A station token keeps a tablet trading for a month; every pull renews it. */
export const STATION_TOKEN_MS = 30 * 24 * 60 * 60_000;
/** An approval covers the void it was given for, even if the tablet sends it after a dropout. */
export const APPROVAL_TOKEN_MS = 12 * 60 * 60_000;

export type PinState = 'set' | 'needs_reset' | 'development' | 'none';

/**
 * Where a person's PIN stands. `development` means no PIN has been chosen and the seeded development
 * PIN still works; `needs_reset` is a PIN stored before hashing existed.
 */
export function pinState(staff: Staff): PinState {
  if (credentials.isHashedPin(staff.pinHash)) return 'set';
  if (staff.pinHash) return 'needs_reset';
  return DEV_PINS[staff.id] ? 'development' : 'none';
}

/** Whether this PIN is this person's. Constant time, and false for anyone who is not active. */
export function verifyStaffPin(staffId: string, pin: string): boolean {
  const staff = staffById(staffId);
  if (!staff) return false;
  if (staff.pinHash) return credentials.verifyPin(pin, staff.pinHash);
  const development = DEV_PINS[staff.id];
  return development ? credentials.verifyPin(pin, development) : false;
}

/**
 * Replace a plaintext PIN left over from before hashing with its hash. Runs inside the caller's write
 * after a successful check, so the plaintext is gone the first time the person signs in.
 */
export function upgradePinHash(staffId: string, pin: string): void {
  const staff = staffById(staffId);
  if (!staff || !staff.pinHash || credentials.isHashedPin(staff.pinHash)) return;
  staff.pinHash = credentials.hashPin(pin);
}

/** The first active person whose PIN this is and who holds the permission, for in-dialog approval. */
export function approverByPin(pin: string, permission: PermissionKey): Staff | null {
  if (!credentials.PIN_PATTERN.test(pin)) return null;
  for (const staff of staffList()) {
    if (staff.employmentStatus !== 'active') continue;
    if (!can(staff.id, permission)) continue;
    if (verifyStaffPin(staff.id, pin)) return staff;
  }
  return null;
}

/** Issue the signed Console session token for a person who has just proved their PIN. */
export function issueConsoleSession(staffId: string): string {
  return credentials.signToken({ k: 'console', sid: staffId, ttlMs: CONSOLE_SESSION_MS });
}

export type ConsoleSessionCheck = { ok: true; staff: Staff; role: Role } | { ok: false; reason: 'missing' | 'invalid' | 'inactive' | 'wrong_surface' };

/**
 * Check a Console session token. Every call re-reads the person, so a suspension, a departure or a
 * role that no longer belongs in the Console ends the session on the next request.
 */
export function checkConsoleSession(token: string | null | undefined): ConsoleSessionCheck {
  if (!token) return { ok: false, reason: 'missing' };
  const claims = credentials.verifyToken(token, 'console');
  if (!claims) return { ok: false, reason: 'invalid' };
  const staff = staffById(claims.sid);
  const role = staff ? roleFor(staff.id) : null;
  if (!staff || !role) return { ok: false, reason: 'invalid' };
  if (staff.employmentStatus !== 'active') return { ok: false, reason: 'inactive' };
  if (!canSignInOn('console', role.key)) return { ok: false, reason: 'wrong_surface' };
  return { ok: true, staff, role };
}

/**
 * The Console session, for pages and server actions. With no valid session this redirects to the
 * sign-in page. It never falls back to anyone: an error here is an error, not a quiet owner.
 */
export async function currentConsoleActor(): Promise<Actor & { staff: Staff; role: Role }> {
  const { cookies } = await import('next/headers');
  const { redirect } = await import('next/navigation');
  const token = (await cookies()).get(CONSOLE_COOKIE)?.value;
  const check = checkConsoleSession(token);
  if (!check.ok) return redirect(check.reason === 'missing' ? '/console/sign-in' : `/console/sign-in?ended=${check.reason}`);
  return { staffId: check.staff.id, deviceId: null, staff: check.staff, role: check.role };
}

/** Issue a station token after a PIN is proved on a registered device. */
export function issueStationToken(staffId: string, deviceId: string): string {
  return credentials.signToken({ k: 'station', sid: staffId, did: deviceId, ttlMs: STATION_TOKEN_MS });
}

export type StationCheck = { ok: true; staff: Staff; role: Role; device: DeviceRow; issuedAt: number } | { ok: false; status: 401 | 403; message: string };

/**
 * Check the station token a Floor or Counter device sends with every request. The token proves a
 * person entered their PIN on this device; the device must still be registered and active, and the
 * person still employed.
 */
export function checkStationToken(token: string | null | undefined, deviceId?: string | null): StationCheck {
  const claims = credentials.verifyToken(token, 'station');
  if (!claims || !claims.did) return { ok: false, status: 401, message: 'Sign in again on this device.' };
  if (deviceId && deviceId !== claims.did) return { ok: false, status: 403, message: 'This sign-in belongs to another device. Sign in again here.' };
  const device = devices().find((d) => d.id === claims.did);
  if (!device || device.status !== 'active') return { ok: false, status: 403, message: 'This device was withdrawn. Orders held on it are safe and a manager can recover them.' };
  const staff = staffById(claims.sid);
  const role = staff ? roleFor(staff.id) : null;
  if (!staff || !role || staff.employmentStatus !== 'active') return { ok: false, status: 401, message: 'This PIN no longer works. A manager can check your access in the Console.' };
  return { ok: true, staff, role, device, issuedAt: claims.iat };
}

/** Sign an approval for one permission, given by a person who proved their PIN in the dialog. */
export function issueApprovalToken(approverId: string, permission: PermissionKey): string {
  return credentials.signToken({ k: 'approval', sid: approverId, perm: permission, ttlMs: APPROVAL_TOKEN_MS });
}

/**
 * The approver behind an approval token, if it is genuine, unexpired, for this permission, and the
 * approver can still give it. Anything else is no approval at all.
 */
export function approverFromToken(token: string | null | undefined, permission: PermissionKey): Staff | null {
  const claims = credentials.verifyToken(token, 'approval');
  if (!claims || claims.perm !== permission) return null;
  return can(claims.sid, permission) ? staffById(claims.sid) : null;
}

/** What a sign-in screen may know about a person: never a PIN, a hash or a contact number. */
export interface StaffSummary {
  id: string;
  displayName: string;
  fullName: string;
  roleKey: RoleKey;
  roleName: string;
  colourIndex: number;
  employmentStatus: EmploymentStatus;
}

export function staffSummaries(filter: (s: Staff) => boolean = () => true): StaffSummary[] {
  return staffList()
    .filter(filter)
    .map((s) => {
      const role = roleFor(s.id);
      return { id: s.id, displayName: s.displayName, fullName: s.fullName, roleKey: role?.key ?? 'waiter', roleName: role?.name ?? 'No role', colourIndex: s.colourIndex, employmentStatus: s.employmentStatus };
    });
}

/* ---------------------------------------------------------- people and roles */

/** Seniority, so nobody hands out more authority than they hold. */
const RANK: Record<RoleKey, number> = { waiter: 1, cashier: 2, supervisor: 3, stock_controller: 3, manager: 4, owner: 5 };

export function rankOf(role: Role | null | undefined): number {
  return role ? RANK[role.key] : 0;
}

function activeOwners(): Staff[] {
  const owner = identityTables().roles.find((r) => r.key === 'owner');
  return identityTables().staff.filter((s) => s.roleId === owner?.id && s.employmentStatus === 'active');
}

/** The actor may manage this person: never themselves, and an owner only if the actor is one. */
function assertMayManage(actor: Actor, person: Staff, doing: string) {
  if (person.id === actor.staffId) throw new DomainError(`Ask another manager to ${doing} for you.`);
  const actorRole = roleFor(actor.staffId);
  if (rankOf(roleFor(person.id)) > rankOf(actorRole) || (roleFor(person.id)?.key === 'owner' && actorRole?.key !== 'owner')) {
    throw new DomainError(`Only an owner can ${doing} for ${person.displayName}.`);
  }
}

/** The actor may give out this role: never one above their own, and owner only by an owner. */
function assertMayGrant(actor: Actor, role: Role) {
  const actorRole = roleFor(actor.staffId);
  if (rankOf(role) > rankOf(actorRole) || (role.key === 'owner' && actorRole?.key !== 'owner')) {
    throw new DomainError(`Only an owner can make someone ${role.name.toLowerCase()}.`);
  }
}

function roleById(roleId: string): Role {
  const role = identityTables().roles.find((r) => r.id === roleId);
  if (!role) throw new DomainError('That role is not part of this outlet.');
  return role;
}

/** Names are trimmed, at least two characters, at most sixty, and display names are unique. */
function cleanNames(input: { fullName: string; displayName: string }, exceptId: string | null) {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 2 || fullName.length > 60) throw new DomainError('A full name is 2 to 60 characters.');
  if (displayName.length < 2 || displayName.length > 24) throw new DomainError('A display name is 2 to 24 characters. It is what the floor sees.');
  const clash = identityTables().staff.find((s) => s.id !== exceptId && s.employmentStatus !== 'left' && s.displayName.toLowerCase() === displayName.toLowerCase());
  if (clash) throw new DomainError(`${clash.fullName} already goes by ${displayName}. Choose another display name so the floor can tell them apart.`);
  return { fullName, displayName };
}

function cleanContact(value: string | null | undefined): string | null {
  const contact = value?.trim() ?? '';
  if (!contact) return null;
  if (!/^\+?[\d\s-]{7,20}$/.test(contact)) throw new DomainError('A contact number is digits, spaces and dashes, with an optional leading +.');
  return contact;
}

function cleanPin(pin: string | null | undefined): string | null {
  if (pin === null || pin === undefined || pin === '') return null;
  if (!credentials.PIN_PATTERN.test(pin)) throw new DomainError('A PIN is six digits.');
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') throw new DomainError('That PIN is too easy to guess. Choose six digits that are not a run or a repeat.');
  return credentials.hashPin(pin);
}

/**
 * Avatars are uploads the Console issued, never data URLs or links elsewhere. A photo that is already
 * on the record (from before uploads existed) is kept as it is when it is not being changed.
 */
function cleanAvatar(url: string | null | undefined, current: string | null = null): string | null {
  if (!url) return null;
  if (url === current) return url;
  const match = UPLOAD_PATH.exec(url);
  if (!match || match[2] === 'pdf') throw new DomainError('A photo is added with the upload button.');
  return url;
}

/** N-09: change a person's role. Audited as sensitive; nobody changes their own role. */
export function setStaffRole(input: { staffId: string; roleId: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'managing staff');
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  assertMayManage(actor, person, 'change the role');
  const role = roleById(input.roleId);
  assertMayGrant(actor, role);
  if (person.roleId === role.id) throw new DomainError(`${person.displayName} is already ${role.name.toLowerCase()}.`);
  const before = roleFor(person.id);
  if (before?.key === 'owner' && activeOwners().length <= 1) throw new DomainError('The outlet needs at least one active owner. Make someone else owner first.');
  person.roleId = role.id;
  bumpCatalogueVersion();
  audit.record({ outletId: person.outletId, actorStaffId: actor.staffId, action: 'staff.role_changed', entityType: 'staff', entityId: person.id, before: { role: before?.name ?? null }, after: { role: role.name }, reason, severity: 'sensitive' });
  return person;
}

export const EMPLOYMENT_STATUSES = ['active', 'suspended', 'left'] as const satisfies readonly EmploymentStatus[];

/** Suspend, reinstate or mark as left. A status transition, never a delete. */
export function setEmploymentStatus(input: { staffId: string; status: EmploymentStatus; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'managing staff');
  if (!EMPLOYMENT_STATUSES.includes(input.status)) throw new DomainError('That is not an employment status.');
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  assertMayManage(actor, person, 'change access');
  if (person.employmentStatus === input.status) throw new DomainError(`${person.displayName} is already ${input.status}.`);
  if (person.employmentStatus === 'left') throw new DomainError(`${person.displayName} has left. Add them again as a new person if they return.`);
  if (input.status !== 'active' && roleFor(person.id)?.key === 'owner' && activeOwners().length <= 1) throw new DomainError('The outlet needs at least one active owner.');
  const before = { employmentStatus: person.employmentStatus };
  person.employmentStatus = input.status;
  bumpCatalogueVersion();
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
  const role = roleById(input.roleId);
  if (role.key === 'owner') throw new DomainError('The owner role always holds every permission.');
  if (roleFor(actor.staffId)?.id === role.id) throw new DomainError('Ask another manager to change the role you hold.');
  if (rankOf(role) >= rankOf(roleFor(actor.staffId)) && roleFor(actor.staffId)?.key !== 'owner') throw new DomainError(`Only an owner can change what a ${role.name.toLowerCase()} can do.`);
  if (input.granted && !can(actor.staffId, input.permission)) throw new DomainError('You can only give a permission you hold yourself.');
  const has = role.permissions.includes(input.permission);
  if (has === input.granted) return role;
  const before = [...role.permissions];
  role.permissions = input.granted ? [...role.permissions, input.permission] : role.permissions.filter((p) => p !== input.permission);
  bumpCatalogueVersion();
  audit.record({ outletId: outlet().id, actorStaffId: actor.staffId, action: 'role.permission_changed', entityType: 'role', entityId: role.id, before: { permissions: before }, after: { permissions: role.permissions }, reason, severity: 'sensitive' });
  return role;
}

export interface StaffInput {
  fullName: string;
  displayName: string;
  roleId: string;
  /** Six digits to set a PIN; empty or null leaves it as it is (or unset, for a new person). */
  pin: string | null;
  avatarUrl: string | null;
  contactNumber: string | null;
}

/** Add a person. Sensitive: they can sign in as soon as their PIN is set. */
export function createStaff(input: StaffInput & { actor: Actor }) {
  const { actor } = input;
  assertCan(actor.staffId, 'staff.manage', 'adding people');
  const role = roleById(input.roleId);
  assertMayGrant(actor, role);
  const names = cleanNames(input, null);
  const { staff } = identityTables();
  const person: Staff = {
    id: createId(),
    outletId: outlet().id,
    ...names,
    roleId: role.id,
    employmentStatus: 'active',
    colourIndex: staff.length % 7,
    pinHash: cleanPin(input.pin),
    avatarUrl: cleanAvatar(input.avatarUrl),
    contactNumber: cleanContact(input.contactNumber),
    pinLockedUntil: null,
  };
  staff.push(person);
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: actor.staffId,
    action: 'staff.created',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: { fullName: person.fullName, displayName: person.displayName, role: role.name, pinSet: Boolean(person.pinHash) },
    reason: null,
    severity: 'sensitive',
  });
  return person;
}

/**
 * Update a person's details, role and, optionally, PIN. The role change follows the same rules as
 * setStaffRole; a PIN is only replaced when a new one is typed.
 */
export function updateStaff(input: StaffInput & { staffId: string; actor: Actor }) {
  const { actor } = input;
  assertCan(actor.staffId, 'staff.manage', 'updating people');
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  const self = person.id === actor.staffId;
  if (!self) assertMayManage(actor, person, 'update details');
  const names = cleanNames(input, person.id);
  const role = roleById(input.roleId);
  const roleChanges = role.id !== person.roleId;
  if (roleChanges) {
    if (self) throw new DomainError('Ask another manager to change your own role.');
    assertMayGrant(actor, role);
    if (roleFor(person.id)?.key === 'owner' && activeOwners().length <= 1) throw new DomainError('The outlet needs at least one active owner. Make someone else owner first.');
  }
  const pinHash = cleanPin(input.pin);
  const before = { fullName: person.fullName, displayName: person.displayName, contactNumber: person.contactNumber, avatarUrl: person.avatarUrl, role: roleFor(person.id)?.name ?? null };
  person.fullName = names.fullName;
  person.displayName = names.displayName;
  person.contactNumber = cleanContact(input.contactNumber);
  person.avatarUrl = cleanAvatar(input.avatarUrl, person.avatarUrl);
  if (roleChanges) person.roleId = role.id;
  if (pinHash) {
    person.pinHash = pinHash;
    person.pinLockedUntil = null;
    credentials.unlock(`pin:${person.id}`);
  }
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: actor.staffId,
    action: 'staff.updated',
    entityType: 'staff',
    entityId: person.id,
    before,
    after: { fullName: person.fullName, displayName: person.displayName, contactNumber: person.contactNumber, avatarUrl: person.avatarUrl, role: role.name, pinChanged: Boolean(pinHash) },
    reason: null,
    severity: 'sensitive',
  });
  return person;
}

/** Whether this person's PIN is locked after too many wrong attempts, on any surface. */
export function pinLocked(staffId: string): boolean {
  const staff = staffById(staffId);
  return credentials.attemptStatus(`pin:${staffId}`).locked || (staff?.pinLockedUntil ?? 0) > Date.now();
}

/** Lift a PIN lock early, after five wrong attempts. */
export function unlockPin(input: { staffId: string; actor: Actor }) {
  assertCan(input.actor.staffId, 'staff.manage', 'unlocking PINs');
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  credentials.unlock(`pin:${person.id}`);
  person.pinLockedUntil = null;
  audit.record({ outletId: person.outletId, actorStaffId: input.actor.staffId, action: 'staff.pin_unlocked', entityType: 'staff', entityId: person.id, before: null, after: null, reason: null, severity: 'sensitive' });
  return person;
}
