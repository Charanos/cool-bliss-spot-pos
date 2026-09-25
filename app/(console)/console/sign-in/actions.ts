'use server';

import { cookies } from 'next/headers';
import { DEV_PINS } from '@bliss/db/seed/organisation';
import * as identity from '@/modules/identity/service';
import { canSignInOn, wrongSurfaceMessage } from '@bliss/shared/identity';
import { redirect } from 'next/navigation';

export async function signInToConsole(staffId: string, pin: string): Promise<{ ok: false; message: string } | undefined> {
  const staff = identity.staffById(staffId);
  const role = identity.roleFor(staffId);
  
  if (!staff) return { ok: false, message: 'Staff member not found.' };
  
  if (DEV_PINS[staffId as keyof typeof DEV_PINS] !== pin) {
    return { ok: false, message: 'That PIN was not recognised.' };
  }
  
  if (staff.employmentStatus !== 'active') {
    return { ok: false, message: 'This PIN no longer works. A manager can check your access in the Console.' };
  }
  
  if (!canSignInOn('console', role?.key)) {
    return { ok: false, message: wrongSurfaceMessage('console', role?.key) };
  }
  
  const cookieStore = await cookies();
  cookieStore.set('bliss-console-session', staff.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  
  redirect('/console/overview');
}

export async function signOutFromConsole() {
  const cookieStore = await cookies();
  cookieStore.delete('bliss-console-session');
  redirect('/console/sign-in');
}
