import { formatDate, formatDateTime, plural } from '@bliss/shared/format';
import { multiplyByQty, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Callout, DetailHeader, KeyValueList, MetaRow } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBuildingWarehouse, IconClock, IconFileInvoice, IconTruckDelivery, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ReceiptActions } from './receipt-actions';
import { type ReceiptDetailLine, ReceiptLines, ReceiptPhotos } from './receipt-detail';

export async function generateMetadata({ params }: { params: Promise<{ receiptId: string }> }): Promise<Metadata> {
  const receipt = procurement.receiptById((await params).receiptId);
  return { title: receipt ? `Delivery ${receipt.grnNumber}` : 'Delivery' };
}

/**
 * One delivery as received: what came against what was expected, what went back and why, the
 * batches FEFO draws on, and the photos of the paperwork. A short delivery waits for someone to
 * accept the difference; a delivery can be reversed while its stock is untouched.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const receipt = procurement.receiptById(receiptId);
  if (!receipt) notFound();
  const actor = await identity.currentConsoleActor();

  const tz = identity.outlet().timezone;
  const supplier = procurement.supplierById(receipt.supplierId);
  const location = inventory.locations().find((l) => l.id === receipt.stockLocationId);
  const order = receipt.purchaseOrderId ? procurement.purchaseOrders().find((p) => p.id === receipt.purchaseOrderId) : null;
  const note = procurement.noteForReceipt(receipt.id);
  const moves = inventory.movements({ type: 'receipt' }).filter((m) => m.sourceType === 'goods_receipt' && m.sourceId === receipt.id);
  const batches = inventory.batches();

  const lines: ReceiptDetailLine[] = procurement.receiptLines(receipt.id).map((l) => {
    const variant = catalogue.variantById(l.productVariantId);
    const product = variant ? catalogue.productById(variant.productId) : null;
    const productName = product?.name.trim() ?? '';
    const variantName = variant?.name.trim() ?? 'Item no longer stocked';
    const move = moves.find((m) => m.productVariantId === l.productVariantId && m.qtyDelta === l.qtyReceived);
    const batch = move?.stockBatchId ? batches.find((b) => b.id === move.stockBatchId) : null;
    return {
      id: l.id,
      name: productName && !variantName.toLowerCase().startsWith(productName.toLowerCase()) ? `${productName} ${variantName}` : variantName,
      qtyExpected: l.qtyExpected,
      qtyReceived: l.qtyReceived,
      qtyRejected: l.qtyRejected,
      rejectionReason: l.rejectionReason,
      batchNumber: batch?.batchNumber ?? null,
      expiry: batch?.expiryDate ? formatDate(batch.expiryDate, tz) : null,
      unitCostCents: l.unitCostCents,
      lineTotalCents: multiplyByQty(l.unitCostCents, l.qtyReceived),
    };
  });

  const reversed = receipt.status === 'cancelled';
  const waiting = !reversed && note?.status === 'pending_variance_approval';
  const accepted = lines.reduce((n, l) => n + l.qtyReceived, 0);
  const rejected = lines.reduce((n, l) => n + l.qtyRejected, 0);
  const title = `Delivery ${receipt.grnNumber}`;

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/purchasing/receipts', label: 'Deliveries' }}
        title={title}
        status={reversed ? <StatusChip status="voided" label="Reversed" /> : waiting ? <StatusChip status="review" label="Short, to approve" /> : <StatusChip status="received" />}
        meta={
          <MetaRow
            items={[
              { icon: IconTruckDelivery, value: supplier?.name ?? 'Supplier removed' },
              { icon: IconClock, value: formatDateTime(receipt.receivedAt, tz) },
              { icon: IconUser, value: identity.displayName(receipt.receivedBy) },
              { icon: IconBuildingWarehouse, value: `Into ${location?.name ?? 'the store'}` },
            ]}
          />
        }
        actions={
          <>
            {order ? (
              <ButtonLink href={`/console/purchasing/orders/${order.id}`} variant="secondary" icon={IconFileInvoice}>
                Order {order.poNumber}
              </ButtonLink>
            ) : null}
            <ReceiptActions
              receiptId={receipt.id}
              title={title}
              canApprove={waiting && identity.can(actor.staffId, 'stock.count.commit')}
              canReverse={!reversed && identity.can(actor.staffId, 'stock.writeoff')}
            />
          </>
        }
      />

      {reversed ? (
        <Callout tone="stop" title={`Reversed by ${identity.displayName(receipt.cancelledBy ?? null)}${receipt.cancelledAt ? `, ${formatDateTime(receipt.cancelledAt, tz)}` : ''}`}>
          {receipt.cancelReason ?? 'No reason was recorded.'} The stock it brought in has been taken back out.
        </Callout>
      ) : waiting ? (
        <Callout tone="low" title="Part of this delivery is short">
          {receipt.varianceNote ?? 'No variance note.'} Accept the difference once someone has checked it with the supplier.
        </Callout>
      ) : receipt.varianceNote ? (
        <Callout tone="info" title="Variance note">
          {receipt.varianceNote}
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <ReceiptLines lines={lines} />
        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="receipt-facts">
            <CardHeader band level="h2" titleId="receipt-facts" title="Paperwork" />
            <CardBody className="pt-4">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Delivery note', value: receipt.deliveryNoteRef, mono: true },
                  { label: 'Invoice', value: note?.invoiceNumber ?? 'None given', mono: Boolean(note?.invoiceNumber) },
                  { label: 'Order', value: order ? `Order ${order.poNumber}` : 'Received by hand' },
                  { label: 'Accepted', value: plural(accepted, 'unit') },
                  ...(rejected > 0 ? [{ label: 'Sent back', value: plural(rejected, 'unit') }] : []),
                  { label: 'Value at cost', value: <Money value={sum(lines.map((l) => l.lineTotalCents))} size="num-md" /> },
                ]}
              />
            </CardBody>
          </Card>
          <ReceiptPhotos urls={note?.mediaUrls ?? []} />
        </div>
      </div>
    </div>
  );
}
