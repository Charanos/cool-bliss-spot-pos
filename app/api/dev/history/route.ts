import { devDataEnabled, notFound } from '@/lib/dev';
import { wireResponse } from '@/lib/wire';
import { fresh } from '@/modules/_data/store';
import { history } from '@/modules/history/service';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * Development history, docs/16 section 9. A read, never cached by the service worker (it is under
 * /api), and never a place a device writes from.
 *
 *   from, to   business dates, inclusive; clamped to tonight and to 93 days
 *   staff      only tabs this person opened or looks after
 *   only       only bills settled on this device
 *   device     the device asking, so the blind count can keep tonight's takings back
 *   q          table, waiter, tab number or item
 */
export async function GET(request: Request) {
  if (!devDataEnabled()) return notFound();
  await fresh();
  const url = new URL(request.url);
  const param = (key: string) => url.searchParams.get(key)?.trim() || null;

  const askingDevice = param('device');
  if (askingDevice && !identity.devices().some((d) => d.id === askingDevice && d.status === 'active')) {
    return wireResponse({ ok: false, message: 'This device is not registered to the outlet.' }, { status: 403 });
  }
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
