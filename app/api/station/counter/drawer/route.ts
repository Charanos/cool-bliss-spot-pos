import { cents } from '@bliss/shared/money';
import { z } from 'zod';
import { refused, stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { CommandRejected } from '@/modules/_data/changes';
import { isUserFacing } from '@/modules/_data/errors';
import { fresh, withWrite } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import * as settlementCommands from '@/modules/settlement/commands';

export const dynamic = 'force-dynamic';

const base = { deviceId: z.string(), staffId: z.string() };
const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preflight'), ...base }),
  z.object({ action: z.literal('count'), ...base, sessionId: z.string(), countedCents: z.string().regex(/^\d+$/) }),
  z.object({ action: z.literal('close'), ...base, sessionId: z.string(), reason: z.string().max(280).nullable() }),
]);

/**
 * Closing the drawer, docs/05 section 2.12 and docs/14 section 5. Not an outbox entry: the count must
 * be locked on the server before the expected figure exists anywhere a device can read it, so this
 * step needs the connection, and the Counter says so.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = JSON.parse(await request.text());
  } catch {
    return wireResponse({ ok: false, message: 'This request was not in a shape the server accepts.' }, { status: 400 });
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return wireResponse({ ok: false, message: 'This request was not in a shape the server accepts.' }, { status: 400 });
  const input = parsed.data;
  await fresh();

  const device = identity.devices().find((d) => d.id === input.deviceId);
  if (!device || device.status !== 'active' || device.kind !== 'counter') {
    return wireResponse({ ok: false, message: 'The drawer is closed at a registered counter device.' }, { status: 403 });
  }
  // The drawer is counted and closed live, by the person signed in on this counter: the token says who.
  const auth = stationAuth(request, device.id);
  if (!auth.ok) return refused(auth);
  if (auth.staff.id !== input.staffId) return wireResponse({ ok: false, message: 'Sign in again to close the drawer.' }, { status: 401 });
  const actor = { staffId: auth.staff.id, deviceId: device.id };

  try {
    if (input.action === 'preflight') return wireResponse({ ok: true, openTabs: settlementCommands.closePreflight() });
    if (input.action === 'count') {
      const result = await withWrite(() => settlementCommands.countDrawer({ sessionId: input.sessionId, countedCents: cents(input.countedCents), actor }));
      return wireResponse({ ok: true, ...result });
    }
    return wireResponse({ ok: true, view: await withWrite(() => settlementCommands.closeDrawer({ sessionId: input.sessionId, reason: input.reason, actor })) });
  } catch (error) {
    if (error instanceof CommandRejected) return wireResponse({ ok: false, code: error.code, message: error.message }, { status: 409 });
    if (isUserFacing(error)) return wireResponse({ ok: false, message: error.message }, { status: 403 });
    throw error;
  }
}
