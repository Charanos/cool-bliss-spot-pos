import type { ReactNode } from 'react';
import * as procurement from '@/modules/procurement/service';
import { Workspace } from '../_components/workspace';

export default function PurchasingLayout({ children }: { children: ReactNode }) {
  const orders = procurement.purchaseOrders();
  const awaiting = orders.filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received').length;
  return (
    <Workspace
      title="Purchasing"
      description="Suggestions come from 28 days of real sales. Receiving posts stock to the store at the order's cost."
      tabs={[
        { href: '/console/purchasing/reorder', label: 'Reorder', count: procurement.reorderSuggestions().length || undefined },
        { href: '/console/purchasing/orders', label: 'Orders', count: awaiting || undefined },
        { href: '/console/purchasing/receipts', label: 'Receipts' },
        { href: '/console/purchasing/suppliers', label: 'Suppliers' },
      ]}
    >
      {children}
    </Workspace>
  );
}
