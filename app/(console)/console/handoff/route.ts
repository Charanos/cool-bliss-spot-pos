import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { fresh, withWrite } from '@/modules/_data/store';
import * as audit from '@/modules/audit/service';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * Arriving in the Console from a station, as the person signed in there. The ticket names them and
 * works once; the Console session it starts is theirs, and replaces any other left in this browser,
 * so what they do next is recorded against them and no one else.
 */
export async function GET(request: Request) {
  await fresh();
  const url = new URL(request.url);
  const check = identity.redeemHandoff(url.searchParams.get('ticket'), 'console');
  if (!check.ok) return NextResponse.redirect(new URL('/console/sign-in', url), { status: 303 });
  (await cookies()).set(identity.CONSOLE_COOKIE, identity.issueConsoleSession(check.staff.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(identity.CONSOLE_SESSION_MS / 1000),
  });
  await withWrite(() =>
    audit.record({ outletId: identity.outlet().id, actorStaffId: check.staff.id, actorDeviceId: null, action: 'session.switched', entityType: 'staff', entityId: check.staff.id, before: { surface: check.from }, after: { surface: 'console' }, reason: null, severity: 'info' }),
  );
  return NextResponse.redirect(new URL('/console/overview', url), { status: 303 });
}
