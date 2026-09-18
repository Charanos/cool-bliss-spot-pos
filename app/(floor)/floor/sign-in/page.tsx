'use client';

import { PosRoot } from '@/app/_pos/pos-root';
import { StaffSignIn } from '@/app/_pos/staff-sign-in';

/** Floor sign-in: waiters, and a supervisor covering a section. docs/14 section 1. */
export default function SignInPage() {
  return (
    <PosRoot>
      <StaffSignIn surface="floor" home="/floor/tabs" />
    </PosRoot>
  );
}
