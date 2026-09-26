import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { type OrderRow, OrdersTable } from './orders-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Purchase orders' };

/** Every purchase order, from draft to received. */
export default function OrdersPage() {
  const outlet = identity.outlet();
  const rows: OrderRow[] = procurement.purchaseOrders().map((po) => {
    const lines = procurement.purchaseOrderLines(po.id);
    const ordered = lines.reduce((a, l) => a + l.qtyOrdered, 0);
    const received = lines.reduce((a, l) => a + l.qtyReceived, 0);
    return {
      id: po.id,
      number: po.poNumber,
      supplier: procurement.supplierById(po.supplierId)?.name ?? '',
      supplierId: po.supplierId,
      status: po.status,
      raisedAt: po.raisedAt,
      raisedBy: identity.displayName(po.raisedBy),
      expectedAt: po.expectedAt,
      lines: lines.length,
      ordered,
      received,
      total: po.totalCents,
      notes: po.notes,
    };
  });
  return (
    <>
      <ViewHeader page="/console/purchasing/orders" />
      <OrdersTable rows={rows} timezone={outlet.timezone} suppliers={procurement.suppliers().map((s) => ({ value: s.id, label: s.name }))} />
    </>
  );
}
