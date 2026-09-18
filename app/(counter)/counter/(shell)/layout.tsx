import type { ReactNode } from 'react';
import { PosRoot } from '@/app/_pos/pos-root';
import { CounterShell } from '../_components/shell';

export default function CounterShellLayout({ children }: { children: ReactNode }) {
  return (
    <PosRoot>
      <CounterShell>{children}</CounterShell>
    </PosRoot>
  );
}
