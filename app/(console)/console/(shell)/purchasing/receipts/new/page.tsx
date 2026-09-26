import { ButtonLink } from '@bliss/ui/components/button-link';
import { DetailHeader } from '@bliss/ui/components/console/section';
import { StatusChip } from '@bliss/ui/components/status';
import { IconFileInvoice } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { GrnIntakeForm, type IntakeItem, type IntakeOrder } from './grn-intake-form';

export const metadata: Metadata = { title: 'Receive a delivery' };

/** Receive a delivery, against an open order (?poId=) or by hand. */
export default async function ReceiveDeliveryPage({ searchParams }: { searchParams: Promise<{ poId?: string }> }) {
  await identity.currentConsoleActor();
  const { poId } = await searchParams;

  const supplierProducts = procurement.supplierProducts();
  const stocked = catalogue.stockVariants();
  const items: IntakeItem[] = (stocked.length > 0 ? stocked : catalogue.variants())
    .map((v) => {
      const product = catalogue.productById(v.productId);
      const productName = product?.name.trim() ?? '';
      const name = productName && !v.name.trim().toLowerCase().startsWith(productName.toLowerCase()) ? `${productName} ${v.name.trim()}` : v.name.trim();
      return { id: v.id, name, supplierIds: supplierProducts.filter((sp) => sp.productVariantId === v.id).map((sp) => sp.supplierId), unitCostCents: inventory.averageCost(v.id) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const po = poId ? procurement.purchaseOrders().find((p) => p.id === poId) : undefined;
  const receivable = po && (po.status === 'sent' || po.status === 'partially_received');
  const order: IntakeOrder | null =
    po && receivable
      ? {
          id: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          lines: procurement
            .purchaseOrderLines(po.id)
            .filter((l) => l.qtyOrdered > l.qtyReceived)
            .map((l) => ({ purchaseOrderLineId: l.id, variantId: l.productVariantId, qtyExpected: l.qtyOrdered - l.qtyReceived })),
        }
      : null;

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label="Receive a delivery" />
      <DetailHeader
        back={order ? { href: `/console/purchasing/orders/${order.id}`, label: `Order ${order.poNumber}` } : { href: '/console/purchasing/receipts', label: 'Deliveries' }}
        title="Receive a delivery"
        status={order ? <StatusChip status="sent" label={`Against order ${order.poNumber}`} /> : null}
        meta={
          <p className="measure text-ui text-ink-muted">
            {po && !receivable
              ? `Order ${po.poNumber} is not open for delivery, so this is recorded by hand.`
              : 'Count what came against the delivery note. Batches and expiry dates let the bar pour the oldest stock first.'}
          </p>
        }
        actions={
          order ? null : (
            <ButtonLink href="/console/purchasing/orders" variant="secondary" icon={IconFileInvoice}>
              Receive against an order
            </ButtonLink>
          )
        }
      />
      <GrnIntakeForm suppliers={procurement.suppliers().map((s) => ({ value: s.id, label: s.name }))} items={items} order={order} />
    </div>
  );
}
