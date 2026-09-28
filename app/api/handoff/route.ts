import { canSignInOn } from '@bliss/shared/identity';
import { z } from 'zod';
import { stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { fresh, withWrite } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import * as venue from '@/modules/identity/venue';

export const dynamic = 'force-dynamic';

const body = z.object({ from: z.enum(['console', 'station']), to: z.enum(['console', 'floor', 'counter']) });

const DEVICE_COOKIE = 'bliss_device_';

const HOME = { console: '/console/sign-in', floor: '/floor/sign-in', counter: '/counter/sign-in' } as const;

/**
 * Switch surfaces as yourself. The person asking is read from the session of the surface they are on,
 * named in the request, and nothing else: the Console cookie when switching from the Console, this
 * station's token when switching from a station. The answer is where to go: with a one-use ticket in
 * their name when their role belongs on the other surface, or its PIN screen when it does not.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return wireResponse({ ok: false, url: '/' }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return wireResponse({ ok: false, url: '/' }, { status: 400 });
  const { from, to } = parsed.data;
  await fresh();

  let who: { staffId: string; roleKey: Parameters<typeof canSignInOn>[1]; surface: identity.HandoffSurface } | null = null;
  if (from === 'console') {
    const cookie = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${identity.CONSOLE_COOKIE}=([^;]+)`))?.[1];
    const check = identity.checkConsoleSession(cookie);
    if (check.ok) who = { staffId: check.staff.id, roleKey: check.role.key, surface: 'console' };
  } else {
    const check = stationAuth(request);
    if (check.ok && (check.device.kind === 'floor' || check.device.kind === 'counter')) who = { staffId: check.staff.id, roleKey: check.role.key, surface: check.device.kind };
  }
  if (!who || who.surface === to || !canSignInOn(to, who.roleKey)) return wireResponse({ ok: false, url: HOME[to] });

  const ticket = encodeURIComponent(identity.issueHandoff(who.staffId, who.surface, to));
  if (to === 'console') return wireResponse({ ok: true, url: `/console/handoff?ticket=${ticket}` });

  // Managers and owners open a station from their own browser, which the venue never registered as a
  // tablet or a till. It gets a device of its own, in their name, remembered here in a cookie so the
  // same browser keeps the same device. The station uses it only when it holds none the venue knows.
  if (who.roleKey !== 'manager' && who.roleKey !== 'owner') return wireResponse({ ok: true, url: `${HOME[to]}?handoff=${ticket}` });
  const cookieName = `${DEVICE_COOKIE}${to}`;
  const knownId = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`))?.[1] ?? null;
  const staffId = who.staffId;
  const device = await withWrite(() => venue.browserDeviceFor({ staffId, kind: to, knownId }));
  const url = `${HOME[to]}?handoff=${ticket}&device=${encodeURIComponent(device.id)}&label=${encodeURIComponent(device.label)}`;
  return wireResponse(
    { ok: true, url },
    { headers: { 'set-cookie': `${cookieName}=${device.id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` } },
  );
}
