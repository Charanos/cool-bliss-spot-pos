import { formatDateTime, formatQty } from '@bliss/shared/format';
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
  ReceiptFooter,
} from '@bliss/ui/components/thermal-receipt';

/**
 * Kitchen & Bar Order Ticket (KOT)
 * 
 * Strict Anti-Ghost Service Invariant:
 * Cannot print a KOT without a verified logged-in server and an active table/tab ID.
 * Design rule: No ticket, no pour.
 */
export default async function PrintKotPage({ params, searchParams }: { params: Promise<{ tabId: string }>; searchParams: Promise<{ t?: string }> }) {
  await assertPrintAccess(searchParams);
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  if (!tab) notFound();

  // No ghost service: you cannot print a KOT without a logged-in user and a table/tab ID
  const serverId = tab.assignedTo ?? tab.openedBy;
  if (!serverId) notFound();
  if (!tab.serviceTableId && !tab.name && !tab.tabNumber) notFound();

  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const venueName = outlet.name;
  const table = trade.tableById(tab.serviceTableId);
  const zone = table ? trade.zoneById(table.zoneId)?.name : '';
  const server = identity.displayName(serverId);
  const lines = trade.linesFor(tab.id).filter((l) => l.status !== 'voided');
  const seats = trade.seatsFor(tab.id);
  const seatMap = new Map(seats.map((s) => [s.id, s.seatNo]));

  // Fired orders timestamp
  const orders = trade.ordersFor(tab.id);
  const latestOrder = orders[orders.length - 1];
  const timestamp = latestOrder?.firedAt ?? tab.openedAt;

  const tableLabel = table ? `Table ${table.label}` : tab.name ? `Walk-up: ${tab.name}` : `Tab #${tab.tabNumber}`;

  return (
    <div className="flex flex-col items-center bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
      <div className="bg-white shadow-lg print:shadow-none mb-8 print:mb-0">
        <Receipt className="mb-16">
          <ReceiptHeader
            venueName={venueName || 'COOL BLISS SPOT'}
            title="KITCHEN & BAR ORDER TICKET (KOT)"
            subtitle={tableLabel}
          />

          <ReceiptMeta
            items={[
              { label: 'Date & Time', value: formatDateTime(timestamp, tz) },
              { label: 'Server / Fired By', value: server },
              { label: 'Table / Tab', value: tableLabel },
              { label: 'Zone', value: zone || 'Main Bar' },
              { label: 'Tab #', value: tab.tabNumber ? String(tab.tabNumber) : tab.id.slice(0, 8) },
            ]}
          />

          <ReceiptRule />

          {/* Ticket Items */}
          <div className="flex justify-between w-full font-bold border-b border-black pb-2 mb-2">
            <span className="w-[15%]">QTY</span>
            <span className="w-[60%]">ITEM / MODIFIERS</span>
            <span className="w-[25%] text-right">SEAT / NOTE</span>
          </div>

          {lines.length === 0 ? (
            <div className="py-4 text-center italic text-black/70">No pending or fired lines on ticket</div>
          ) : (
            lines.map((l) => {
              const variant = catalogue.variantById(l.productVariantId);
              const name = variant ? variant.name : l.productVariantId;
              const modifiers = trade.modifiersFor(l.id);
              const seatNo = l.tabSeatId ? seatMap.get(l.tabSeatId) : null;

              return (
                <div key={l.id} className="flex flex-col w-full py-1.5 border-b border-dashed border-black/30">
                  <div className="flex justify-between w-full items-start">
                    <span className="w-[15%] text-[14px] font-bold">{formatQty(l.qty)}</span>
                    <span className="w-[60%] text-[13px] font-bold pr-2 break-words leading-tight">{name}</span>
                    <span className="w-[25%] text-right text-[11px] font-semibold">
                      {seatNo ? `Seat ${seatNo}` : 'Shared'}
                    </span>
                  </div>
                  {modifiers.length > 0 ? (
                    <div className="pl-[15%] text-[11px] text-black/80 font-mono">
                      {modifiers.map((m) => `+ ${m.name}`).join(', ')}
                    </div>
                  ) : null}
                  {l.note ? (
                    <div className="pl-[15%] text-[11px] font-semibold uppercase text-black/90">
                      &gt;&gt; NOTE: {l.note}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <ReceiptRule />

          <ReceiptFooter>
            <div className="font-bold text-[12px] uppercase tracking-wider">NO TICKET, NO POUR</div>
            <div className="text-[10px] text-black/70">
              Ghost Service Guard: Server [{server}] · Tab [{tab.tabNumber ?? tab.id.slice(0, 8)}]
            </div>
            <div className="text-[10px] text-black/60">
              Printed: {formatDateTime(Date.now(), tz)}
            </div>
          </ReceiptFooter>
        </Receipt>
      </div>
    </div>
  );
}
