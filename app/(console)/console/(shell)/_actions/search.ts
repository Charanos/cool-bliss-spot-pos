'use server';

import { formatIsoDate } from '@bliss/shared/format';
import { tabLabel } from '@bliss/shared/trade';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';

export interface SearchHit {
  kind: 'tab' | 'bill' | 'product' | 'person' | 'delivery' | 'order' | 'supplier' | 'category' | 'priceList' | 'role' | 'drawer' | 'device';
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
  for (const s of people) hits.push({ kind: 'person', label: s.fullName, detail: s.roleName, href: `/console/people/staff/${s.id}` });

  for (const c of catalogue
    .categories()
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, PER_KIND)) {
    hits.push({ kind: 'category', label: c.name, detail: c.status === 'active' ? 'Category' : 'Category, archived', href: `/console/catalogue/categories/${c.id}` });
  }

  for (const l of pricing
    .priceLists()
    .filter((l) => l.name.toLowerCase().includes(q))
    .slice(0, PER_KIND)) {
    hits.push({ kind: 'priceList', label: l.name, detail: 'Price list', href: `/console/pricing/lists/${l.id}` });
  }

  if (identity.can(actor.staffId, 'cost.read')) {
    for (const x of procurement
      .suppliers()
      .filter((x) => x.name.toLowerCase().includes(q))
      .slice(0, PER_KIND)) {
      hits.push({ kind: 'supplier', label: x.name, detail: x.status === 'active' ? 'Supplier' : 'Supplier, archived', href: `/console/purchasing/suppliers/${x.id}` });
    }
  }

  for (const r of identity
    .roles()
    .filter((r) => r.name.toLowerCase().includes(q))
    .slice(0, PER_KIND)) {
    hits.push({ kind: 'role', label: r.name, detail: 'Role', href: `/console/people/roles/${r.id}` });
  }

  const devices = identity.devices();
  for (const d of devices.filter((d) => d.label.toLowerCase().includes(q)).slice(0, PER_KIND)) {
    hits.push({ kind: 'device', label: d.label, detail: d.status === 'active' ? (d.online ? 'Device, online' : 'Device, offline') : 'Device, withdrawn', href: `/console/settings/devices/${d.id}` });
  }
  // "Counter 1 drawer": the latest sessions on a device whose name matches.
  if (q.includes('drawer') || devices.some((d) => d.kind === 'counter' && d.label.toLowerCase().includes(q))) {
    const named = new Map(devices.map((d) => [d.id, d.label]));
    const term = q.replace('drawer', '').trim();
    for (const s of settlement
      .drawerSessions()
      .filter((s) => !term || (named.get(s.deviceId) ?? '').toLowerCase().includes(term))
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, 3)) {
      hits.push({ kind: 'drawer', label: `${named.get(s.deviceId) ?? 'Drawer'}, ${formatIsoDate(s.businessDate)}`, detail: s.status === 'closed' ? 'Drawer, counted' : 'Drawer, open', href: `/console/trade/drawers/${s.id}` });
    }
  }

  return hits;
}
