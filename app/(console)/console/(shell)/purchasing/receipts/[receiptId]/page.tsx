import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { StatusChip } from '@bliss/ui/components/status';
import { formatDateTime, formatDate } from '@bliss/shared/format';
import { multiplyByQty, sum } from '@bliss/shared/money';
import { IconArrowLeft } from '@tabler/icons-react';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as catalogue from '@/modules/catalogue/service';
import { ReceiptDetailView, type ReceiptDetailLine } from './receipt-detail';

export const metadata: Metadata = { title: 'Goods Received Note' };

export default async function ReceiptDetailPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const receipt = procurement.receiptById(receiptId);
  if (!receipt) notFound();

  const tz = identity.outlet().timezone;
  const supplier = procurement.supplierById(receipt.supplierId);
  const location = inventory.locations().find((l) => l.id === receipt.stockLocationId);
  const order = receipt.purchaseOrderId ? procurement.purchaseOrders().find((p) => p.id === receipt.purchaseOrderId) : null;
  const note = procurement.noteForReceipt(receipt.id);
  const lines = procurement.receiptLines(receipt.id);
  const allBatches = inventory.batches();

  const formattedLines: ReceiptDetailLine[] = lines.map((l) => {
    const variant = catalogue.variantById(l.productVariantId);
    const product = variant ? catalogue.productById(variant.productId) : null;
    const pName = product ? product.name.trim() : '';
    const vName = variant ? variant.name.trim() : 'Unknown Product';
    const name = pName && !vName.toLowerCase().startsWith(pName.toLowerCase())
      ? `${pName} ${vName}`
      : vName;

    // Find associated stock batch for lot & expiry
    const batch = allBatches.find(
      (b) => b.productVariantId === l.productVariantId && Math.abs(b.receivedAt - receipt.receivedAt) < 30000
    );

    return {
      id: l.id,
      variantId: l.productVariantId,
      name,
      qtyExpected: l.qtyExpected,
      qtyReceived: l.qtyReceived,
      qtyRejected: l.qtyRejected,
      rejectionReason: l.rejectionReason,
      batchNumber: batch?.batchNumber ?? null,
      expiryDate: batch?.expiryDate ? formatDate(batch.expiryDate, tz) : null,
      unitCostCents: l.unitCostCents,
      lineTotalCents: multiplyByQty(l.unitCostCents, l.qtyReceived),
    };
  });

  const totalValue = sum(formattedLines.map((l) => l.lineTotalCents));

  return (
    <>
      <div className="mb-16">
        <ButtonLink href="/console/purchasing/receipts" variant="ghost" icon={IconArrowLeft} className="-ml-12">
          Receipts
        </ButtonLink>
      </div>

      <div className="border-b border-hairline pb-20 mb-24">
        <div className="flex flex-wrap items-center justify-between gap-16">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-12">
              <h2 className="text-title text-ink font-mono tabular">GRN #{receipt.grnNumber}</h2>
              <span className="text-title text-ink-muted">·</span>
              <span className="text-title text-ink font-medium">{supplier?.name ?? 'Unknown Supplier'}</span>
              <StatusChip status="received" label="Posted" />
            </div>
            <p className="text-body text-ink-subtle">
              Received on <strong className="text-ink font-medium">{formatDateTime(receipt.receivedAt, tz)}</strong> by{' '}
              <strong className="text-ink font-medium">{identity.displayName(receipt.receivedBy)}</strong> into{' '}
              <strong className="text-ink font-medium">{location?.name ?? 'Default Store'}</strong>
            </p>
          </div>

          {order && (
            <ButtonLink href={`/console/purchasing/orders/${order.id}`} variant="secondary">
              View PO #{order.poNumber}
            </ButtonLink>
          )}
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-16 pt-16 border-t border-hairline text-body-sm">
          <div>
            <span className="text-ink-subtle block text-body-xs uppercase tracking-wider">Delivery Note Ref</span>
            <span className="font-mono font-medium text-ink mt-2 block">{receipt.deliveryNoteRef}</span>
          </div>
          <div>
            <span className="text-ink-subtle block text-body-xs uppercase tracking-wider">Invoice Number</span>
            <span className="font-mono text-ink mt-2 block">{note?.invoiceNumber || '—'}</span>
          </div>
          <div>
            <span className="text-ink-subtle block text-body-xs uppercase tracking-wider">eTIMS KRA Ref</span>
            <span className="font-mono text-ink mt-2 block">{note?.etimsInvoiceRef || '—'}</span>
          </div>
          <div>
            <span className="text-ink-subtle block text-body-xs uppercase tracking-wider">PO Reference</span>
            <span className="font-mono text-ink mt-2 block">{order ? `PO #${order.poNumber}` : 'Direct Intake'}</span>
          </div>
        </div>
      </div>

      <ReceiptDetailView
        lines={formattedLines}
        mediaUrls={note?.mediaUrls || []}
        varianceNote={receipt.varianceNote}
        totalValue={totalValue}
      />
    </>
  );
}
