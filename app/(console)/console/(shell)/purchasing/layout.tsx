import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function PurchasingLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="purchasing">{children}</Workspace>;
}
