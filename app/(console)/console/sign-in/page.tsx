import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import { ConsoleSignInClient } from './client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ConsoleSignInPage() {
  await fresh();
  const session = (await cookies()).get('bliss-console-session')?.value;
  if (session) {
    redirect('/console/overview');
  }

  const staffList = identity.staffList();
  const staff = staffList.map(s => ({ ...s, roleKey: (identity.roleFor(s.id)?.key ?? 'unknown') as any }));
  const outlet = identity.outlet();
  
  return <ConsoleSignInClient staff={staff} outlet={outlet} />;
}
