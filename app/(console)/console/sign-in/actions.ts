'use server';

import { formatTime } from '@bliss/shared/format';
import { canSignInOn, wrongSurfaceMessage } from '@bliss/shared/identity';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { fresh, withWrite } from '@/modules/_data/store';
import * as credentials from '@/modules/identity/credentials';
import * as identity from '@/modules/identity/service';
import * as audit from '@/modules/audit/service';

const input = z.object({ staffId: z.string().min(1).max(64), pin: z.string().regex(/^\d{6}$/) });

async function address(): Promise<string> {
  const h = await headers();
  return `console-ip:${h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'}`;
}

/**
 * Console sign-in. The PIN is checked against its hash; five wrong attempts lock that PIN for 15
 * minutes, and an address that keeps guessing is paused the same way. A correct PIN for someone who
 * belongs in the Console sets a signed, expiring session cookie. The copy never blames the person.
 */
export async function signInToConsole(staffId: string, pin: string): Promise<{ ok: false; message: string } | undefined> {
  const parsed = input.safeParse({ staffId, pin });
  if (!parsed.success) return { ok: false, message: 'A PIN is six digits.' };
  await fresh();
  const outlet = identity.outlet();
  const where = await address();
  const who = `pin:${parsed.data.staffId}`;

  const fromHere = credentials.attemptStatus(where);
  if (fromHere.locked) return { ok: false, message: `Too many wrong PINs from this browser. Try again at ${formatTime(fromHere.until, outlet.timezone)}.` };
  const state = credentials.attemptStatus(who);
  if (state.locked) return { ok: false, message: `This PIN is locked until ${formatTime(state.until, outlet.timezone)}. Another manager can unlock it in People.` };

  const staff = identity.staffById(parsed.data.staffId);
  if (!staff || !identity.verifyStaffPin(staff.id, parsed.data.pin)) {
    credentials.recordFailure(where);
    const after = credentials.recordFailure(who);
    if (after.locked) {
      if (staff) await withWrite(() => audit.record({ outletId: outlet.id, actorStaffId: staff.id, action: 'staff.pin_locked', entityType: 'staff', entityId: staff.id, before: null, after: { surface: 'console', until: after.until }, reason: null, severity: 'notable' }));
      return { ok: false, message: `This PIN is locked until ${formatTime(after.until, outlet.timezone)}. Another manager can unlock it in People.` };
    }
    return { ok: false, message: `That PIN was not recognised. ${after.remaining === 1 ? 'One attempt' : `${after.remaining} attempts`} left before it locks for 15 minutes.` };
  }
  credentials.clearAttempts(who);

  if (staff.employmentStatus !== 'active') return { ok: false, message: 'This PIN no longer works. A manager can check your access in People.' };
  const role = identity.roleFor(staff.id);
  if (!canSignInOn('console', role?.key)) return { ok: false, message: wrongSurfaceMessage('console', role?.key) };

  if (identity.pinState(staff) === 'needs_reset') await withWrite(() => identity.upgradePinHash(staff.id, parsed.data.pin));
  await withWrite(() => audit.record({ outletId: outlet.id, actorStaffId: staff.id, action: 'console.signed_in', entityType: 'staff', entityId: staff.id, before: null, after: null, reason: null, severity: 'info' }));

  (await cookies()).set(identity.CONSOLE_COOKIE, identity.issueConsoleSession(staff.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(identity.CONSOLE_SESSION_MS / 1000),
  });
  redirect('/console/overview');
}

export async function signOutFromConsole() {
  (await cookies()).delete(identity.CONSOLE_COOKIE);
  redirect('/console/sign-in');
}
