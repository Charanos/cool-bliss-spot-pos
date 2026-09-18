import type { ReactNode } from 'react';
import { PosRoot } from '@/app/_pos/pos-root';
import { FloorShell } from '../_components/shell';

export default function FloorShellLayout({ children }: { children: ReactNode }) {
  return (
    <PosRoot>
      <FloorShell>{children}</FloorShell>
    </PosRoot>
  );
}
