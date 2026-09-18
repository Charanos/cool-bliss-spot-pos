import { cents } from '@bliss/shared/money';
import { z } from 'zod';
import { devDataEnabled, notFound } from '@/lib/dev';
import { wireResponse } from '@/lib/wire';
import { CommandRejected } from '@/modules/_data/changes';
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
  if (!devDataEnabled()) return notFound();
  const parsed = body.safeParse(JSON.parse(await request.text()));
  if (!parsed.success) return wireResponse({ ok: false, message: 'This request was not in a shape the server accepts.' }, { status: 400 });
  const input = parsed.data;

  const device = identity.devices().find((d) => d.id === input.deviceId);
  if (!device || device.status !== 'active' || device.kind !== 'counter') {
    return wireResponse({ ok: false, message: 'The drawer is closed at a registered counter device.' }, { status: 403 });
  }
  if (!identity.staffById(input.staffId)) return wireResponse({ ok: false, message: 'Sign in again to close the drawer.' }, { status: 401 });
  const actor = { staffId: input.staffId, deviceId: device.id };

  try {
    if (input.action === 'preflight') return wireResponse({ ok: true, openTabs: settlementCommands.closePreflight() });
    if (input.action === 'count') {
      const result = settlementCommands.countDrawer({ sessionId: input.sessionId, countedCents: cents(input.countedCents), actor });
      return wireResponse({ ok: true, ...result });
    }
    return wireResponse({ ok: true, view: settlementCommands.closeDrawer({ sessionId: input.sessionId, reason: input.reason, actor }) });
  } catch (error) {
    if (error instanceof CommandRejected) return wireResponse({ ok: false, code: error.code, message: error.message }, { status: 409 });
    if (error instanceof Error) return wireResponse({ ok: false, message: error.message }, { status: 403 });
    throw error;
  }
}
