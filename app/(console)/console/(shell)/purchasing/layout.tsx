import type { ReactNode } from 'react';
import * as procurement from '@/modules/procurement/service';
import { Workspace } from '../_components/workspace';

export default function PurchasingLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      workspace="purchasing"
      counts={{
        '/console/purchasing/reorder': procurement.reorderSuggestions().length,
        '/console/purchasing/orders': procurement.purchaseOrders().filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received').length,
      }}
    >
      {children}
    </Workspace>
  );
}
