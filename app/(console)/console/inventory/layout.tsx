import type { ReactNode } from 'react';
import * as inventory from '@/modules/inventory/service';
import { Workspace } from '../_components/workspace';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const inProgress = inventory.counts().filter((c) => c.status === 'counting' || c.status === 'review').length;
  return (
    <Workspace
      title="Inventory"
      description="Stock on hand is the sum of the movement ledger. Nothing writes it directly."
      tabs={[
        { href: '/console/inventory/stock', label: 'Stock' },
        { href: '/console/inventory/counts', label: 'Counts', count: inProgress || undefined },
        { href: '/console/inventory/movements', label: 'Movements' },
        { href: '/console/inventory/recipes', label: 'Recipes' },
        { href: '/console/inventory/holds', label: 'Holds', count: inventory.activeHolds().length || undefined },
      ]}
    >
      {children}
    </Workspace>
  );
}
