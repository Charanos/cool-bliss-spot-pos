import { formatDateTime, formatQty } from '@bliss/shared/format';
import { cents, formatDecimal } from '@bliss/shared/money';
import { notFound } from 'next/navigation';
import { assertPrintAccess } from '@/lib/print-access';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import * as catalogue from '@/modules/catalogue/service';
import {
  Receipt,
  ReceiptHeader,
  ReceiptRule,
  ReceiptMeta,
  ReceiptItemsHeader,
  ReceiptItemRow,
  ReceiptTotalRow,
  ReceiptFooter,
} from '@bliss/ui/components/thermal-receipt';

/**
 * Renders two thermal receipts sequentially for a requested Tab:
 * 1. Customer Copy (Proforma)
 * 2. Counter / Bar Copy
 */
export default async function PrintTabPage({ params, searchParams }: { params: Promise<{ tabId: string }>; searchParams: Promise<{ t?: string }> }) {
  await assertPrintAccess(searchParams);
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  if (!tab) notFound();
  const serverId = tab.assignedTo ?? tab.openedBy;
  if (!serverId) notFound();
  if (!tab.serviceTableId && !tab.name && !tab.tabNumber) notFound();
  
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const venueName = outlet.name;
  const table = trade.tableById(tab.serviceTableId);
  const zone = table ? trade.zoneById(table.zoneId)?.name : '';
  const server = identity.displayName(tab.assignedTo);
  const lines = trade.linesFor(tab.id).filter(l => l.status !== 'voided');
  
  const subtotal = lines.reduce((acc, l) => acc + (l.unitPriceCents * BigInt(l.qty)), 0n);
  const total = subtotal; // Assuming no custom modifiers or discounts are applied before billing.

  const renderContent = () => (
    <Receipt className="mb-16">
      <ReceiptHeader 
        venueName={venueName || 'BLISS POS'}
        logoUrl="/logo.png"
        title="REQUESTED BILL"
        subtitle={tab.tabNumber ? `Tab #${tab.tabNumber}` : `Tab`}
      />
      
      <ReceiptMeta 
        items={[
          { label: 'Date', value: formatDateTime(Date.now(), tz) },
          { label: 'Server', value: server },
          { label: 'Zone', value: zone || 'Main' },
          { label: 'Table', value: table?.label || tab.name || 'Walk Up' },
        ]} 
      />
      
      <ReceiptRule />
      <ReceiptItemsHeader />
      
      {lines.map((l) => {
        const variant = catalogue.variantById(l.productVariantId);
        const name = variant ? variant.name : l.productVariantId;
        const lineTotal = l.unitPriceCents * BigInt(l.qty);
        return (
          <ReceiptItemRow 
            key={l.id}
            qty={formatQty(l.qty)}
            description={name}
            total={formatDecimal(cents(lineTotal))}
          />
        );
      })}
      
      <ReceiptRule />
      
      <ReceiptTotalRow label="Subtotal" value={formatDecimal(cents(subtotal))} />
      
      <ReceiptTotalRow 
        label="TOTAL DUE" 
        value={formatDecimal(cents(total))} 
        bold 
        large 
      />
      
      <ReceiptRule />
      
      <ReceiptFooter>
        <div className="font-semibold">PROFORMA BILL · NOT A FISCAL RECEIPT</div>
      </ReceiptFooter>
    </Receipt>
  );

  return (
    <div className="flex flex-col items-center bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
      <div className="bg-white shadow-lg print:shadow-none mb-8 print:mb-0">
        {renderContent()}
      </div>
    </div>
  );
}
