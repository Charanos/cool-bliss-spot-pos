import type { ReactNode } from 'react';
import * as inventory from '@/modules/inventory/service';
import { Workspace } from '../_components/workspace';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      workspace="inventory"
      counts={{ '/console/inventory/counts': inventory.counts().filter((c) => c.status === 'counting' || c.status === 'review').length, '/console/inventory/holds': inventory.activeHolds().length }}
      attention={['/console/inventory/holds']}
    >
      {children}
    </Workspace>
  );
}
