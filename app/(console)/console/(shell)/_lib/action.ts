import 'server-only';

import { revalidatePath } from 'next/cache';
import { type Cents, isNegative, parseKes } from '@bliss/shared/money';
import { z } from 'zod';
import { isUserFacing } from '@/modules/_data/errors';
import { withWrite } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import type { ActionResult } from './action-result';

export type { ActionResult } from './action-result';

type ConsoleActor = Awaited<ReturnType<typeof identity.currentConsoleActor>>;

const FALLBACK = 'That did not go through, and nothing was changed. Try again in a moment.';

/**
 * The one way a Console action runs. docs/19 section 3.
 *
 *  1. The signed-in actor is resolved from the session cookie (a missing or ended session redirects).
 *  2. The input is parsed with its schema: types do not reach runtime, so every field is checked here.
 *  3. The work runs inside withWrite, so it is permanent in Postgres or not applied at all.
 *  4. A refusal written for people comes back as its sentence; anything else is logged and answered
 *     with a generic sentence, so internal messages never reach a screen.
 *  5. The paths the work changed are revalidated.
 *
 * Permission and business rules stay in the module services; this layer only guarantees how they run.
 */
export async function runAction<S extends z.ZodType, R extends object | void>(
  schema: S,
  raw: unknown,
  work: (input: z.infer<S>, actor: ConsoleActor) => R,
  options: { revalidate?: string[] } = {},
): Promise<ActionResult<R extends object ? R : object>> {
  const actor = await identity.currentConsoleActor();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? FALLBACK };
  try {
    const result = await withWrite(() => work(parsed.data, actor));
    for (const path of options.revalidate ?? ['/console']) revalidatePath(path, 'layout');
    return { ok: true, ...(result ?? {}) } as ActionResult<R extends object ? R : object>;
  } catch (error) {
    if (isUserFacing(error)) return { ok: false, message: error.message };
    console.error('[console action]', error);
    return { ok: false, message: FALLBACK };
  }
}

/* ---------------------------------------------------------- shared schemas */

/** Ids are uuids or seeded ids: short, plain tokens. */
export const id = (what = 'item') => z.string({ error: `Choose the ${what} again.` }).min(1, `Choose the ${what} again.`).max(64, `Choose the ${what} again.`);

/** A reason: the service checks the words; this only bounds the size. */
export const reason = z.string({ error: 'Write a reason.' }).max(500, 'Keep the reason under 500 characters.');

/** Free text, trimmed, bounded, empty as null. */
export const optionalText = (max: number, what: string) =>
  z
    .string()
    .max(max, `${what} is at most ${max} characters.`)
    .nullable()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null));

/** Money crosses the wire as a string of shillings and becomes Cents here, never a float. */
export const kes = (what: string) =>
  z
    .string({ error: `Enter ${what} in shillings.` })
    .max(20, `Enter ${what} in shillings, such as 1,250 or 1250.50.`)
    .transform((value, ctx): Cents => {
      try {
        const amount = parseKes(value.trim());
        if (isNegative(amount)) throw new Error('negative');
        return amount;
      } catch {
        ctx.addIssue({ code: 'custom', message: `Enter ${what} in shillings, such as 1,250 or 1250.50.` });
        return z.NEVER;
      }
    });

/** A client-generated request key, so a double submit changes nothing twice. */
export const requestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Reload the page and try again.').nullable().optional();

export const wholeNumber = (what: string, max = 100_000) => z.number({ error: `Enter ${what} as a whole number.` }).int(`Enter ${what} as a whole number.`).min(0, `${what} cannot be below zero.`).max(max, `${what} is at most ${max.toLocaleString('en-KE')}.`);

/** A calendar date typed in a date field. */
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date, such as 2027-03-31.');
