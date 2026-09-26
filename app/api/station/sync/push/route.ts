import { type OutboxKind, outboxPayloads } from '@bliss/shared/sync';
import { z } from 'zod';
import { refused, stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { currentSeq } from '@/modules/_data/changes';
import * as availability from '@/modules/availability/service';
import { withWrite } from '@/modules/_data/store';
import { applyEntry } from '@/modules/sync/apply';

export const dynamic = 'force-dynamic';

const entrySchema = z.object({
  id: z.string(),
  seq: z.number().int(),
  deviceId: z.string(),
  staffId: z.string(),
  kind: z.enum(Object.keys(outboxPayloads) as [OutboxKind, ...OutboxKind[]]),
  aggregateId: z.string(),
  payload: z.unknown(),
  clientAt: z.number(),
});

const MAX_ENTRIES = 200;
const MAX_BYTES = 2_000_000;

/**
 * Station push. docs/14 section 4: every entry is applied through its owning module, in the order
 * the device sent it, once. A repeat is acknowledged without a second effect; a refusal comes back
 * with a code and becomes a dead letter in Console, Settings, Sync.
 *
 * The request carries the device's station token, and every entry must come from that device. The
 * person on an entry may differ from the one signed in now: an order taken offline by one waiter can
 * be sent after the next has signed in, and it is still that first waiter's order.
 */
export async function POST(request: Request) {
  const auth = stationAuth(request);
  if (!auth.ok) return refused(auth);
  const text = await request.text();
  if (text.length > MAX_BYTES) return wireResponse({ ok: false, message: 'Too much to send at once. The tablet sends it in smaller parts.' }, { status: 413 });
  // Parsed without the money reviver: outbox payloads carry cents as strings, and the payload schemas
  // validate exactly that wire shape.
  let body: { entries?: unknown[] };
  try {
    body = JSON.parse(text) as { entries?: unknown[] };
  } catch {
    return wireResponse({ ok: false, message: 'This request was not in a shape the server accepts.' }, { status: 400 });
  }
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, MAX_ENTRIES) : [];
  const results = await withWrite(() =>
    entries.map((raw) => {
      const parsed = entrySchema.safeParse(raw);
      if (!parsed.success) return { id: (raw as { id?: string })?.id ?? 'unknown', status: 'rejected' as const, code: 'VALIDATION_FAILED' as const, detail: 'This change was not in a shape the server accepts.' };
      if (parsed.data.deviceId !== auth.device.id) return { id: parsed.data.id, status: 'rejected' as const, code: 'VALIDATION_FAILED' as const, detail: 'This change belongs to another device.' };
      return applyEntry(parsed.data);
    }),
  );
  return wireResponse({ results, availabilityVersion: availability.map().version, cursor: currentSeq() });
}
