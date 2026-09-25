import { formatDateTime, formatIsoDate, formatQty } from '@bliss/shared/format';
import { formatDecimal, isPositive, isZero } from '@bliss/shared/money';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { SCOPE_LABEL } from '../../../../(console)/console/(shell)/_lib/labels';
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
 * Renders two thermal receipts sequentially for printing:
 * 1. Customer Copy
 * 2. Counter / Bar Copy (with bold indicators)
 * Includes an auto-print script so it fires immediately upon loading.
 */
export default async function PrintBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const bill = settlement.billById(billId);
  if (!bill) notFound();
  
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const venueName = outlet.name; // Assume the outlet has a name, otherwise fallback
  const lines = settlement.billLines(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const table = tab ? (trade.tableById(tab.serviceTableId)?.label ?? tab.name ?? 'Walk up') : null;
  const zone = tab ? (trade.zoneById(trade.tableById(tab.serviceTableId)?.zoneId ?? '')?.name ?? '') : '';
  const server = identity.displayName(bill.settledBy);

  const renderContent = () => (
    <Receipt className="mb-16">
      <ReceiptHeader 
        venueName={venueName || 'BLISS POS'}
        logoUrl="/logo.png"
        title="RECEIPT"
        subtitle={`Bill #${bill.billNumber}`}
      />
      
      <ReceiptMeta 
        items={[
          { label: 'Date', value: formatDateTime(bill.businessDate ? Date.parse(bill.businessDate) : Date.now(), tz) },
          { label: 'Server', value: server },
          { label: 'Zone', value: zone || 'Main' },
          { label: 'Table', value: table || 'Walk Up' },
          { label: 'Type', value: SCOPE_LABEL[bill.scope] },
        ]} 
      />
      
      <ReceiptRule />
      <ReceiptItemsHeader />
      
      {lines.map((l) => (
        <ReceiptItemRow 
          key={l.id}
          qty={formatQty(l.qty)}
          description={l.description}
          total={formatDecimal(l.lineTotalCents)}
        />
      ))}
      
      <ReceiptRule />
      
      <ReceiptTotalRow label="Subtotal" value={formatDecimal(bill.subtotalCents)} />
      {isPositive(bill.discountCents) ? (
        <ReceiptTotalRow label="Discount" value={`-${formatDecimal(bill.discountCents)}`} />
      ) : null}
      
      <ReceiptTotalRow 
        label="TOTAL" 
        value={formatDecimal(bill.totalCents)} 
        bold 
        large 
      />
      
      {!isZero(bill.roundingCents) ? (
        <ReceiptTotalRow label="Rounding" value={formatDecimal(bill.roundingCents)} />
      ) : null}
      
      <ReceiptRule />
      
      <ReceiptFooter>
        <div>Thank you for your visit!</div>
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
