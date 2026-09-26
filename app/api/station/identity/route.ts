import { formatTime } from '@bliss/shared/format';
import { canSignInOn, isStaffSurface, wrongSurfaceMessage } from '@bliss/shared/identity';
import { z } from 'zod';
import { clientAddress } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { fresh, withWrite } from '@/modules/_data/store';
import * as credentials from '@/modules/identity/credentials';
import { DomainError } from '@/modules/_data/errors';
import * as pins from '@/modules/identity/pins';
import * as identity from '@/modules/identity/service';
import * as venue from '@/modules/identity/venue';

export const dynamic = 'force-dynamic';

const signIn = z.object({ action: z.literal('sign-in'), deviceId: z.string().max(64), staffId: z.string().max(64), pin: z.string().regex(/^\d{4,8}$/) });
const choosePin = z.object({ action: z.literal('choose-pin'), deviceId: z.string().max(64), token: z.string().max(2048), pin: z.string().regex(/^\d{4,8}$/) });
const pair = z.object({ action: z.literal('pair'), deviceId: z.string().max(64), code: z.string().regex(/^\d{6}$/) });
const approve = z.object({ action: z.literal('approve'), deviceId: z.string().max(64), pin: z.string().regex(/^\d{4,8}$/), permission: z.enum(['void.approve', 'discount.approve', 'hold.set']) });

const lockedMessage = (until: number, timezone: string) => `This PIN is locked until ${formatTime(until, timezone)}. A manager can unlock it in the Console.`;

/** A signed-in person, as every station sign-in answers. */
function signedIn(staff: { id: string; displayName: string }, roleKey: string | undefined, permissions: readonly string[], deviceId: string) {
  return wireResponse({
    ok: true,
    staff: { id: staff.id, displayName: staff.displayName, roleKey, permissions },
    signedInAt: Date.now(),
    token: identity.issueStationToken(staff.id, deviceId),
  });
}

/**
 * Station identity: PIN plus device binding. A PIN is checked against its hash on the server; the
 * outlet's policy says how many wrong attempts lock that PIN for 15 minutes, and an address that keeps guessing is slowed the same
 * way. A correct PIN on a registered device returns a signed station token, which every other station
 * request carries. An approval returns a signed token for that one permission, which the server
 * checks when the void arrives. The copy never blames the person.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return wireResponse({ ok: false, message: 'A PIN is four to eight digits.' }, { status: 400 });
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

  // Pairing: the first time a device is used, it proves it is the one the manager registered.
  const asPair = pair.safeParse(json);
  if (asPair.success) {
    const key = `pair:${device.id}`;
    const state = credentials.attemptStatus(key);
    if (state.locked) return wireResponse({ ok: false, message: `Pairing is paused until ${formatTime(state.until, outlet.timezone)} after several wrong codes.` }, { status: 423 });
    const result = await withWrite(() => venue.pairDevice(device.id, asPair.data.code));
    if (result === 'paired') {
      credentials.clearAttempts(key);
      return wireResponse({ ok: true });
    }
    credentials.recordFailure(address);
    credentials.recordFailure(key);
    return wireResponse(
      {
        ok: false,
        message: result === 'expired' ? 'That code has run out. A manager can make a new one in Console, Settings, Devices.' : 'That code does not match. Check the code shown in the Console.',
      },
      { status: 401 },
    );
  }
  if (venue.pairingRequired(device.id)) {
    return wireResponse({ ok: false, code: 'PAIRING_REQUIRED', message: `${device.label} needs pairing first. Enter the six-digit code shown in Console, Settings, Devices.` }, { status: 409 });
  }

  const asSignIn = signIn.safeParse(json);
  if (asSignIn.success) {
    const { staffId, pin } = asSignIn.data;
    const key = `pin:${staffId}`;
    const tries = pins.lockAttempts();
    const state = credentials.attemptStatus(key, Date.now(), tries);
    if (state.locked) return wireResponse({ ok: false, message: lockedMessage(state.until, outlet.timezone) }, { status: 423 });
    if (!identity.verifyStaffPin(staffId, pin)) {
      credentials.recordFailure(address);
      const after = credentials.recordFailure(key, Date.now(), tries);
      if (after.locked) return wireResponse({ ok: false, message: lockedMessage(after.until, outlet.timezone) }, { status: 423 });
      return wireResponse(
        { ok: false, message: `That PIN was not recognised. ${after.remaining === 1 ? 'One attempt' : `${after.remaining} attempts`} left before this PIN locks for 15 minutes.` },
        { status: 401 },
      );
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
    // A reset or expired PIN is right, but its person chooses a new one before working.
    if (pins.mustChangeAtSignIn(staff)) {
      return wireResponse(
        {
          ok: false,
          code: 'PIN_CHANGE_REQUIRED',
          message: staff.pinMustChange ? 'A manager set this PIN for you. Choose one only you know.' : 'Your PIN has run out. Choose a new one.',
          token: identity.issuePinChangeToken(staff.id),
          length: pins.policy().length,
        },
        { status: 409 },
      );
    }
    return signedIn(staff, role?.key, role?.permissions ?? [], device.id);
  }

  const asChoose = choosePin.safeParse(json);
  if (asChoose.success) {
    const staff = identity.staffFromPinChangeToken(asChoose.data.token);
    if (!staff) return wireResponse({ ok: false, code: 'PIN_CHANGE_EXPIRED', message: 'That took too long. Sign in again with the PIN you were given.' }, { status: 401 });
    const role = identity.roleFor(staff.id);
    if (!isStaffSurface(device.kind) || !canSignInOn(device.kind, role?.key)) return wireResponse({ ok: false, message: 'Staff do not sign in on this device.' }, { status: 403 });
    try {
      await withWrite(() => pins.chooseOwnPin({ staffId: staff.id, next: asChoose.data.pin, viaSignIn: true }));
    } catch (error) {
      if (error instanceof DomainError) return wireResponse({ ok: false, message: error.message }, { status: 422 });
      throw error;
    }
    return signedIn(staff, role?.key, role?.permissions ?? [], device.id);
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

  return wireResponse({ ok: false, message: 'A PIN is four to eight digits.' }, { status: 400 });
}
