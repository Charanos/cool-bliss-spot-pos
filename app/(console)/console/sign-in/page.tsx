import { canSignInOn } from '@bliss/shared/identity';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import { ConsoleSignInClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

const ENDED: Record<string, string> = {
  invalid: 'Your session ended. Sign in again.',
  inactive: 'Your access was changed. A manager can check it in People.',
  wrong_surface: 'Your role no longer signs in to the Console.',
  pin_changed: 'Your PIN was changed, so your session ended. Sign in with the new one.',
};

/**
 * The Console sign-in. Only a valid session skips it; a stale or ended cookie is cleared by showing
 * this page, never bounced back to the Console (which would loop). The browser receives names and
 * roles of the people who can sign in here, nothing else.
 */
export default async function ConsoleSignInPage({ searchParams }: { searchParams: Promise<{ ended?: string }> }) {
  await fresh();
  const check = identity.checkConsoleSession((await cookies()).get(identity.CONSOLE_COOKIE)?.value);
  if (check.ok) redirect('/console/overview');
  const { ended } = await searchParams;

  const staff = identity.staffSummaries((s) => s.employmentStatus === 'active').filter((s) => canSignInOn('console', s.roleKey));
  const outlet = identity.outlet();
  return <ConsoleSignInClient staff={staff} outlet={{ name: outlet.name, timezone: outlet.timezone }} notice={ended ? (ENDED[ended] ?? null) : null} />;
}
