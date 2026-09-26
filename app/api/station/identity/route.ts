import { formatTime } from '@bliss/shared/format';
import { canSignInOn, isStaffSurface, wrongSurfaceMessage } from '@bliss/shared/identity';
import { z } from 'zod';
import { clientAddress } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { fresh, withWrite } from '@/modules/_data/store';
import * as credentials from '@/modules/identity/credentials';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

const signIn = z.object({ action: z.literal('sign-in'), deviceId: z.string().max(64), staffId: z.string().max(64), pin: z.string().regex(/^\d{6}$/) });
const approve = z.object({ action: z.literal('approve'), deviceId: z.string().max(64), pin: z.string().regex(/^\d{6}$/), permission: z.enum(['void.approve', 'discount.approve', 'hold.set']) });

const lockedMessage = (until: number, timezone: string) => `This PIN is locked until ${formatTime(until, timezone)}. A manager can unlock it in the Console.`;

/**
 * Station identity: PIN plus device binding. A PIN is checked against its hash on the server; five
 * wrong attempts lock that PIN for 15 minutes, and an address that keeps guessing is slowed the same
 * way. A correct PIN on a registered device returns a signed station token, which every other station
 * request carries. An approval returns a signed token for that one permission, which the server
 * checks when the void arrives. The copy never blames the person.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return wireResponse({ ok: false, message: 'Six digits are needed.' }, { status: 400 });
  }
  await fresh();
  const outlet = identity.outlet();
  const address = `ip:${clientAddress(request)}`;

  const device = identity.devices().find((d) => d.id === (json as { deviceId?: string })?.deviceId);
  if (!device) return wireResponse({ ok: false, message: `This device is not registered to ${outlet.name}. A manager needs to add it in Console, Settings, Devices.` }, { status: 403 });
  if (device.status !== 'active') {
    return wireResponse({ ok: false, message: 'This device was withdrawn. Orders held on it are safe and a manager can recover them.' }, { status: 403 });
  }

  const addressState = credentials.attemptStatus(address);
  if (addressState.locked) return wireResponse({ ok: false, message: `Too many wrong PINs from this device. Try again at ${formatTime(addressState.until, outlet.timezone)}.` }, { status: 429 });

  const asSignIn = signIn.safeParse(json);
  if (asSignIn.success) {
    const { staffId, pin } = asSignIn.data;
    const key = `pin:${staffId}`;
    const state = credentials.attemptStatus(key);
    if (state.locked) return wireResponse({ ok: false, message: lockedMessage(state.until, outlet.timezone) }, { status: 423 });
    if (!identity.verifyStaffPin(staffId, pin)) {
      credentials.recordFailure(address);
      const after = credentials.recordFailure(key);
      if (after.locked) return wireResponse({ ok: false, message: lockedMessage(after.until, outlet.timezone) }, { status: 423 });
      return wireResponse({ ok: false, message: `That PIN was not recognised. ${after.remaining === 1 ? 'One attempt' : `${after.remaining} attempts`} left before this PIN locks for 15 minutes.` }, { status: 401 });
    }
    credentials.clearAttempts(key);
    const staff = identity.staffById(staffId)!;
    const role = identity.roleFor(staffId);
    // docs/14 section 1: a PIN is right or wrong first, then the device decides whether this role belongs.
    if (staff.employmentStatus !== 'active') {
      return wireResponse({ ok: false, message: 'This PIN no longer works. A manager can check your access in the Console.' }, { status: 403 });
    }
    if (!isStaffSurface(device.kind) || !canSignInOn(device.kind, role?.key)) {
      return wireResponse({ ok: false, message: isStaffSurface(device.kind) ? wrongSurfaceMessage(device.kind, role?.key) : 'Staff do not sign in on this device.' }, { status: 403 });
    }
    // A PIN stored before hashing existed is replaced with its hash the first time it is used.
    if (identity.pinState(staff) === 'needs_reset') await withWrite(() => identity.upgradePinHash(staff.id, pin));
    return wireResponse({
      ok: true,
      staff: { id: staff.id, displayName: staff.displayName, roleKey: role?.key, permissions: role?.permissions ?? [] },
      signedInAt: Date.now(),
      token: identity.issueStationToken(staff.id, device.id),
    });
  }

  const asApprove = approve.safeParse(json);
  if (asApprove.success) {
    const key = `approve:${device.id}`;
    const state = credentials.attemptStatus(key);
    if (state.locked) return wireResponse({ ok: false, message: `Approvals on this device are paused until ${formatTime(state.until, outlet.timezone)} after several wrong PINs.` }, { status: 423 });
    const approver = identity.approverByPin(asApprove.data.pin, asApprove.data.permission);
    if (!approver) {
      credentials.recordFailure(address);
      credentials.recordFailure(key);
      return wireResponse({ ok: false, message: 'That PIN cannot approve this. A supervisor or manager needs to enter theirs.' }, { status: 403 });
    }
    credentials.clearAttempts(key);
    return wireResponse({ ok: true, approverId: approver.id, approverName: approver.displayName, token: identity.issueApprovalToken(approver.id, asApprove.data.permission) });
  }

  return wireResponse({ ok: false, message: 'Six digits are needed.' }, { status: 400 });
}
