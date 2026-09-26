import { refused, stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { fresh } from '@/modules/_data/store';
import { history } from '@/modules/history/service';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * Station history, docs/16 section 9. A read, never cached by the service worker (it is under
 * /api), and never a place a device writes from.
 *
 *   from, to   business dates, inclusive; clamped to tonight and to 93 days
 *   staff      only tabs this person opened or looks after
 *   only       only bills settled on this device
 *   device     the device asking, so the blind count can keep tonight's takings back
 *   q          table, waiter, tab number or item
 */
export async function GET(request: Request) {
  await fresh();
  const url = new URL(request.url);
  const param = (key: string) => url.searchParams.get(key)?.trim() || null;

  // History is read by a signed-in device, about itself: the asking device is the token's device.
  const auth = stationAuth(request, param('device'));
  if (!auth.ok) return refused(auth);
  const askingDevice = auth.device.id;
  const staffId = param('staff');
  if (staffId && !identity.staffById(staffId)) {
    return wireResponse({ ok: false, message: 'That person is not on the staff list.' }, { status: 400 });
  }

  const result = history({
    from: param('from') ?? '',
    to: param('to') ?? '',
    staffId,
    onlyDevice: param('only'),
    askingDevice,
    q: param('q'),
  } as Parameters<typeof history>[0]);

  return wireResponse({ ok: true, ...result });
}
