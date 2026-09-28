import 'server-only';

import type { Outlet } from '@bliss/shared/domain';
import { type Cents, allocate, formatFigure, isPositive, sum } from '@bliss/shared/money';
import { cookies } from 'next/headers';
import { fresh } from '@/modules/_data/store';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';

/**
 * What every printed ticket shares: who may print, what to say when there is nothing to print yet,
 * and which M-Pesa till each part of a bill is paid to.
 */

export type PrintAccess = { ok: true } | { ok: false; body: string };

/**
 * Bills and tickets print for staff only. A Console browser proves it with its session cookie; a
 * tablet opens the print page in a new window, which carries no headers, so it passes its station
 * token in the address instead. Anyone else is told what to do, on paper, rather than shown a 404.
 */
export async function printAccess(t: string | undefined): Promise<PrintAccess> {
  await fresh();
  if (identity.checkConsoleSession((await cookies()).get(identity.CONSOLE_COOKIE)?.value).ok) return { ok: true };
  if (!t) return { ok: false, body: 'This device has no sign-in to print with. Sign in again, then print again.' };
  const check = identity.checkStationToken(t);
  return check.ok ? { ok: true } : { ok: false, body: `${check.message} Then print again.` };
}

/** How many times a print waits for a record that has not reached the server yet: about 20 seconds. */
export const PRINT_RETRIES = 10;

/** The same print, asked again: the token kept, the attempt counted. */
export function retryHref(path: string, t: string | undefined, attempt: number): string {
  const q = new URLSearchParams();
  if (t) q.set('t', t);
  q.set('a', String(attempt + 1));
  return `${path}?${q.toString()}`;
}

export function attemptOf(a: string | undefined): number {
  const n = Number(a);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** The lines under the name on every ticket: where the place is and how to call it. */
/** The house line, under the logo on every ticket. */
export const TAGLINE = 'Where cool meets bliss';

export function brandLines(outlet: Outlet): string[] {
  return [outlet.address, outlet.phone ? `Tel ${outlet.phone}` : null].filter((x): x is string => Boolean(x));
}

type Routed = { productVariantId: string; lineTotalCents: Cents };

/** Kitchen or bar, by the category the item sits in. Anything unknown is the bar's. */
export function routeOf(variantId: string): 'kitchen' | 'bar' {
  return catalogue.categoryOfVariant(variantId)?.routingTarget === 'kitchen' ? 'kitchen' : 'bar';
}

/**
 * The M-Pesa tills a bill is paid to, with what goes to each. Drinks go to the bar's till and food
 * to the kitchen's. When a bill has both, the amount due is shared between them in proportion to
 * their lines, so a discount or rounding lands on both fairly and the parts add up to the total.
 */
export function tillParts(outlet: Outlet, lines: readonly Routed[], due: Cents): { label: string; till: string; amount: string | null }[] {
  const tills = outlet.tills;
  if (!tills?.bar && !tills?.kitchen) return [];
  const byRoute = { bar: sum(lines.filter((l) => routeOf(l.productVariantId) === 'bar').map((l) => l.lineTotalCents)), kitchen: sum(lines.filter((l) => routeOf(l.productVariantId) === 'kitchen').map((l) => l.lineTotalCents)) };
  const present = (['bar', 'kitchen'] as const).filter((r) => isPositive(byRoute[r]));
  const label = { bar: 'Drinks, bar till', kitchen: 'Food, kitchen till' } as const;
  // One part, or a till missing for one of them: a single till for the whole amount.
  if (present.length < 2 || !tills.bar || !tills.kitchen) {
    const route = present[0] ?? 'bar';
    const till = tills[route] ?? tills.bar ?? tills.kitchen!;
    return [{ label: label[route], till, amount: isPositive(due) ? formatFigure(due, { decimals: 'whole' }) : null }];
  }
  const [bar, kitchen] = allocate(due, [byRoute.bar, byRoute.kitchen]);
  return [
    { label: label.bar, till: tills.bar, amount: formatFigure(bar!, { decimals: 'whole' }) },
    { label: label.kitchen, till: tills.kitchen, amount: formatFigure(kitchen!, { decimals: 'whole' }) },
  ];
}
