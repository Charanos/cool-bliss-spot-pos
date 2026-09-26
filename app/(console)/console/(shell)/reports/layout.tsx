import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace workspace="reports">{children}</Workspace>
  );
}
