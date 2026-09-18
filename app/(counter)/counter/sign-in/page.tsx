'use client';

import { PosRoot } from '@/app/_pos/pos-root';
import { StaffSignIn } from '@/app/_pos/staff-sign-in';

/** Counter sign-in: waiters on counter duty, cashiers, supervisors and managers. docs/14 section 1. */
export default function CounterSignInPage() {
  return (
    <PosRoot>
      <StaffSignIn surface="counter" home="/counter/orders" />
    </PosRoot>
  );
}
