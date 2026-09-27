import { canSignInOn } from '@bliss/shared/identity';
import { cookies } from 'next/headers';
import { stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * From a station to the Console without a second PIN: a manager or owner signed in on this Floor or
 * Counter gets a Console session, the same one the Console's own sign-in issues. The station token
 * is the proof; it is signed, belongs to an active device and ends with a PIN change. Any other role
 * is refused, so a waiter's tablet never opens the Console.
 */
export async function POST(request: Request) {
  await fresh();
  const check = stationAuth(request);
  if (!check.ok) return wireResponse({ ok: false, message: check.message }, { status: check.status });
  if (!canSignInOn('console', check.role.key)) return wireResponse({ ok: false, message: 'The Console is for managers and owners.' }, { status: 403 });
  (await cookies()).set(identity.CONSOLE_COOKIE, identity.issueConsoleSession(check.staff.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(identity.CONSOLE_SESSION_MS / 1000),
  });
  return wireResponse({ ok: true });
}
