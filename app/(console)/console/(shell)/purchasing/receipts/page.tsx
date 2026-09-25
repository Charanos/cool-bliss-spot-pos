import { multiplyByQty, sum } from '@bliss/shared/money';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconPlus } from '@tabler/icons-react';
import { TabIntro } from '../../_components/workspace';
import { type ReceiptRow, ReceiptsTable } from './receipts-table';

export const metadata: Metadata = { title: 'Receipts' };

/** Goods received notes: what actually came off the van, against which order, and what went back. */
export default function ReceiptsPage() {
  const outlet = identity.outlet();
  const locations = inventory.locations();
  const orders = procurement.purchaseOrders();
  const rows: ReceiptRow[] = procurement.receipts().map((r) => {
    const lines = procurement.receiptLines(r.id);
    return {
      id: r.id,
      number: r.grnNumber,
      poId: r.purchaseOrderId,
      poNumber: orders.find((o) => o.id === r.purchaseOrderId)?.poNumber ?? null,
      supplier: procurement.supplierById(r.supplierId)?.name ?? '',
      supplierId: r.supplierId,
      deliveryNote: r.deliveryNoteRef,
      receivedAt: r.receivedAt,
      receivedBy: identity.displayName(r.receivedBy),
      location: locations.find((l) => l.id === r.stockLocationId)?.name ?? '',
      units: lines.reduce((a, l) => a + l.qtyReceived, 0),
      rejected: lines.reduce((a, l) => a + l.qtyRejected, 0),
      value: sum(lines.map((l) => multiplyByQty(l.unitCostCents, l.qtyReceived))),
      note: r.varianceNote,
    };
  });
  return (
    <>
      <TabIntro action={<ButtonLink href="/console/purchasing/receipts/new" variant="primary" icon={IconPlus}>New Goods Received Note</ButtonLink>}>
        Log intake from suppliers, KRA eTIMS invoices, and track FEFO stock batch expiration.
      </TabIntro>
      <ReceiptsTable rows={rows} timezone={outlet.timezone} suppliers={procurement.suppliers().map((s) => ({ value: s.id, label: s.name }))} />
    </>
  );
}
