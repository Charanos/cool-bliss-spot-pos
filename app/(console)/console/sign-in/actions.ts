'use server';

import { formatTime } from '@bliss/shared/format';
import { canSignInOn, wrongSurfaceMessage } from '@bliss/shared/identity';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DomainError } from '@/modules/_data/errors';
import { fresh, withWrite } from '@/modules/_data/store';
import * as credentials from '@/modules/identity/credentials';
import * as pins from '@/modules/identity/pins';
import * as identity from '@/modules/identity/service';
import * as audit from '@/modules/audit/service';

const input = z.object({ staffId: z.string().min(1).max(64), pin: z.string().regex(/^\d{4,8}$/) });

async function address(): Promise<string> {
  const h = await headers();
  return `console-ip:${h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'}`;
}

export type SignInResult = { ok: false; message: string } | { ok: true; change: true; token: string; length: number; reason: 'reset' | 'expired' } | undefined;

async function startSession(staffId: string) {
  (await cookies()).set(identity.CONSOLE_COOKIE, identity.issueConsoleSession(staffId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(identity.CONSOLE_SESSION_MS / 1000),
  });
}

/**
 * Console sign-in. The PIN is checked against its hash; the outlet's policy says how many wrong
 * attempts lock that PIN for 15 minutes, and an address that keeps guessing is paused the same way. A
 * correct PIN for someone who belongs in the Console sets a signed, expiring session cookie, unless a
 * manager's reset or an expiry means they choose a new PIN first. The copy never blames the person.
 */
export async function signInToConsole(staffId: string, pin: string): Promise<SignInResult> {
  const parsed = input.safeParse({ staffId, pin });
  if (!parsed.success) return { ok: false, message: 'A PIN is four to eight digits.' };
  await fresh();
  const outlet = identity.outlet();
  const where = await address();
  const who = `pin:${parsed.data.staffId}`;

  const fromHere = credentials.attemptStatus(where);
  if (fromHere.locked) return { ok: false, message: `Too many wrong PINs from this browser. Try again at ${formatTime(fromHere.until, outlet.timezone)}.` };
  const tries = pins.lockAttempts();
  const state = credentials.attemptStatus(who, Date.now(), tries);
  if (state.locked) return { ok: false, message: `This PIN is locked until ${formatTime(state.until, outlet.timezone)}. Another manager can unlock it in People.` };

  const staff = identity.staffById(parsed.data.staffId);
  if (!staff || !identity.verifyStaffPin(staff.id, parsed.data.pin)) {
    credentials.recordFailure(where);
    const after = credentials.recordFailure(who, Date.now(), tries);
    if (after.locked) {
      if (staff)
        await withWrite(() =>
          audit.record({
            outletId: outlet.id,
            actorStaffId: staff.id,
            action: 'staff.pin_locked',
            entityType: 'staff',
            entityId: staff.id,
            before: null,
            after: { surface: 'console', until: after.until },
            reason: null,
            severity: 'notable',
          }),
        );
      return { ok: false, message: `This PIN is locked until ${formatTime(after.until, outlet.timezone)}. Another manager can unlock it in People.` };
    }
    return { ok: false, message: `That PIN was not recognised. ${after.remaining === 1 ? 'One attempt' : `${after.remaining} attempts`} left before it locks for 15 minutes.` };
  }
  credentials.clearAttempts(who);

  if (staff.employmentStatus !== 'active') return { ok: false, message: 'This PIN no longer works. A manager can check your access in People.' };
  const role = identity.roleFor(staff.id);
  if (!canSignInOn('console', role?.key)) return { ok: false, message: wrongSurfaceMessage('console', role?.key) };

  if (identity.pinState(staff) === 'needs_reset') await withWrite(() => identity.upgradePinHash(staff.id, parsed.data.pin));
  if (pins.mustChangeAtSignIn(staff)) {
    return { ok: true, change: true, token: identity.issuePinChangeToken(staff.id), length: pins.policy().length, reason: staff.pinMustChange ? 'reset' : 'expired' };
  }
  await withWrite(() =>
    audit.record({ outletId: outlet.id, actorStaffId: staff.id, action: 'console.signed_in', entityType: 'staff', entityId: staff.id, before: null, after: null, reason: null, severity: 'info' }),
  );
  await startSession(staff.id);
  redirect('/console/overview');
}

/**
 * The second step after a reset or an expiry: the person chooses their own PIN, with the short pass
 * the first step gave them, and is signed in with it.
 */
export async function chooseConsolePin(token: string, next: string): Promise<{ ok: false; message: string; restart?: boolean } | undefined> {
  if (!/^\d{4,8}$/.test(next)) return { ok: false, message: 'A PIN is four to eight digits.' };
  await fresh();
  const staff = identity.staffFromPinChangeToken(token);
  if (!staff) return { ok: false, restart: true, message: 'That took too long. Sign in again with the PIN you were given.' };
  if (!canSignInOn('console', identity.roleFor(staff.id)?.key)) return { ok: false, restart: true, message: wrongSurfaceMessage('console', identity.roleFor(staff.id)?.key) };
  try {
    await withWrite(() => pins.chooseOwnPin({ staffId: staff.id, next, viaSignIn: true }));
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    throw error;
  }
  await withWrite(() =>
    audit.record({ outletId: staff.outletId, actorStaffId: staff.id, action: 'console.signed_in', entityType: 'staff', entityId: staff.id, before: null, after: null, reason: null, severity: 'info' }),
  );
  await startSession(staff.id);
  redirect('/console/overview');
}

export async function signOutFromConsole() {
  (await cookies()).delete(identity.CONSOLE_COOKIE);
  redirect('/console/sign-in');
}
