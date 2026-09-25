import { formatDate, formatDateTime } from '@bliss/shared/format';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import { ORDER_STATUS } from '../../../_lib/labels';
import { OrderDetail } from './order-detail';

export const metadata: Metadata = { title: 'Purchase order' };

export default async function OrderPage({ params }: { params: Promise<{ poId: string }> }) {
  const { poId } = await params;
  const order = procurement.purchaseOrders().find((p) => p.id === poId);
  if (!order) notFound();
  const tz = identity.outlet().timezone;
  const supplier = procurement.supplierById(order.supplierId);
  const store = inventory.locations().find((l) => l.isDefaultReceipt);
  const receipts = procurement.receipts().filter((r) => r.purchaseOrderId === order.id);

  return (
    <>
      <div className="mb-16">
        <ButtonLink href="/console/purchasing/orders" variant="ghost" icon={IconArrowLeft} className="-ml-12">
          Purchase orders
        </ButtonLink>
      </div>
      <div className="border-b border-hairline pb-16">
        <h2 className="flex flex-wrap items-center gap-12 text-title text-ink">
          <span className="font-mono tabular">PO {order.poNumber}</span>
          <span className="text-ink-muted">{supplier?.name}</span>
          <StatusChip {...ORDER_STATUS[order.status]} />
        </h2>
        <p className="mt-4 text-body text-ink-muted">
          Raised by {identity.displayName(order.raisedBy)} on {formatDateTime(order.raisedAt, tz)}
          {order.approvedBy && order.approvedBy !== order.raisedBy ? ` · approved by ${identity.displayName(order.approvedBy)}` : ''}
          {order.expectedAt ? ` · expected ${formatDate(order.expectedAt, tz)}` : ''}
          {supplier ? ` · ${supplier.contactName}, pays in ${supplier.paymentTermsDays} days` : ''}
        </p>
        {order.notes ? <p className="mt-4 text-body text-ink">{order.notes}</p> : null}
      </div>

      <OrderDetail
        order={{ id: order.id, number: order.poNumber, status: order.status, total: order.totalCents }}
        storeName={store?.name ?? 'the store'}
        lines={procurement.purchaseOrderLines(order.id).map((l) => ({
          id: l.id,
          name: catalogue.variantById(l.productVariantId)?.name ?? '',
          ordered: l.qtyOrdered,
          received: l.qtyReceived,
          unitCost: l.unitCostCents,
          total: l.lineTotalCents,
        }))}
        receipts={receipts.map((r) => ({
          id: r.id,
          number: r.grnNumber,
          deliveryNote: r.deliveryNoteRef,
          at: formatDateTime(r.receivedAt, tz),
          by: identity.displayName(r.receivedBy),
          note: r.varianceNote,
          lines: procurement.receiptLines(r.id).map((x) => ({
            id: x.id,
            name: catalogue.variantById(x.productVariantId)?.name ?? '',
            received: x.qtyReceived,
            rejected: x.qtyRejected,
            reason: x.rejectionReason,
          })),
        }))}
      />
    </>
  );
}
