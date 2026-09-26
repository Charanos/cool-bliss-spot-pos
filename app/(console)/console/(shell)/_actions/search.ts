'use server';

import { formatIsoDate } from '@bliss/shared/format';
import { tabLabel } from '@bliss/shared/trade';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';

export interface SearchHit {
  kind: 'tab' | 'bill' | 'product' | 'person' | 'delivery' | 'order';
  label: string;
  detail: string;
  href: string;
}

const PER_KIND = 5;

/**
 * Find a record by its number or its name, for the command menu. Read only, capped per kind, and
 * nothing a person without purchasing rights may see (costs are never returned at all).
 */
export async function searchConsole(query: string): Promise<SearchHit[]> {
  const actor = await identity.currentConsoleActor();
  const q = query.trim().toLowerCase().slice(0, 60);
  if (q.length < 2 && !/^\d+$/.test(q)) return [];
  const number = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null;
  const hits: SearchHit[] = [];

  const tables = new Map(trade.tables().map((t) => [t.id, t.label]));
  const tabs = trade.readTables().tabs;
  const tabHits = tabs
    .filter((t) => (number !== null && t.tabNumber === number) || tabLabel({ tableLabel: t.serviceTableId ? tables.get(t.serviceTableId) : null, name: t.name }).toLowerCase().includes(q))
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, PER_KIND);
  for (const t of tabHits) {
    hits.push({
      kind: 'tab',
      label: `${tabLabel({ tableLabel: t.serviceTableId ? tables.get(t.serviceTableId) : null, name: t.name })}${t.tabNumber ? `, tab ${t.tabNumber}` : ''}`,
      detail: `${t.status === 'settled' ? 'Settled' : t.status === 'voided' ? 'Voided' : 'Open'} · ${formatIsoDate(t.businessDate)}`,
      href: `/console/trade/tabs/${t.id}`,
    });
  }

  if (number !== null) {
    const bills = settlement
      .readTables()
      .bills.filter((b) => b.billNumber === number)
      .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0))
      .slice(0, PER_KIND);
    for (const b of bills) hits.push({ kind: 'bill', label: `Bill ${b.billNumber}`, detail: formatIsoDate(b.businessDate), href: `/console/trade/bills/${b.id}` });
  }

  if (identity.can(actor.staffId, 'cost.read')) {
    const receipts = procurement
      .receipts()
      .filter((r) => (number !== null && r.grnNumber === number) || r.deliveryNoteRef.toLowerCase().includes(q))
      .slice(0, PER_KIND);
    for (const r of receipts) {
      hits.push({ kind: 'delivery', label: `Delivery ${r.grnNumber}`, detail: `${procurement.supplierById(r.supplierId)?.name ?? 'Supplier'} · note ${r.deliveryNoteRef}`, href: `/console/purchasing/receipts/${r.id}` });
    }
    const orders = procurement
      .purchaseOrders()
      .filter((o) => number !== null && o.poNumber === number)
      .slice(0, PER_KIND);
    for (const o of orders) hits.push({ kind: 'order', label: `Order ${o.poNumber}`, detail: procurement.supplierById(o.supplierId)?.name ?? 'Supplier', href: `/console/purchasing/orders/${o.id}` });
  }

  const products = catalogue
    .products()
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, PER_KIND);
  for (const p of products) hits.push({ kind: 'product', label: p.name, detail: p.status === 'active' ? 'On sale' : 'Archived', href: `/console/catalogue/products/${p.id}` });

  const people = identity
    .staffSummaries()
    .filter((s) => s.displayName.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q))
    .slice(0, PER_KIND);
  for (const s of people) hits.push({ kind: 'person', label: s.fullName, detail: s.roleName, href: `/console/people/staff?q=${encodeURIComponent(s.displayName)}` });

  return hits;
}
