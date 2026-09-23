import { DEV_PINS } from '@bliss/db/seed/organisation';
import { formatTime } from '@bliss/shared/format';
import { canSignInOn, isStaffSurface, wrongSurfaceMessage } from '@bliss/shared/identity';
import { z } from 'zod';
import { devDataEnabled, notFound } from '@/lib/dev';
import { wireResponse } from '@/lib/wire';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

const signIn = z.object({ action: z.literal('sign-in'), deviceId: z.string(), staffId: z.string(), pin: z.string().regex(/^\d{6}$/) });
const approve = z.object({ action: z.literal('approve'), deviceId: z.string(), pin: z.string().regex(/^\d{6}$/), permission: z.enum(['void.approve', 'discount.approve', 'hold.set']) });

const attempts = (globalThis as unknown as { __blissPin?: Map<string, { failures: number; lockedUntil: number }> }).__blissPin ?? new Map();
(globalThis as unknown as { __blissPin?: typeof attempts }).__blissPin = attempts;

const LOCK_MS = 15 * 60_000;

/**
 * Development identity. PIN plus device binding, with the Phase 1 rules that shape the interface:
 * five failures lock a PIN for 15 minutes, and the copy never blames the person.
 * Argon2id, JWT issuance and refresh rotation arrive with the identity module in Phase 1.
 */
export async function POST(request: Request) {
  if (!devDataEnabled()) return notFound();
  const json: unknown = await request.json();
  await fresh();
  const outlet = identity.outlet();

  const device = identity.devices().find((d) => d.id === (json as { deviceId?: string })?.deviceId);
  if (!device) return wireResponse({ ok: false, message: `This device is not registered to ${outlet.name}. A manager needs to add it in Console, Settings, Devices.` }, { status: 403 });
  if (device.status !== 'active') {
    return wireResponse({ ok: false, message: `This device was withdrawn. Orders held on it are safe and a manager can recover them.` }, { status: 403 });
  }

  const asSignIn = signIn.safeParse(json);
  if (asSignIn.success) {
    const { staffId, pin } = asSignIn.data;
    const state = attempts.get(staffId) ?? { failures: 0, lockedUntil: 0 };
    if (state.lockedUntil > Date.now()) {
      return wireResponse({ ok: false, message: `This PIN is locked until ${formatTime(state.lockedUntil, outlet.timezone)}. A manager can unlock it in the Console.` }, { status: 423 });
    }
    if (DEV_PINS[staffId] !== pin) {
      state.failures += 1;
      const left = 5 - state.failures;
      if (left <= 0) {
        state.lockedUntil = Date.now() + LOCK_MS;
        state.failures = 0;
        attempts.set(staffId, state);
        return wireResponse({ ok: false, message: `This PIN is locked until ${formatTime(state.lockedUntil, outlet.timezone)}. A manager can unlock it in the Console.` }, { status: 423 });
      }
      attempts.set(staffId, state);
      return wireResponse({ ok: false, message: `That PIN was not recognised. ${left === 1 ? 'One attempt' : `${left} attempts`} left before this PIN locks for 15 minutes.` }, { status: 401 });
    }
    attempts.delete(staffId);
    const staff = identity.staffById(staffId)!;
    const role = identity.roleFor(staffId);
    // docs/14 section 1: a PIN is right or wrong first, then the device decides whether this role belongs.
    if (staff.employmentStatus !== 'active') {
      return wireResponse({ ok: false, message: 'This PIN no longer works. A manager can check your access in the Console.' }, { status: 403 });
    }
    if (!isStaffSurface(device.kind) || !canSignInOn(device.kind, role?.key)) {
      return wireResponse({ ok: false, message: isStaffSurface(device.kind) ? wrongSurfaceMessage(device.kind, role?.key) : 'Staff do not sign in on this device.' }, { status: 403 });
    }
    return wireResponse({ ok: true, staff: { id: staff.id, displayName: staff.displayName, roleKey: role?.key, permissions: role?.permissions ?? [] }, signedInAt: Date.now() });
  }

  const asApprove = approve.safeParse(json);
  if (asApprove.success) {
    const approver = Object.entries(DEV_PINS).find(([, p]) => p === asApprove.data.pin)?.[0];
    if (!approver || !identity.can(approver, asApprove.data.permission)) {
      return wireResponse({ ok: false, message: 'That PIN cannot approve this. A supervisor or manager needs to enter theirs.' }, { status: 403 });
    }
    return wireResponse({ ok: true, approverId: approver, approverName: identity.displayName(approver), token: crypto.randomUUID() });
  }

  return wireResponse({ ok: false, message: 'Six digits are needed.' }, { status: 400 });
}
