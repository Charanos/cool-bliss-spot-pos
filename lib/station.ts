import 'server-only';

import { wireResponse } from '@/lib/wire';
import * as identity from '@/modules/identity/service';

/**
 * Station authentication for the Floor and Counter API. A device proves a person entered their PIN on
 * it by sending the signed station token issued at sign-in. The token is read from a header, never
 * from the body, and the person and device it names are the only ones the request may act for.
 */
export const STATION_HEADER = 'x-bliss-station';

export function stationToken(request: Request): string | null {
  const header = request.headers.get(STATION_HEADER);
  if (header) return header;
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function stationAuth(request: Request, deviceId?: string | null): identity.StationCheck {
  return identity.checkStationToken(stationToken(request), deviceId);
}

export function refused(check: Extract<identity.StationCheck, { ok: false }>): Response {
  return wireResponse({ ok: false, code: 'SIGN_IN_REQUIRED', message: check.message }, { status: check.status });
}

/** The caller's address, for attempt limits. Behind a proxy the first forwarded address is the client. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
