'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import * as inventory from '@/modules/inventory/service';
import { type ActionResult, id, optionalText, reason, runAction } from '../_lib/action';

/** Inventory actions. docs/19 section 3: validated here, ruled in the inventory service. */

export async function placeHold(raw: { variantId: string; reason: string; expectedBack: string | null }): Promise<ActionResult> {
  return runAction(z.object({ variantId: id('item'), reason, expectedBack: optionalText(40, 'Expected back') }), raw, (input, actor) => {
    inventory.placeHold({ ...input, actor });
  });
}

export async function releaseHold(raw: { holdId: string; note: string }): Promise<ActionResult> {
  return runAction(z.object({ holdId: id('hold'), note: z.string().max(500, 'Keep the note under 500 characters.') }), raw, (input, actor) => {
    inventory.releaseHold({ ...input, actor });
  });
}

export async function writeOff(raw: { variantId: string; locationId: string; qty: number; category: inventory.WriteOffCategory; reason: string }): Promise<ActionResult> {
  const schema = z.object({
    variantId: id('item'),
    locationId: id('location'),
    qty: z.number({ error: 'Enter how many units.' }).positive('Write off at least one unit.').max(100_000, 'That is more than any shelf holds.'),
    category: z.enum(inventory.WRITE_OFF_CATEGORIES, { error: 'Choose what kind of write-off this is.' }),
    reason,
  });
  return runAction(schema, raw, (input, actor) => {
    inventory.writeOff({ ...input, actor });
  });
}

/** Start a count, then go straight to it. A form action: failures come back to the form as a query. */
export async function openCount(formData: FormData): Promise<void> {
  const raw = {
    locationId: String(formData.get('locationId') ?? ''),
    kind: String(formData.get('kind') ?? 'full'),
    categoryId: String(formData.get('categoryId') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  };
  const schema = z.object({ locationId: id('location'), kind: z.enum(inventory.COUNT_KINDS, { error: 'Choose a full, cycle or spot count.' }), categoryId: z.string().max(64), notes: optionalText(500, 'Notes') });
  const result = await runAction(schema, raw, (input, actor) => ({ countId: inventory.openCount({ locationId: input.locationId, kind: input.kind, categoryIds: input.categoryId ? [input.categoryId] : [], notes: input.notes, actor }).id }), { revalidate: ['/console/inventory'] });
  if (!result.ok) redirect(`/console/inventory/counts/new?error=${encodeURIComponent(result.message)}`);
  redirect(`/console/inventory/counts/${result.countId}`);
}

export async function recordCounted(raw: { countLineId: string; countedQty: number | null }): Promise<ActionResult> {
  const schema = z.object({ countLineId: id('count line'), countedQty: z.number({ error: 'Enter a number.' }).min(0, 'Counts are zero or more.').max(1_000_000, 'That is more than any shelf holds.').nullable() });
  return runAction(schema, raw, (input, actor) => {
    inventory.recordCounted({ ...input, actor });
  }, { revalidate: ['/console/inventory/counts'] });
}

export async function submitForReview(raw: { countId: string }): Promise<ActionResult> {
  return runAction(z.object({ countId: id('count') }), raw, (input, actor) => {
    inventory.submitForReview({ ...input, actor });
  }, { revalidate: ['/console/inventory'] });
}

export async function recountLine(raw: { countLineId: string }): Promise<ActionResult> {
  return runAction(z.object({ countLineId: id('count line') }), raw, (input, actor) => {
    inventory.returnLineToCounting({ ...input, actor });
  }, { revalidate: ['/console/inventory'] });
}

export async function commitCount(raw: { countId: string; reasons: Record<string, string>; reason: string }): Promise<ActionResult> {
  const schema = z.object({ countId: id('count'), reasons: z.record(z.string().max(64), z.string().max(500, 'Keep each reason under 500 characters.')), reason });
  return runAction(schema, raw, (input, actor) => {
    inventory.commitCount({ ...input, actor });
  });
}

export async function cancelCount(raw: { countId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ countId: id('count'), reason }), raw, (input, actor) => {
    inventory.cancelCount({ ...input, actor });
  }, { revalidate: ['/console/inventory'] });
}
