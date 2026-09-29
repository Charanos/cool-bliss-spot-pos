import { formatDate, formatQty, formatTime } from '@bliss/shared/format';
import { formatFigure, isPositive, isZero, subtract, sum } from '@bliss/shared/money';
import { tabLabel } from '@bliss/shared/trade';
import { PRINT_RETRIES, TAGLINE, attemptOf, brandLines, printAccess, retryHref, tillParts } from '@/lib/print';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { SCOPE_LABEL } from '../../../../(console)/console/(shell)/_lib/labels';
import {
  PrintNotice,
  PrintPage,
  Receipt,
  ReceiptBand,
  ReceiptBrand,
  ReceiptFacts,
  ReceiptFooter,
  ReceiptLine,
  ReceiptPay,
  ReceiptRule,
  ReceiptSection,
  ReceiptTenderRow,
  ReceiptThanks,
  ReceiptTotalRow,
} from '@bliss/ui/components/thermal-receipt';

const TENDER_WORD: Record<string, string> = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', account: 'On account', comp: 'On the house' };
const kes = (v: Parameters<typeof formatFigure>[0]) => formatFigure(v, { decimals: 'whole' });

/**
 * A bill, printed for the guest: a receipt once it is paid, with how it was paid; before that, a
 * bill with the M-Pesa tills to pay to. A bill settled a moment ago on a Counter may not have
 * reached the server when the print window opens, so the page waits for it and tries again on its
 * own, and says so, instead of showing a browser's "not found".
 */
export default async function PrintBillPage({ params, searchParams }: { params: Promise<{ billId: string }>; searchParams: Promise<{ t?: string; a?: string }> }) {
  const { t, a } = await searchParams;
  const access = await printAccess(t);
  if (!access.ok) return <PrintNotice title="Cannot print" body={access.body} />;
  const { billId } = await params;
  const bill = settlement.billById(billId);
  const attempt = attemptOf(a);
  if (!bill) {
    return attempt < PRINT_RETRIES ? (
      <PrintNotice title="Getting the bill" body="The bill is on its way from the station to the server." retry={{ href: retryHref(`/print/bill/${billId}`, t, attempt), seconds: 2 }} />
    ) : (
      <PrintNotice title="Bill not here yet" body="This bill has not reached the server. Check the device is online and shows everything sent, then print again. Nothing is lost." />
    );
  }

  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const lines = settlement.billLines(bill.id);
  const tenders = settlement.tendersFor(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const table = tab ? tabLabel({ tableLabel: trade.tableById(tab.serviceTableId)?.label, name: tab.name, walkUpNo: tab.walkUpNo }) : 'Counter sale';
  const zone = tab ? (trade.zoneById(trade.tableById(tab.serviceTableId)?.zoneId ?? '')?.name ?? null) : null;
  const servedBy = tab?.assignedTo ?? tab?.openedBy ?? null;
  const device = identity.devices().find((d) => d.id === bill.deviceId);
  const paid = Boolean(bill.settledBy);
  const itemsTotal = sum(lines.map((l) => l.lineTotalCents));
  const timestamp = bill.settledAt ?? Date.now();

  return (
    <PrintPage>
      <Receipt>
        <ReceiptBrand name={outlet.name} tagline={TAGLINE} logoUrl="/brand/logo-ink.svg" lines={brandLines(outlet)} />
        <ReceiptBand title={paid ? 'Receipt' : 'Bill'} detail={`No. ${bill.billNumber}`} />
        <ReceiptFacts
          items={[
            // Date and time on lines of their own: together they wrap on a 58mm roll.
            { label: 'Date', value: formatDate(timestamp, tz) },
            { label: 'Time', value: formatTime(timestamp, tz) },
            { label: 'Table', value: table },
            zone ? { label: 'Area', value: zone } : null,
            { label: 'Sale', value: SCOPE_LABEL[bill.scope] },
            servedBy ? { label: 'Served by', value: identity.displayName(servedBy) } : null,
            bill.settledBy ? { label: 'Settled by', value: identity.displayName(bill.settledBy) } : null,
            device ? { label: 'Station', value: device.label } : null,
          ]}
        />

        <ReceiptSection title="Items" aside={`${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`} />
        {lines.map((l) => (
          <ReceiptLine key={l.id} name={l.description} qty={formatQty(l.qty)} unit={kes(l.unitPriceCents)} total={kes(l.lineTotalCents)} notes={[l.seatLabel ?? (l.seatNo ? `Seat ${l.seatNo}` : null)]} />
        ))}

        <ReceiptRule />
        {/* A share of a table lists the table's items; say what they came to, then the share. */}
        {itemsTotal !== bill.subtotalCents ? <ReceiptTotalRow label="Items above" value={kes(itemsTotal)} /> : null}
        <ReceiptTotalRow label={itemsTotal !== bill.subtotalCents ? (bill.scope === 'even_split' ? 'Your share, split evenly' : 'Your share') : 'Subtotal'} value={kes(bill.subtotalCents)} />
        {isPositive(bill.discountCents) ? <ReceiptTotalRow label="Discount" value={`-${kes(bill.discountCents)}`} /> : null}
        {!isZero(bill.roundingCents) ? <ReceiptTotalRow label="Rounding" value={kes(bill.roundingCents)} /> : null}
        <ReceiptRule strong />
        <ReceiptTotalRow label={`Total ${outlet.currency}`} value={kes(bill.totalCents)} bold large />
        <ReceiptTotalRow label={`VAT ${outlet.taxRateBps / 100}% included`} value={kes(bill.taxCents)} />
        <ReceiptTotalRow label="Before VAT" value={kes(subtract(bill.totalCents, bill.taxCents))} />

        {paid && tenders.length > 0 ? (
          <>
            <ReceiptSection title="Paid" />
            {tenders.map((tn) => (
              <ReceiptTenderRow
                key={tn.id}
                kind={TENDER_WORD[tn.kind] ?? tn.kind}
                reference={tn.reference}
                amount={kes(tn.amountCents)}
                tendered={tn.tenderedCents ? kes(tn.tenderedCents) : null}
                change={tn.changeCents ? kes(tn.changeCents) : null}
              />
            ))}
          </>
        ) : null}
        {/* The tills print on every bill: a guest paying the next round by M-Pesa has them to hand. */}
        <ReceiptPay parts={tillParts(outlet, lines, bill.totalCents)} currency={outlet.currency} paid={paid} viaMpesa={tenders.length > 0 && tenders.every((tn) => tn.kind === 'mpesa')} total={kes(bill.totalCents)} />

        <ReceiptFooter>
          <ReceiptThanks>Asante, karibu tena</ReceiptThanks>
          <p>{paid ? 'Keep this receipt for your records.' : 'Pay at the counter, or by M-Pesa above.'}</p>
          <p>Prices include VAT. Not a tax invoice.</p>
        </ReceiptFooter>
      </Receipt>
    </PrintPage>
  );
}
