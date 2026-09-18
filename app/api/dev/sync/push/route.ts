import { type OutboxKind, outboxPayloads } from '@bliss/shared/sync';
import { z } from 'zod';
import { devDataEnabled, notFound } from '@/lib/dev';
import { wireResponse } from '@/lib/wire';
import { currentSeq } from '@/modules/_data/changes';
import * as availability from '@/modules/availability/service';
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

/**
 * Development push. docs/14 section 4: every entry is applied through its owning module, in the order
 * the device sent it, once. A repeat is acknowledged without a second effect; a refusal comes back
 * with a code and becomes a dead letter in Console, Settings, Sync.
 */
export async function POST(request: Request) {
  if (!devDataEnabled()) return notFound();
  // Parsed without the money reviver: outbox payloads carry cents as strings, and the payload schemas
  // validate exactly that wire shape.
  const body = JSON.parse(await request.text()) as { entries?: unknown[] };
  const results = (body.entries ?? []).map((raw) => {
    const parsed = entrySchema.safeParse(raw);
    if (!parsed.success) return { id: (raw as { id?: string })?.id ?? 'unknown', status: 'rejected' as const, code: 'VALIDATION_FAILED' as const, detail: 'This change was not in a shape the server accepts.' };
    return applyEntry(parsed.data);
  });
  return wireResponse({ results, availabilityVersion: availability.map().version, cursor: currentSeq() });
}
