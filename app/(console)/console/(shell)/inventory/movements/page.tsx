import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as reporting from '@/modules/reporting/service';
import { businessDayWindow, addDays } from '@bliss/shared/time';
import * as procurement from '@/modules/procurement/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { hrefFor } from '../../_lib/nav';
import { MovementsTable } from './movements-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Movements' };

const RANGES = { '1': 1, '3': 3, '7': 7, '28': 28 } as const;

/** The ledger itself: append only, filtered on the server by range so thousands of rows never ship. */
export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const outlet = identity.outlet();
  const clock = reporting.clock();
  const days = RANGES[(params.range ?? '3') as keyof typeof RANGES] ?? 3;
  const from = businessDayWindow(addDays(clock.current, -(days - 1)), outlet.timezone, outlet.businessDayCutover).start;
  const variantId = params.variant ?? null;
  const locations = inventory.locations();

  const actor = await identity.currentConsoleActor();
  const canWriteOff = identity.can(actor.staffId, 'stock.writeoff');
  const trades = trade.readTables();
  const tabOfLine = new Map(trades.lines.map((l) => [l.id, l.tabId]));
  const tabNumber = new Map(trades.tabs.map((t) => [t.id, t.tabNumber]));
  const receipts = new Map(procurement.receipts().map((r) => [r.id, r.grnNumber]));
  const counts = new Map(inventory.counts().map((c) => [c.id, c.kind]));
  const all = inventory.movements({ from, variantId });
  const reversed = new Set(all.filter((m) => m.sourceType === 'write_off_reversal').map((m) => m.sourceId));
  const today = clock.current;

  /** Where a movement came from, as a record to open. */
  const source = (m: (typeof all)[number]): { label: string; href: string | null } => {
    if (!m.sourceId) return { label: 'Entered by hand', href: null };
    if (m.sourceType === 'goods_receipt') return { label: `Delivery ${receipts.get(m.sourceId) ?? ''}`.trim(), href: hrefFor('receipt', m.sourceId) };
    if (m.sourceType === 'stock_count') return { label: counts.get(m.sourceId) === 'full' ? 'Full count' : 'Count', href: hrefFor('count', m.sourceId) };
    if (m.sourceType === 'order_line') {
      if (m.sourceId.includes(':')) {
        const billId = m.sourceId.split(':')[0]!;
        return { label: `Quick sale, bill ${settlement.billById(billId)?.billNumber ?? ''}`.trim(), href: hrefFor('bill', billId) };
      }
      const tabId = tabOfLine.get(m.sourceId);
      return tabId ? { label: `Tab ${tabNumber.get(tabId) ?? ''}`.trim(), href: hrefFor('tab', tabId) } : { label: 'A sale', href: null };
    }
    if (m.sourceType === 'write_off') return { label: reversed.has(m.sourceId) ? 'Write-off, taken back' : 'Write-off', href: null };
    if (m.sourceType === 'write_off_reversal') return { label: 'Write-off taken back', href: null };
    return { label: 'Recorded', href: null };
  };

  const rows = all
    .slice(-4000)
    .reverse()
    .map((m) => ({
      id: m.id,
      at: m.occurredAt,
      variantId: m.productVariantId,
      variant: catalogue.variantById(m.productVariantId)?.name ?? '',
      location: locations.find((l) => l.id === m.stockLocationId)?.name ?? '',
      locationId: m.stockLocationId,
      type: m.movementType,
      qty: m.qtyDelta,
      unitCost: m.unitCostCents,
      source: source(m),
      productId: catalogue.productOfVariant(m.productVariantId)?.id ?? null,
      writeOffGroup: m.sourceType === 'write_off' && m.sourceId && !reversed.has(m.sourceId) && m.businessDate === today && canWriteOff ? m.sourceId : null,
      by: identity.displayName(m.createdBy),
      reason: m.reason,
    }));

  return (
    <>
      <ViewHeader page="/console/inventory/movements" />

    <MovementsTable
      rows={rows}
      timezone={outlet.timezone}
      locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      variantName={variantId ? (catalogue.variantById(variantId)?.name ?? null) : null}
    />
    </>
  );
}
