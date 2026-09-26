import { formatDateTime, formatQty } from '@bliss/shared/format';
import { formatDecimal, isPositive, isZero, subtract } from '@bliss/shared/money';
import { notFound } from 'next/navigation';
import { assertPrintAccess } from '@/lib/print-access';
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
  ReceiptTaxBreakdown,
  ReceiptTenderRow,
} from '@bliss/ui/components/thermal-receipt';

/**
 * Renders two thermal receipts sequentially for printing:
 * 1. Customer Copy
 * 2. Counter / Bar Copy (with bold indicators)
 * Includes an auto-print script so it fires immediately upon loading.
 */
export default async function PrintBillPage({ params, searchParams }: { params: Promise<{ billId: string }>; searchParams: Promise<{ t?: string }> }) {
  await assertPrintAccess(searchParams);
  const { billId } = await params;
  const bill = settlement.billById(billId);
  if (!bill) notFound();
  if (!bill.settledBy) notFound();
  
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const venueName = outlet.name;
  const lines = settlement.billLines(bill.id);
  const tenders = settlement.tendersFor(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const table = tab ? (trade.tableById(tab.serviceTableId)?.label ?? tab.name ?? 'Walk up') : 'Walk up';
  const zone = tab ? (trade.zoneById(trade.tableById(tab.serviceTableId)?.zoneId ?? '')?.name ?? '') : '';
  const server = identity.displayName(bill.settledBy);
  const device = identity.devices().find((d) => d.id === bill.deviceId);
  const stationLabel = device?.label ?? bill.deviceId;
  const timestamp = bill.settledAt ?? (bill.businessDate ? Date.parse(bill.businessDate) : Date.now());

  // VAT is included in the prices; the bill shows the base it was worked out from.
  const taxableBase = subtract(bill.totalCents, bill.taxCents);

  const renderContent = () => (
    <Receipt className="mb-16">
      <ReceiptHeader 
        venueName={venueName || 'COOL BLISS SPOT'}
        logoUrl="/logo.png"
        title="BILL"
        subtitle={`Bill #${bill.billNumber}`}
      />
      
      <ReceiptMeta 
        items={[
          { label: 'Date & Time', value: formatDateTime(timestamp, tz) },
          { label: 'Server', value: server },
          { label: 'Station', value: stationLabel },
          { label: 'Channel', value: `${SCOPE_LABEL[bill.scope]}${zone ? ` (${zone})` : ''}` },
          { label: 'Table', value: table },
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

      {/* VAT included in the prices */}
      <ReceiptTaxBreakdown
        taxableAmount={formatDecimal(taxableBase)}
        taxAmount={formatDecimal(bill.taxCents)}
        rateLabel={`VAT (${outlet.taxRateBps / 100}% included)`}
      />

      <ReceiptRule />

      {/* Payment Instruments / Tenders */}
      <div className="w-full mb-2">
        <div className="text-[11px] font-medium uppercase mb-2 text-paper-ink">Payment Instruments</div>
        {tenders.length === 0 ? (
          <div className="text-[11px] italic">No tender rows recorded</div>
        ) : (
          tenders.map((t) => (
            <ReceiptTenderRow
              key={t.id}
              kind={t.kind}
              reference={t.reference}
              amount={formatDecimal(t.amountCents)}
              tendered={t.tenderedCents ? formatDecimal(t.tenderedCents) : null}
              change={t.changeCents ? formatDecimal(t.changeCents) : null}
            />
          ))
        )}
      </div>

      <ReceiptFooter>
        <div className="font-medium">Thank you for visiting {venueName}</div>
        <div>This bill is not a tax invoice.</div>
      </ReceiptFooter>
    </Receipt>
  );

  return (
    <div className="flex flex-col items-center bg-paper-desk min-h-screen py-8 print:bg-paper print:py-0">
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
      <div className="bg-paper shadow-raised print:shadow-none mb-8 print:mb-0">
        {renderContent()}
      </div>
    </div>
  );
}
