import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="inventory">{children}</Workspace>;
}
