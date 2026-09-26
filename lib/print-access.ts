import 'server-only';

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';

/**
 * Bills and tickets print for staff only. A Console browser proves it with its session cookie; a
 * tablet opens the print page in a new window, which carries no headers, so it passes its station
 * token in the address instead. Anyone else sees a page that does not exist.
 */
export async function assertPrintAccess(searchParams: Promise<{ t?: string }>): Promise<void> {
  await fresh();
  const console = identity.checkConsoleSession((await cookies()).get(identity.CONSOLE_COOKIE)?.value);
  if (console.ok) return;
  const { t } = await searchParams;
  if (identity.checkStationToken(t).ok) return;
  notFound();
}
