'use server';

import { z } from 'zod';
import type { PermissionKey } from '@bliss/shared/domain';
import { cookies } from 'next/headers';
import * as pins from '@/modules/identity/pins';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import { type ActionResult, id, optionalText, reason, runAction } from '../_lib/action';

/** People, roles and zoning actions. */

const PEOPLE = ['/console/people'];

const PERMISSIONS = [
  'cost.read',
  'price.write',
  'void.approve',
  'discount.approve',
  'hold.set',
  'stock.count.commit',
  'stock.writeoff',
  'drawer.close',
  'refund.approve',
  'staff.manage',
  'device.manage',
  'report.margin',
  'export.run',
] as const satisfies readonly PermissionKey[];

const staffFields = {
  fullName: z.string({ error: 'Enter their full name.' }).max(60, 'A full name is at most 60 characters.'),
  displayName: z.string({ error: 'Enter the name the floor sees.' }).max(24, 'A display name is at most 24 characters.'),
  roleId: id('role'),
  pin: z
    .string()
    .regex(/^(\d{4,8})?$/, 'A PIN is four to eight digits.')
    .nullable()
    .optional()
    .transform((v) => v || null),
  avatarUrl: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v || null),
  contactNumber: optionalText(20, 'A contact number'),
};

export type StaffForm = { fullName: string; displayName: string; roleId: string; pin: string | null; avatarUrl: string | null; contactNumber: string | null };

export async function createStaff(raw: StaffForm): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object(staffFields), raw, (input, actor) => ({ id: identity.createStaff({ ...input, actor }).id }), { revalidate: PEOPLE });
}

export async function updateStaff(raw: StaffForm & { staffId: string }): Promise<ActionResult> {
  return runAction(
    z.object({ ...staffFields, staffId: id('person') }),
    raw,
    (input, actor) => {
      identity.updateStaff({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function setStaffRole(raw: { staffId: string; roleId: string; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ staffId: id('person'), roleId: id('role'), reason }),
    raw,
    (input, actor) => {
      identity.setStaffRole({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function setEmploymentStatus(raw: { staffId: string; status: 'active' | 'suspended' | 'left'; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ staffId: id('person'), status: z.enum(identity.EMPLOYMENT_STATUSES, { error: 'Choose active, suspended or left.' }), reason }),
    raw,
    (input, actor) => {
      identity.setEmploymentStatus({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function unlockPin(raw: { staffId: string }): Promise<ActionResult> {
  return runAction(
    z.object({ staffId: id('person') }),
    raw,
    (input, actor) => {
      identity.unlockPin({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

const pinLength = z.number({ error: 'Choose how many digits.' }).int().min(4, 'A PIN is four to eight digits.').max(8, 'A PIN is four to eight digits.');
const expiryDays = z.number().int().min(1, 'A PIN lasts at least a day.').max(730, 'A PIN lasts at most two years.').nullable();

/** Set or reset someone's PIN, typed or made at random. A made PIN comes back once, to hand over. */
export async function setPin(raw: {
  staffId: string;
  mode: 'typed' | 'generated';
  pin: string | null;
  length: number;
  expiresInDays: number | null;
  mustChange: boolean;
  reason: string;
}): Promise<ActionResult<{ pin: string | null; expiresAt: number | null }>> {
  return runAction(
    z.object({
      staffId: id('person'),
      mode: z.enum(['typed', 'generated']),
      pin: z
        .string()
        .regex(/^\d{4,8}$/, 'A PIN is four to eight digits.')
        .nullable(),
      length: pinLength,
      expiresInDays: expiryDays,
      mustChange: z.boolean(),
      reason,
    }),
    raw,
    (input, actor) => pins.setPin({ ...input, actor }),
    { revalidate: PEOPLE },
  );
}

export async function clearPin(raw: { staffId: string; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ staffId: id('person'), reason }),
    raw,
    (input, actor) => {
      pins.clearPin({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function endSessions(raw: { staffId: string; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ staffId: id('person'), reason }),
    raw,
    (input, actor) => {
      pins.endSessions({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

/**
 * Change your own PIN, with the current one. It ends your sessions everywhere else; this browser is
 * signed in again with the new PIN so the work in front of you carries on.
 */
export async function changeOwnPin(raw: { current: string; next: string }): Promise<ActionResult> {
  const result = await runAction(
    z.object({ current: z.string().regex(/^\d{4,8}$/, 'Enter your current PIN.'), next: z.string().regex(/^\d{4,8}$/, 'A PIN is four to eight digits.') }),
    raw,
    (input, actor) => {
      pins.chooseOwnPin({ staffId: actor.staffId, current: input.current, next: input.next });
      return { staffId: actor.staffId };
    },
    { revalidate: ['/console'] },
  );
  if (!result.ok) return result;
  (await cookies()).set(identity.CONSOLE_COOKIE, identity.issueConsoleSession(result.staffId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(identity.CONSOLE_SESSION_MS / 1000),
  });
  return { ok: true };
}

export async function updatePinPolicy(raw: { length: number; expiryDays: number | null; lockAttempts: number; history: number; ownPinAfterReset: boolean; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ length: pinLength, expiryDays: expiryDays, lockAttempts: z.number().int(), history: z.number().int(), ownPinAfterReset: z.boolean(), reason }),
    raw,
    (input, actor) => {
      const { reason: why, ...policy } = input;
      pins.updatePolicy({ policy, reason: why, actor });
    },
    { revalidate: ['/console/settings', '/console/people'] },
  );
}

export async function setRolePermission(raw: { roleId: string; permission: PermissionKey; granted: boolean; reason: string }): Promise<ActionResult> {
  return runAction(
    z.object({ roleId: id('role'), permission: z.enum(PERMISSIONS, { error: 'That is not a permission.' }), granted: z.boolean(), reason }),
    raw,
    (input, actor) => {
      identity.setRolePermission({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

const zoneFields = {
  name: z.string({ error: 'Name the zone.' }).max(40, 'A zone name is at most 40 characters.'),
  sortOrder: z.number({ error: 'Enter the order as a number.' }).int('Enter the order as a whole number.'),
  defaultPriceListId: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .transform((v) => v || null),
};

export async function createZone(raw: { name: string; sortOrder: number; defaultPriceListId: string | null }): Promise<ActionResult> {
  return runAction(
    z.object(zoneFields),
    raw,
    (input, actor) => {
      trade.createZone({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function updateZone(raw: { zoneId: string; name: string; sortOrder: number; defaultPriceListId: string | null; status: 'active' | 'archived' }): Promise<ActionResult> {
  return runAction(
    z.object({ ...zoneFields, zoneId: id('zone'), status: z.enum(['active', 'archived'], { error: 'A zone is active or archived.' }) }),
    raw,
    (input, actor) => {
      trade.updateZone({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

const tableFields = {
  zoneId: id('zone'),
  label: z.string({ error: 'Label the table.' }).max(12, 'A table label is at most 12 characters.'),
  seats: z.number({ error: 'Enter the seats as a number.' }).int('Enter the seats as a whole number.'),
  positionX: z.number().finite().default(0),
  positionY: z.number().finite().default(0),
};

export async function createServiceTable(raw: { zoneId: string; label: string; seats: number; positionX: number; positionY: number }): Promise<ActionResult> {
  return runAction(
    z.object(tableFields),
    raw,
    (input, actor) => {
      trade.createServiceTable({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}

export async function updateServiceTable(raw: {
  tableId: string;
  zoneId: string;
  label: string;
  seats: number;
  positionX: number;
  positionY: number;
  status: 'available' | 'occupied' | 'out_of_service';
}): Promise<ActionResult> {
  return runAction(
    z.object({ ...tableFields, tableId: id('table'), status: z.enum(['available', 'occupied', 'out_of_service'], { error: 'Choose in service or out of service.' }) }),
    raw,
    (input, actor) => {
      trade.updateServiceTable({ ...input, actor });
    },
    { revalidate: PEOPLE },
  );
}
