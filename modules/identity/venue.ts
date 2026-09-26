import 'server-only';

import type { Device, DeviceKind, Outlet, PermissionKey, Role } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, isNegative } from '@bliss/shared/money';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { randomInt } from 'node:crypto';
import { DomainError } from '../_data/errors';
import { bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import { hashPin, verifyPin } from './credentials';
import { identityTables } from './schema';
import { assertCan, can, outlet, rankOf, roleFor, staffList } from './service';

/**
 * Setting the venue up: the outlet's details, roles, and the devices that trade. docs/19, plan C4.
 * These change how every station works, so each needs a manager, and the tax figures an owner.
 */

const createId = createUuidV7();

/** A pairing code lasts a day: long enough to walk to the tablet, short enough not to linger. */
export const PAIRING_MS = 24 * 60 * 60_000;

function record(actor: Actor, action: string, entityType: string, entityId: string, before: object | null, after: object | null, reason: string | null, severity: 'info' | 'notable' | 'sensitive' = 'notable') {
  audit.record({ outletId: outlet().id, actorStaffId: actor.staffId, action, entityType, entityId, before, after, reason, severity });
}

function isOwner(actor: Actor): boolean {
  return roleFor(actor.staffId)?.key === 'owner';
}

/* ---------------------------------------------------------------------- outlet */

export interface OutletInput {
  name: string;
  legalName: string;
  address: string;
  businessDayCutover: string;
  taxRateBps: number;
  pricesTaxInclusive: boolean;
  lowStockDefault: number;
  drawerVarianceThresholdCents: Cents;
  reason: string;
  actor: Actor;
}

/**
 * Change the outlet's details. The tax rate and whether prices include it change what every bill
 * says, so only an owner changes those; a manager can change the rest.
 */
export function updateOutlet(input: OutletInput): Outlet {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'changing the outlet');
  const current = identityTables().outlet;
  const text = (value: string, what: string, max: number) => {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > max) throw new DomainError(`${what} is 2 to ${max} characters.`);
    return clean;
  };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.businessDayCutover)) throw new DomainError('Enter the end of the business day as hours and minutes, such as 06:00.');
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 5000) throw new DomainError('VAT is from 0 to 50 per cent.');
  if (!Number.isInteger(input.lowStockDefault) || input.lowStockDefault < 0 || input.lowStockDefault > 1000) throw new DomainError('The low stock line is a whole number from 0 to 1,000.');
  if (isNegative(input.drawerVarianceThresholdCents)) throw new DomainError('The drawer threshold cannot be below zero.');
  const next = {
    name: text(input.name, 'The outlet name', 60),
    legalName: text(input.legalName, 'The legal name', 100),
    address: text(input.address, 'The address', 200),
    businessDayCutover: input.businessDayCutover,
    taxRateBps: input.taxRateBps,
    pricesTaxInclusive: input.pricesTaxInclusive,
    lowStockDefault: input.lowStockDefault,
    drawerVarianceThresholdCents: input.drawerVarianceThresholdCents,
  };
  const before = {
    name: current.name,
    legalName: current.legalName,
    address: current.address,
    businessDayCutover: current.businessDayCutover,
    taxRateBps: current.taxRateBps,
    pricesTaxInclusive: current.pricesTaxInclusive,
    lowStockDefault: current.lowStockDefault,
    drawerVarianceThresholdCents: current.drawerVarianceThresholdCents.toString(),
  };
  const taxChanged = before.taxRateBps !== next.taxRateBps || before.pricesTaxInclusive !== next.pricesTaxInclusive;
  if (taxChanged && !isOwner(actor)) throw new DomainError('Only an owner changes VAT or whether prices include it.');
  const after = { ...next, drawerVarianceThresholdCents: next.drawerVarianceThresholdCents.toString() };
  if (JSON.stringify(before) === JSON.stringify(after)) return current;
  Object.assign(current, next);
  // Stations price and warn from the outlet's figures, so they pull it again.
  bumpCatalogueVersion();
  record(actor, 'outlet.updated', 'outlet', current.id, before, after, reason, taxChanged ? 'sensitive' : 'notable');
  return current;
}

/* ----------------------------------------------------------------------- roles */

function roleName(value: string): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 30) throw new DomainError('A role name is 2 to 30 characters.');
  return clean;
}

/**
 * Add a role, such as "Head waiter", based on one that exists: it signs in where its base role
 * does and starts with the same permissions, which can then be changed in the matrix.
 */
export function createRole(input: { name: string; basedOnRoleId: string; actor: Actor }): Role {
  assertCan(input.actor.staffId, 'staff.manage', 'adding roles');
  const t = identityTables();
  const base = t.roles.find((r) => r.id === input.basedOnRoleId && !r.archived);
  if (!base) throw new DomainError('Choose the role this one is based on.');
  if (base.key === 'owner') throw new DomainError('A role cannot be based on the owner.');
  const mine = roleFor(input.actor.staffId);
  if (rankOf(base) >= rankOf(mine) && mine?.key !== 'owner') throw new DomainError(`Only an owner can add a role as senior as ${base.name.toLowerCase()}.`);
  const name = roleName(input.name);
  if (t.roles.some((r) => !r.archived && r.name.toLowerCase() === name.toLowerCase())) throw new DomainError(`There is already a role called ${name}.`);
  const permissions = base.permissions.filter((p): p is PermissionKey => can(input.actor.staffId, p));
  const role: Role = { id: createId(), key: base.key, name, isSystem: false, permissions };
  t.roles.push(role);
  bumpCatalogueVersion();
  record(input.actor, 'role.created', 'role', role.id, null, { name, basedOn: base.name, permissions }, null);
  return role;
}

export function renameRole(input: { roleId: string; name: string; actor: Actor }): void {
  assertCan(input.actor.staffId, 'staff.manage', 'renaming roles');
  const t = identityTables();
  const role = t.roles.find((r) => r.id === input.roleId && !r.archived);
  if (!role) throw new DomainError('That role no longer exists.');
  if (role.key === 'owner') throw new DomainError('The owner role keeps its name.');
  const name = roleName(input.name);
  if (name === role.name) return;
  if (t.roles.some((r) => !r.archived && r.id !== role.id && r.name.toLowerCase() === name.toLowerCase())) throw new DomainError(`There is already a role called ${name}.`);
  const before = { name: role.name };
  role.name = name;
  bumpCatalogueVersion();
  record(input.actor, 'role.renamed', 'role', role.id, before, { name }, null, 'info');
}

/** Delete a role nobody holds. The roles Bliss starts with stay. */
export function deleteRole(input: { roleId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'deleting roles');
  const role = identityTables().roles.find((r) => r.id === input.roleId && !r.archived);
  if (!role) throw new DomainError('That role no longer exists.');
  if (role.isSystem) throw new DomainError(`${role.name} is one of the roles Bliss starts with, so it stays. Rename it instead.`);
  const holders = staffList().filter((s) => s.roleId === role.id && s.employmentStatus !== 'left');
  if (holders.length > 0) throw new DomainError(`${holders.length} ${holders.length === 1 ? 'person holds' : 'people hold'} ${role.name}. Give them another role first.`);
  role.archived = true;
  bumpCatalogueVersion();
  record(actor, 'role.deleted', 'role', role.id, { name: role.name }, null, reason, 'sensitive');
}

/* --------------------------------------------------------------------- devices */

const KINDS: readonly DeviceKind[] = ['floor', 'counter', 'bar'];

function newPairing(device: Device): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  device.pairingHash = hashPin(code);
  device.pairingExpiresAt = Date.now() + PAIRING_MS;
  return code;
}

/**
 * Register a tablet or a counter. The result carries a six-digit pairing code, shown once: the
 * station asks for it the first time it is chosen, so nobody can take over a device by picking it.
 */
export function registerDevice(input: { label: string; kind: DeviceKind; actor: Actor }): { device: Device; pairingCode: string } {
  assertCan(input.actor.staffId, 'device.manage', 'registering devices');
  const t = identityTables();
  const label = input.label.trim().replace(/\s+/g, ' ');
  if (label.length < 2 || label.length > 30) throw new DomainError('A device name is 2 to 30 characters, such as Floor 4.');
  if (!KINDS.includes(input.kind)) throw new DomainError('Choose a Floor tablet, a Counter or a Bar screen.');
  if (t.devices.some((d) => d.label.toLowerCase() === label.toLowerCase() && d.status === 'active')) throw new DomainError(`There is already a device called ${label}.`);
  const device: Device = {
    id: createId(),
    outletId: outlet().id,
    label,
    kind: input.kind,
    enrolledAt: Date.now(),
    enrolledBy: input.actor.staffId,
    lastSeenAt: null,
    lastEventSeq: 0,
    appVersion: '',
    status: 'active',
    revokedAt: null,
    revokedReason: null,
  };
  const pairingCode = newPairing(device);
  t.devices.push(device);
  bumpCatalogueVersion();
  record(input.actor, 'device.registered', 'device', device.id, null, { label, kind: device.kind }, null);
  return { device, pairingCode };
}

export function renameDevice(input: { deviceId: string; label: string; actor: Actor }): void {
  assertCan(input.actor.staffId, 'device.manage', 'renaming devices');
  const t = identityTables();
  const device = t.devices.find((d) => d.id === input.deviceId);
  if (!device) throw new DomainError('That device is not registered to this outlet.');
  const label = input.label.trim().replace(/\s+/g, ' ');
  if (label.length < 2 || label.length > 30) throw new DomainError('A device name is 2 to 30 characters, such as Floor 4.');
  if (label === device.label) return;
  if (t.devices.some((d) => d.id !== device.id && d.label.toLowerCase() === label.toLowerCase() && d.status === 'active')) throw new DomainError(`There is already a device called ${label}.`);
  const before = { label: device.label };
  device.label = label;
  bumpCatalogueVersion();
  record(input.actor, 'device.renamed', 'device', device.id, before, { label }, null, 'info');
}

/** Bring a withdrawn device back, found or repaired. It must be paired again with a new code. */
export function reinstateDevice(input: { deviceId: string; reason: string; actor: Actor }): { pairingCode: string } {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'device.manage', 'reinstating devices');
  const device = identityTables().devices.find((d) => d.id === input.deviceId);
  if (!device) throw new DomainError('That device is not registered to this outlet.');
  if (device.status === 'active') throw new DomainError(`${device.label} is already in use.`);
  const before = { status: device.status };
  device.status = 'active';
  device.revokedAt = null;
  device.revokedReason = null;
  const pairingCode = newPairing(device);
  bumpCatalogueVersion();
  record(actor, 'device.reinstated', 'device', device.id, before, { status: 'active' }, reason, 'sensitive');
  return { pairingCode };
}

/** A new code for a device whose code was lost or ran out. */
export function newPairingCode(input: { deviceId: string; actor: Actor }): { pairingCode: string } {
  assertCan(input.actor.staffId, 'device.manage', 'pairing devices');
  const device = identityTables().devices.find((d) => d.id === input.deviceId && d.status === 'active');
  if (!device) throw new DomainError('That device is not in use.');
  const pairingCode = newPairing(device);
  record(input.actor, 'device.pairing_issued', 'device', device.id, null, { label: device.label }, null, 'info');
  return { pairingCode };
}

/** Whether a device is waiting for its pairing code before anyone can sign in on it. */
export function pairingRequired(deviceId: string): boolean {
  const device = identityTables().devices.find((d) => d.id === deviceId);
  return Boolean(device?.pairingHash);
}

/**
 * A station enters the code shown in the Console. Right, and the device is paired for good; wrong
 * or out of date, and nothing changes. The caller limits attempts.
 */
export function pairDevice(deviceId: string, code: string): 'paired' | 'wrong' | 'expired' {
  const device = identityTables().devices.find((d) => d.id === deviceId && d.status === 'active');
  if (!device?.pairingHash) return 'paired';
  if ((device.pairingExpiresAt ?? 0) < Date.now()) return 'expired';
  if (!verifyPin(code, device.pairingHash)) return 'wrong';
  device.pairingHash = null;
  device.pairingExpiresAt = null;
  audit.record({ outletId: outlet().id, actorStaffId: device.enrolledBy, actorDeviceId: device.id, action: 'device.paired', entityType: 'device', entityId: device.id, before: null, after: { label: device.label }, reason: null, severity: 'notable' });
  return 'paired';
}
