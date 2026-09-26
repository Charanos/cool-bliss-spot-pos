import 'server-only';

import type { TenderKind } from '@bliss/shared/domain';
import { type Cents, ZERO, add, compare, scale, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import { type HistoryBill, type HistoryDay, type HistoryLine, type HistoryResult, type HistorySale, type HistorySummary, type HistoryTab, type HistoryTabState, HISTORY_MAX_DAYS, isSeated, tabLabel } from '@bliss/shared/trade';
import { dataset } from '../_data/source';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as settlement from '../settlement/service';
import * as tradeService from '../trade/service';

/**
 * The night's record, and every night before it. docs/16 section 9.
 *
 * A read model over trade and settlement, shaped for the Floor's and the Counter's history screens:
 * each tab as it lived, from open to cleared, with every line fired, poured, delivered or voided,
 * and every bill and how it was paid; each quick sale; and a summary of the range.
 *
 * Two limits keep it a staff tool rather than a report writer: a range is at most 93 days, and at
 * most 600 tabs come back, newest first. Reports across months belong in the Console.
 *
 * The blind count holds here too. When the device asking has a drawer open and the range includes
 * tonight, the takings and the split by tender are left out of the summary: a cash total for tonight
 * next to the till would let anyone work out what the drawer should hold. docs/14 section 7.
 */

export const MAX_DAYS = HISTORY_MAX_DAYS;
export const MAX_TABS = 600;

export type { HistoryBill, HistoryDay, HistoryLine, HistoryResult, HistorySale, HistorySummary, HistoryTab, HistoryTabState };


export interface HistoryQuery {
  from: IsoDate;
  to: IsoDate;
  /** Only tabs this person opened or looks after. */
  staffId?: string | null;
  /** Only bills settled on this device; tabs with a bill here. */
  onlyDevice?: string | null;
  /** The device asking, for the blind count. */
  askingDevice?: string | null;
  /** Table, waiter, tab number or item name. */
  q?: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function clampRange(from: string, to: string): { from: IsoDate; to: IsoDate } {
  const current = dataset().currentBusinessDate;
  let a = ISO.test(from) ? (from as IsoDate) : current;
  let b = ISO.test(to) ? (to as IsoDate) : current;
  if (a > b) [a, b] = [b, a];
  if (b > current) b = current;
  if (a > b) a = b;
  if (daysBetween(a, b) > MAX_DAYS) {
    const start = new Date(Date.parse(`${b}T00:00:00Z`) - (MAX_DAYS - 1) * 86_400_000);
    a = start.toISOString().slice(0, 10) as IsoDate;
  }
  return { from: a, to: b };
}

export function history(query: HistoryQuery): HistoryResult {
  const { from, to } = clampRange(query.from, query.to);
  const trade = tradeService.readTables();
  const money = settlement.readTables();
  const current = dataset().currentBusinessDate;
  // The blind count: a device with its drawer open is not told what tonight's bills took in each
  // tender, bill by bill any more than in total. docs/14 section 7.
  const drawerOpen = query.askingDevice ? Boolean(settlement.openDrawerFor(query.askingDevice)) : false;
  const withheld = drawerOpen && to >= current;

  const zoneName = new Map(trade.zones.map((z) => [z.id, z.name]));
  const tableLabel = new Map(trade.tables.map((t) => [t.id, t.label]));
  const deviceLabel = new Map(identity.devices().map((d) => [d.id, d.label]));
  const seatNo = new Map(trade.seats.map((s) => [s.id, s.seatNo]));
  const orderById = new Map(trade.orders.map((o) => [o.id, o]));
  const modifiersByLine = new Map<string, string[]>();
  for (const m of trade.lineModifiers) modifiersByLine.set(m.orderLineId, [...(modifiersByLine.get(m.orderLineId) ?? []), m.name]);
  const tendersByBill = new Map<string, { kind: TenderKind; amountCents: Cents }[]>();
  for (const t of money.tenders) tendersByBill.set(t.billId, [...(tendersByBill.get(t.billId) ?? []), { kind: t.kind, amountCents: t.amountCents }]);

  const bills = money.bills.filter((b) => b.businessDate >= from && b.businessDate <= to && b.status !== 'open');
  const billsByTab = new Map<string, typeof bills>();
  for (const b of bills) if (b.tabId) billsByTab.set(b.tabId, [...(billsByTab.get(b.tabId) ?? []), b]);

  const toBill = (b: (typeof bills)[number]): HistoryBill => ({
    id: b.id,
    billNumber: b.billNumber,
    scope: b.scope,
    seatNo: b.tabSeatId ? (seatNo.get(b.tabSeatId) ?? null) : null,
    totalCents: b.totalCents,
    settledAt: b.settledAt,
    settledBy: identity.displayName(b.settledBy),
    device: b.deviceId ? (deviceLabel.get(b.deviceId) ?? 'A device') : 'A device',
    tenders: (tendersByBill.get(b.id) ?? []).map((t) => (withheld && b.businessDate === current ? { kind: t.kind, amountCents: null } : t)),
  });

  const linesByTab = new Map<string, (typeof trade.lines)[number][]>();
  for (const l of trade.lines) if (l.status !== 'draft') linesByTab.set(l.tabId, [...(linesByTab.get(l.tabId) ?? []), l]);

  const q = query.q?.trim().toLowerCase() || null;
  let tabs: HistoryTab[] = trade.tabs
    .filter((t) => t.businessDate >= from && t.businessDate <= to)
    .filter((t) => !query.staffId || t.assignedTo === query.staffId || t.openedBy === query.staffId)
    .filter((t) => !query.onlyDevice || (billsByTab.get(t.id) ?? []).some((b) => b.deviceId === query.onlyDevice))
    .map((t) => {
      const own = (linesByTab.get(t.id) ?? []).sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
      const lines: HistoryLine[] = own.map((l) => {
        const order = orderById.get(l.orderId);
        const detail = [...(modifiersByLine.get(l.id) ?? []), l.note].filter(Boolean).join(' · ');
        return {
          id: l.id,
          name: catalogue.variantById(l.productVariantId)?.name ?? 'Item',
          detail: detail || null,
          qty: l.qty,
          seatNo: l.tabSeatId ? (seatNo.get(l.tabSeatId) ?? null) : null,
          orderNumber: order?.orderNumber ?? null,
          status: l.status === 'voided' ? 'voided' : l.status === 'served' ? 'served' : 'pending',
          firedAt: order?.firedAt ?? null,
          servedAt: l.servedAt,
          servedBy: l.servedBy ? identity.displayName(l.servedBy) : null,
          deliveredAt: order?.deliveredAt ?? null,
          voidReason: l.voidReason,
          lineTotalCents: l.lineTotalCents,
        };
      });
      const tabBills = (billsByTab.get(t.id) ?? []).sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0)).map(toBill);
      const state: HistoryTabState =
        t.status === 'voided' ? 'voided' : t.status === 'merged_into' ? 'merged' : t.status === 'settled' ? (isSeated(t) ? 'seated' : 'cleared') : 'ordering';
      return {
        id: t.id,
        businessDate: t.businessDate,
        label: tabLabel({ tableLabel: t.serviceTableId ? tableLabel.get(t.serviceTableId) : null, name: t.name }),
        tabNumber: t.tabNumber,
        zone: zoneName.get(t.zoneId) ?? '',
        waiterId: t.assignedTo,
        waiter: identity.displayName(t.assignedTo),
        guests: t.guestCount,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
        clearedAt: t.clearedAt ?? (t.status === 'settled' ? t.closedAt : null),
        state,
        lines,
        bills: tabBills,
        totalCents: sum(own.filter((l) => l.status !== 'voided').map((l) => l.lineTotalCents)),
        paidCents: sum(tabBills.map((b) => b.totalCents)),
      };
    })
    .filter((t) => !q || t.label.toLowerCase().includes(q) || t.waiter.toLowerCase().includes(q) || String(t.tabNumber ?? '') === q || t.lines.some((l) => l.name.toLowerCase().includes(q)))
    .sort((a, b) => b.openedAt - a.openedAt);

  const truncated = tabs.length > MAX_TABS;
  if (truncated) tabs = tabs.slice(0, MAX_TABS);

  const billLinesByBill = new Map<string, (typeof money.billLines)[number][]>();
  for (const l of money.billLines) billLinesByBill.set(l.billId, [...(billLinesByBill.get(l.billId) ?? []), l]);
  const sales: HistorySale[] = query.staffId
    ? []
    : bills
        .filter((b) => b.scope === 'quick_sale' && (!query.onlyDevice || b.deviceId === query.onlyDevice))
        .map((b) => ({ bill: toBill(b), items: (billLinesByBill.get(b.id) ?? []).map((l) => ({ name: l.description, qty: l.qty, lineTotalCents: l.lineTotalCents })) }))
        .filter((s) => !q || s.items.some((i) => i.name.toLowerCase().includes(q)) || 'quick sale'.includes(q))
        .sort((a, b) => (b.bill.settledAt ?? 0) - (a.bill.settledAt ?? 0));

  // Days, newest first, each holding its own tabs and sales.
  const saleDate = new Map(bills.map((b) => [b.id, b.businessDate]));
  const dates = [...new Set([...tabs.map((t) => t.businessDate), ...sales.map((s) => saleDate.get(s.bill.id)!)])].sort().reverse();
  const days: HistoryDay[] = dates.map((d) => ({ businessDate: d, tabs: tabs.filter((t) => t.businessDate === d), sales: sales.filter((s) => saleDate.get(s.bill.id) === d) }));

  // The summary, and what the blind count keeps back.
  const counted = tabs.filter((t) => t.state !== 'voided' && t.state !== 'merged');
  const allBills = [...counted.flatMap((t) => t.bills), ...sales.map((s) => s.bill)];
  const takings = sum(allBills.map((b) => b.totalCents));
  const byKind = new Map<TenderKind, Cents>();
  for (const b of allBills) for (const t of b.tenders) if (t.amountCents !== null) byKind.set(t.kind, add(byKind.get(t.kind) ?? ZERO, t.amountCents));
  const paidTabs = counted.filter((t) => t.bills.length > 0);

  return {
    from,
    to,
    currentBusinessDate: current,
    generatedAt: Date.now(),
    days,
    truncated,
    summary: {
      tabs: counted.length,
      guests: counted.reduce((n, t) => n + t.guests, 0),
      linesFired: counted.reduce((n, t) => n + t.lines.filter((l) => l.status !== 'voided').length, 0),
      itemsPoured: counted.reduce((n, t) => n + t.lines.filter((l) => l.status === 'served').reduce((q2, l) => q2 + l.qty, 0), 0),
      voided: tabs.reduce((n, t) => n + t.lines.filter((l) => l.status === 'voided').length, 0),
      quickSales: sales.length,
      takingsCents: withheld ? null : takings,
      averageTabCents: withheld || paidTabs.length === 0 ? null : scale(sum(paidTabs.map((t) => t.paidCents)), 1n, BigInt(paidTabs.length)),
      byTender: withheld ? null : [...byKind].map(([kind, amountCents]) => ({ kind, amountCents })).sort((a, b) => compare(b.amountCents, a.amountCents)),
      withheld,
    },
  };
}
