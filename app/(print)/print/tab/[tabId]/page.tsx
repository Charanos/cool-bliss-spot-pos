import { formatDateTime, formatQty } from '@bliss/shared/format';
import { formatFigure, sum } from '@bliss/shared/money';
import { tabLabel } from '@bliss/shared/trade';
import { PRINT_RETRIES, TAGLINE, attemptOf, brandLines, printAccess, retryHref, tillParts } from '@/lib/print';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
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
  ReceiptTotalRow,
} from '@bliss/ui/components/thermal-receipt';

const kes = (v: Parameters<typeof formatFigure>[0]) => formatFigure(v, { decimals: 'whole' });

/**
 * The bill a table asks for before it pays: everything on the tab so far, the total, and the M-Pesa
 * tills to pay drinks and food to. Any tab prints, a walk-up with no name included. A tab opened a
 * moment ago on a tablet may not have reached the server yet, so the page waits for it.
 */
export default async function PrintTabPage({ params, searchParams }: { params: Promise<{ tabId: string }>; searchParams: Promise<{ t?: string; a?: string }> }) {
  const { t, a } = await searchParams;
  const access = await printAccess(t);
  if (!access.ok) return <PrintNotice title="Cannot print" body={access.body} />;
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  const attempt = attemptOf(a);
  if (!tab) {
    return attempt < PRINT_RETRIES ? (
      <PrintNotice title="Getting the tab" body="The tab is on its way from the tablet to the server." retry={{ href: retryHref(`/print/tab/${tabId}`, t, attempt), seconds: 2 }} />
    ) : (
      <PrintNotice title="Tab not here yet" body="This tab has not reached the server. Check the tablet is online and shows everything sent, then print again. Nothing is lost." />
    );
  }

  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const table = trade.tableById(tab.serviceTableId);
  const zone = table ? (trade.zoneById(table.zoneId)?.name ?? null) : null;
  const server = tab.assignedTo ?? tab.openedBy;
  const lines = trade.linesFor(tab.id).filter((l) => l.status !== 'voided');
  const seats = new Map(trade.seatsFor(tab.id).map((s) => [s.id, s.seatNo]));
  // Each line's stored total carries its extras; a requested bill is before any discount.
  const total = sum(lines.map((l) => l.lineTotalCents));

  return (
    <PrintPage>
      <Receipt>
        <ReceiptBrand name={outlet.name} tagline={TAGLINE} logoUrl="/brand/logo-ink.svg" lines={brandLines(outlet)} />
        <ReceiptBand title="Your bill" detail={tab.tabNumber ? `Tab ${tab.tabNumber}` : null} />
        <ReceiptFacts
          items={[
            { label: 'Printed', value: formatDateTime(Date.now(), tz) },
            { label: 'Table', value: tabLabel({ tableLabel: table?.label, name: tab.name, walkUpNo: tab.walkUpNo }) },
            zone ? { label: 'Area', value: zone } : null,
            server ? { label: 'Served by', value: identity.displayName(server) } : null,
          ]}
        />

        <ReceiptSection title="Items" aside={`${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`} />
        {lines.length === 0 ? <p className="py-8 text-center">Nothing ordered yet.</p> : null}
        {lines.map((l) => {
          const seat = l.tabSeatId ? seats.get(l.tabSeatId) : null;
          return (
            <ReceiptLine
              key={l.id}
              name={catalogue.variantById(l.productVariantId)?.name ?? 'Item'}
              qty={formatQty(l.qty)}
              unit={kes(l.unitPriceCents)}
              total={kes(l.lineTotalCents)}
              notes={[...trade.modifiersFor(l.id).map((m) => `+ ${m.name}`), seat ? `Seat ${seat}` : null]}
            />
          );
        })}

        <ReceiptRule strong />
        <ReceiptTotalRow label={`To pay ${outlet.currency}`} value={kes(total)} bold large />

        <ReceiptPay parts={tillParts(outlet, lines, total)} currency={outlet.currency} total={kes(total)} />

        <ReceiptFooter>
          <p className="text-[11px] italic">Asante, karibu tena</p>
          <p>Prices include VAT. Not a receipt: yours prints once the bill is paid.</p>
        </ReceiptFooter>
      </Receipt>
    </PrintPage>
  );
}
