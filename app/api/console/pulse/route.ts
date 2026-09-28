import { wireResponse } from '@/lib/wire';
import { currentSeq } from '@/modules/_data/changes';
import { dataset } from '@/modules/_data/source';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import { kickNotifications } from '@/modules/notify/send';

export const dynamic = 'force-dynamic';

/**
 * The Console's heartbeat: one figure that moves whenever trade, the menu or stock changes anywhere,
 * so an open page knows to fetch itself again. Only for someone signed in to the Console.
 */
export async function GET(request: Request) {
  const cookie = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${identity.CONSOLE_COOKIE}=([^;]+)`))?.[1];
  await fresh();
  if (!identity.checkConsoleSession(cookie).ok) return wireResponse({ ok: false }, { status: 401 });
  const d = dataset();
  // Trade rows, the menu, availability, stock, the drawers and the audit trail (which every notable
  // change in the Console writes to): any of them moving means the page may read differently.
  const parts = [d.epoch, currentSeq(), d.catalogueVersion, d.availabilityVersion, d.movements.length, d.cashMovements.length, d.auditEvents.length];
  kickNotifications({ idle: true });
  return wireResponse({ ok: true, pulse: parts.join(':') });
}
