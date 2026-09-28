import { formatDateTime, formatQty, formatTime } from '@bliss/shared/format';
import { tabLabel } from '@bliss/shared/trade';
import { PRINT_RETRIES, attemptOf, printAccess, retryHref, routeOf } from '@/lib/print';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import { PrintNotice, PrintPage, Receipt, ReceiptBand, ReceiptFacts, ReceiptFooter, ReceiptSection, TicketLine } from '@bliss/ui/components/thermal-receipt';

const ROUTE = { kitchen: 'Kitchen', bar: 'Bar' } as const;

/**
 * An order ticket for the kitchen or the bar: what to make, for which table, for whom. Big counts,
 * big names, notes in capitals, no prices. `?route=kitchen` or `bar` prints one side only; `?order=`
 * prints one round only. Without them, every line still on the tab, kitchen first, each side on its
 * own ticket so it can be torn off and handed over.
 */
export default async function PrintKotPage({ params, searchParams }: { params: Promise<{ tabId: string }>; searchParams: Promise<{ t?: string; a?: string; route?: string; order?: string }> }) {
  const { t, a, route, order } = await searchParams;
  const access = await printAccess(t);
  if (!access.ok) return <PrintNotice title="Cannot print" body={access.body} />;
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  const attempt = attemptOf(a);
  if (!tab) {
    return attempt < PRINT_RETRIES ? (
      <PrintNotice title="Getting the order" body="The order is on its way from the tablet to the server." retry={{ href: retryHref(`/print/kot/${tabId}`, t, attempt), seconds: 2 }} />
    ) : (
      <PrintNotice title="Order not here yet" body="This order has not reached the server. Check the tablet is online and shows everything sent, then print again." />
    );
  }

  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const table = trade.tableById(tab.serviceTableId);
  const zone = table ? (trade.zoneById(table.zoneId)?.name ?? null) : null;
  const label = tabLabel({ tableLabel: table?.label, name: tab.name, walkUpNo: tab.walkUpNo });
  const orders = trade.ordersFor(tab.id);
  const round = order ? orders.find((o) => o.id === order) : null;
  const seats = new Map(trade.seatsFor(tab.id).map((s) => [s.id, s.seatNo]));
  const lines = trade.linesFor(tab.id).filter((l) => l.status !== 'voided' && (!round || l.orderId === round.id));
  const sides = (['kitchen', 'bar'] as const).filter((r) => (!route || route === r) && lines.some((l) => routeOf(l.productVariantId) === r));
  const firedAt = round?.firedAt ?? orders.at(-1)?.firedAt ?? tab.openedAt;
  const firedBy = round?.firedBy ?? orders.at(-1)?.firedBy ?? tab.assignedTo ?? tab.openedBy;

  if (sides.length === 0) return <PrintNotice title="Nothing to make" body={`There is nothing ${route ? `for the ${ROUTE[route as 'kitchen' | 'bar'] ?? route} ` : ''}on ${label} to print.`} />;

  return (
    <PrintPage>
      {sides.map((side) => {
        const mine = lines.filter((l) => routeOf(l.productVariantId) === side);
        const count = mine.reduce((n, l) => n + l.qty, 0);
        return (
          <Receipt key={side}>
            <ReceiptBand title={`${ROUTE[side]} order`} detail={formatTime(firedAt, tz)} />
            <p className="py-4 text-center text-[22px] font-medium leading-[1.15] tracking-[0.02em]">{label}</p>
            <ReceiptFacts
              items={[
                zone ? { label: 'Area', value: zone } : null,
                tab.tabNumber ? { label: 'Tab', value: String(tab.tabNumber) } : null,
                round?.orderNumber ? { label: 'Round', value: String(round.orderNumber) } : null,
                firedBy ? { label: 'Sent by', value: identity.displayName(firedBy) } : null,
              ]}
            />
            <ReceiptSection title="Make" aside={`${formatQty(count)} ${count === 1 ? 'item' : 'items'}`} />
            {mine.map((l) => {
              const seat = l.tabSeatId ? seats.get(l.tabSeatId) : null;
              return (
                <TicketLine
                  key={l.id}
                  qty={formatQty(l.qty)}
                  name={catalogue.variantById(l.productVariantId)?.name ?? 'Item'}
                  where={seat ? `Seat ${seat}` : null}
                  notes={[...trade.modifiersFor(l.id).map((m) => `+ ${m.name}`), l.note ? `Note: ${l.note}` : null]}
                />
              );
            })}
            <ReceiptFooter>
              <p className="text-[9px] uppercase tracking-[0.22em]">{side === 'kitchen' ? 'No ticket, no plate' : 'No ticket, no pour'}</p>
              <p>Printed {formatDateTime(Date.now(), tz)}</p>
            </ReceiptFooter>
          </Receipt>
        );
      })}
    </PrintPage>
  );
}
