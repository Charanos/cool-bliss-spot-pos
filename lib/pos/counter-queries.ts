'use client';

import type { AvailabilityState, Bill, CategoryColourToken, OrderLine, Tab, TabSeat, Tender } from '@bliss/shared/domain';
import { type Cents, sum } from '@bliss/shared/money';
import { tryResolvePrice } from '@bliss/shared/pricing';
import { showsSeatChips } from '@bliss/shared/seats';
import { billableLines, linesTotal } from '@bliss/shared/settlement';
import { tabLabel } from '@bliss/shared/trade';
import { useLiveQuery } from 'dexie-react-hooks';
import { type DrawerRow, META, getMeta, posDb } from './db';
import { usePricingIndex } from './pricing';
import { assetUrl, tileGlyph } from './queries';
import type { TileGlyph } from '@bliss/ui/components/floor/product-tile';
import type { AvailabilityReason } from '@bliss/shared/domain';

/**
 * Counter reads. docs/14 section 5. Everything here reads the device's own store, which the sync
 * cycle keeps current, so the Counter keeps working when the network does not.
 */

const OPEN_TABS = ['open', 'part_settled', 'settling'] as const;

async function staffNames() {
  return new Map((await posDb().staff.toArray()).map((s) => [s.id, s.displayName]));
}

/* --------------------------------------------------------------- tickets */

export type TicketLineState = 'waiting' | 'poured' | 'ran_out';

export interface TicketLine {
  lineId: string;
  qty: number;
  name: string;
  seatNo: number | null;
  seatLabel: string | null;
  note: string | null;
  modifiers: string[];
  state: TicketLineState;
  servedAt: number | null;
}

export interface Ticket {
  orderId: string;
  tabId: string;
  label: string;
  tabNumber: number | null;
  orderNumber: number | null;
  waiter: string;
  firedAt: number;
  showSeats: boolean;
  lines: TicketLine[];
  waiting: number;
  ranOut: number;
  lastPouredAt: number | null;
}

/**
 * Fired orders as tickets, oldest waiting first, then the recently poured. A ticket leaves the waiting
 * list when every live line on it is poured.
 */
export function useTickets(): { waiting: Ticket[]; poured: Ticket[] } | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const tabs = await db.tabs.where('status').anyOf(...OPEN_TABS, 'settled').toArray();
    const tabById = new Map(tabs.map((t) => [t.id, t]));
    const [orders, lines, seats, modifiers, variants, tables, names] = await Promise.all([
      db.orders.where('status').anyOf('fired', 'partially_served', 'served').toArray(),
      db.lines.where('status').anyOf('pending', 'served').toArray(),
      db.seats.toArray(),
      db.lineModifiers.toArray(),
      db.variants.toArray(),
      db.serviceTables.toArray(),
      staffNames(),
    ]);
    const nameOf = new Map(variants.map((v) => [v.id, v.name]));
    const seatById = new Map(seats.map((s) => [s.id, s]));
    const modsByLine = new Map<string, string[]>();
    for (const m of modifiers) modsByLine.set(m.orderLineId, [...(modsByLine.get(m.orderLineId) ?? []), m.name]);
    const linesByOrder = new Map<string, OrderLine[]>();
    for (const l of lines) linesByOrder.set(l.orderId, [...(linesByOrder.get(l.orderId) ?? []), l]);
    const seatsByTab = new Map<string, TabSeat[]>();
    for (const s of seats) seatsByTab.set(s.tabId, [...(seatsByTab.get(s.tabId) ?? []), s]);

    const tickets: Ticket[] = [];
    for (const order of orders) {
      const tab = tabById.get(order.tabId);
      const own = linesByOrder.get(order.id);
      if (!tab || !own || own.length === 0 || !order.firedAt) continue;
      const table = tables.find((t) => t.id === tab.serviceTableId);
      const ticketLines = own
        .sort((a, b) => (seatById.get(a.tabSeatId ?? '')?.seatNo ?? 99) - (seatById.get(b.tabSeatId ?? '')?.seatNo ?? 99) || a.clientCreatedAt - b.clientCreatedAt)
        .map<TicketLine>((l) => {
          const seat = l.tabSeatId ? seatById.get(l.tabSeatId) : undefined;
          return {
            lineId: l.id,
            qty: l.qty,
            name: nameOf.get(l.productVariantId) ?? 'Item',
            seatNo: seat?.seatNo ?? null,
            seatLabel: seat?.label ?? null,
            note: l.note,
            modifiers: modsByLine.get(l.id) ?? [],
            state: l.status === 'served' ? 'poured' : l.stockConflict ? 'ran_out' : 'waiting',
            servedAt: l.servedAt,
          };
        });
      tickets.push({
        orderId: order.id,
        tabId: tab.id,
        label: tabLabel({ tableLabel: table?.label, name: tab.name }),
        tabNumber: tab.tabNumber,
        orderNumber: order.orderNumber,
        waiter: names.get(tab.assignedTo) ?? '',
        firedAt: order.firedAt,
        showSeats: showsSeatChips(seatsByTab.get(tab.id) ?? []),
        lines: ticketLines,
        waiting: ticketLines.filter((l) => l.state !== 'poured').length,
        ranOut: ticketLines.filter((l) => l.state === 'ran_out').length,
        lastPouredAt: ticketLines.reduce<number | null>((max, l) => (l.servedAt && (!max || l.servedAt > max) ? l.servedAt : max), null),
      });
    }
    const since = Date.now() - 45 * 60_000;
    return {
      waiting: tickets.filter((t) => t.waiting > 0).sort((a, b) => a.firedAt - b.firedAt),
      poured: tickets
        .filter((t) => t.waiting === 0 && (t.lastPouredAt ?? 0) >= since)
        .sort((a, b) => (b.lastPouredAt ?? 0) - (a.lastPouredAt ?? 0))
        .slice(0, 12),
    };
  }, []);
}

/* ------------------------------------------------------------------ tabs */

export interface CounterTab {
  tabId: string;
  label: string;
  tabNumber: number | null;
  waiter: string;
  openedAt: number;
  seats: { seatNo: number; settled: boolean; label: string | null }[];
  showSeats: boolean;
  due: Cents;
  lines: number;
  waiting: number;
  partSettled: boolean;
  zoneId: string;
}

async function billedLineIds(): Promise<Set<string>> {
  return new Set((await posDb().billLines.toArray()).map((l) => l.orderLineId).filter((x): x is string => Boolean(x)));
}

export function useCounterTabs(): CounterTab[] | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const [tabs, seats, lines, tables, names, billed] = await Promise.all([
      db.tabs.where('status').anyOf(...OPEN_TABS).toArray(),
      db.seats.toArray(),
      db.lines.toArray(),
      db.serviceTables.toArray(),
      staffNames(),
      billedLineIds(),
    ]);
    return tabs
      .map((tab) => {
        const own = lines.filter((l) => l.tabId === tab.id);
        const tabSeats = seats.filter((s) => s.tabId === tab.id && s.status !== 'removed').sort((a, b) => a.seatNo - b.seatNo);
        const table = tables.find((t) => t.id === tab.serviceTableId);
        const due = billableLines(own, billed);
        return {
          tabId: tab.id,
          label: tabLabel({ tableLabel: table?.label, name: tab.name }),
          tabNumber: tab.tabNumber,
          waiter: names.get(tab.assignedTo) ?? '',
          openedAt: tab.openedAt,
          seats: tabSeats.map((s) => ({ seatNo: s.seatNo, settled: s.status === 'settled', label: s.label })),
          showSeats: showsSeatChips(tabSeats),
          due: linesTotal(due),
          lines: due.length,
          waiting: own.filter((l) => l.status === 'pending').length,
          partSettled: tab.status === 'part_settled',
          zoneId: tab.zoneId,
        };
      })
      .sort((a, b) => a.openedAt - b.openedAt);
  }, []);
}

export interface BillGroupLine {
  line: OrderLine;
  name: string;
  modifiers: string[];
  imageUrl: string | null;
}

export interface BillGroup {
  key: string;
  seat: TabSeat | null;
  lines: BillGroupLine[];
  subtotal: Cents;
}

export interface SettleView {
  tabId: string;
  label: string;
  tabNumber: number | null;
  waiter: string;
  openedAt: number;
  status: Tab['status'];
  /** Null while a settled tab still holds its table. docs/16 section 8. */
  clearedAt: number | null | undefined;
  showSeats: boolean;
  seats: TabSeat[];
  activeSeats: TabSeat[];
  groups: BillGroup[];
  remaining: Cents;
  remainingLineIds: string[];
  bills: (Bill & { tenders: Tender[]; seatNo: number | null })[];
  split: { groupId: string; count: number; settled: number; total: Cents } | null;
  waiting: number;
}

/** A tab as the counter settles it: what is left to bill, grouped by seat, and what was billed already. */
export function useSettleView(tabId: string): SettleView | null | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const tab = await db.tabs.get(tabId);
    if (!tab) return null;
    const [seats, lines, modifiers, variants, products, table, names, billed, bills, tenders, split] = await Promise.all([
      db.seats.where('tabId').equals(tabId).toArray(),
      db.lines.where('tabId').equals(tabId).toArray(),
      db.lineModifiers.toArray(),
      db.variants.toArray(),
      db.products.toArray(),
      tab.serviceTableId ? db.serviceTables.get(tab.serviceTableId) : Promise.resolve(undefined),
      staffNames(),
      billedLineIds(),
      db.bills.where('tabId').equals(tabId).toArray(),
      db.tenders.toArray(),
      getMeta<{ groupId: string; count: number }>(`split:${tabId}`),
    ]);
    const nameOf = new Map(variants.map((v) => [v.id, v.name]));
    const visible = seats.filter((s) => s.status !== 'removed').sort((a, b) => a.seatNo - b.seatNo);
    const open = billableLines(lines, billed).sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
    const imageKeyOf = new Map(products.map((p) => [p.id, p.imageKey]));
    const imageOf = new Map(variants.map((v) => [v.id, assetUrl(imageKeyOf.get(v.productId) ?? null, 96, 96)]));
    const decorate = (l: OrderLine): BillGroupLine => ({
      line: l,
      name: nameOf.get(l.productVariantId) ?? 'Item',
      modifiers: modifiers.filter((m) => m.orderLineId === l.id).map((m) => m.name),
      imageUrl: imageOf.get(l.productVariantId) ?? null,
    });
    const groups: BillGroup[] = visible
      .map((s) => {
        const own = open.filter((l) => l.tabSeatId === s.id);
        return { key: s.id, seat: s, lines: own.map(decorate), subtotal: linesTotal(own) };
      })
      .filter((g) => g.lines.length > 0);
    const shared = open.filter((l) => !l.tabSeatId || !visible.some((s) => s.id === l.tabSeatId));
    if (shared.length > 0) groups.push({ key: 'shared', seat: null, lines: shared.map(decorate), subtotal: linesTotal(shared) });

    let splitView: SettleView['split'] = null;
    const groupIds = [...new Set(bills.map((b) => b.splitGroupId).filter((x): x is string => Boolean(x)))];
    const activeGroup = split?.groupId ?? groupIds[groupIds.length - 1];
    if (activeGroup) {
      const groupBills = bills.filter((b) => b.splitGroupId === activeGroup);
      const count = split?.groupId === activeGroup ? split.count : groupBills.length + visible.filter((s) => s.status === 'active').length;
      if (groupBills.length < count && groupBills.length > 0) {
        // The group total is fixed by the first share, which carries every line. docs/05 2.7.
        const ids = new Set(groupBills.map((b) => b.id));
        const groupLines = await db.billLines.filter((l) => ids.has(l.billId)).toArray();
        splitView = { groupId: activeGroup, count, settled: groupBills.length, total: sum(groupLines.map((l) => l.lineTotalCents)) };
      }
    }

    return {
      tabId,
      label: tabLabel({ tableLabel: table?.label, name: tab.name }),
      tabNumber: tab.tabNumber,
      waiter: names.get(tab.assignedTo) ?? '',
      openedAt: tab.openedAt,
      status: tab.status,
      clearedAt: tab.clearedAt,
      showSeats: showsSeatChips(visible),
      seats: visible,
      activeSeats: visible.filter((s) => s.status === 'active'),
      groups,
      remaining: linesTotal(open),
      remainingLineIds: open.map((l) => l.id),
      bills: bills
        .sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0))
        .map((b) => ({ ...b, tenders: tenders.filter((t) => t.billId === b.id), seatNo: visible.find((s) => s.id === b.tabSeatId)?.seatNo ?? null })),
      split: splitView,
      waiting: lines.filter((l) => l.status === 'pending').length,
    };
  }, [tabId]);
}

/* ---------------------------------------------------------------- drawer */

export interface DrawerState {
  device: { id: string; label: string } | null;
  open: DrawerRow | null;
  closedToday: DrawerRow[];
  businessDate: string | null;
}

export function useDrawerState(): DrawerState | undefined {
  return useLiveQuery(async () => {
    const [device, date] = await Promise.all([getMeta<{ id: string; label: string }>(META.deviceId), getMeta<string>(META.businessDate)]);
    if (!device) return { device: null, open: null, closedToday: [], businessDate: date ?? null };
    const rows = await posDb().drawers.where('deviceId').equals(device.id).toArray();
    return {
      device,
      open: rows.find((r) => r.status !== 'closed') ?? null,
      closedToday: rows.filter((r) => r.status === 'closed' && r.businessDate === date).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)),
      businessDate: date ?? null,
    };
  }, []);
}

/* ------------------------------------------------------------ quick sale */

export interface SaleItem {
  variantId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  colour: CategoryColourToken;
  imageKey: string | null;
  imageUrl: string | null;
  glyph: TileGlyph;
  price: Cents | null;
  ruleName: string | null;
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  qtyAvailable: number;
  sort: number;
}

/** Sealed bottles and units a guest can take away without a tab, priced now. */
export function useSaleItems(now: number, timeZone: string): { items: SaleItem[]; categories: { id: string; name: string }[] } | undefined {
  const index = usePricingIndex();
  const data = useLiveQuery(async () => {
    const db = posDb();
    const [variants, products, categories, availability] = await Promise.all([db.variants.toArray(), db.products.toArray(), db.categories.orderBy('sortOrder').toArray(), db.availability.toArray()]);
    return { variants, products, categories, availability };
  }, []);
  if (!data || !index) return undefined;
  const items: SaleItem[] = [];
  for (const v of data.variants) {
    if (v.kind !== 'sealed' || v.status !== 'active') continue;
    const product = data.products.find((p) => p.id === v.productId);
    const category = data.categories.find((c) => c.id === product?.categoryId);
    if (!product || !category || product.status !== 'active') continue;
    const price = tryResolvePrice(index, { variantId: v.id, qty: 1, at: now, timeZone });
    const entry = data.availability.find((a) => a.productVariantId === v.id);
    items.push({
      variantId: v.id,
      name: v.name,
      categoryId: category.id,
      categoryName: category.name,
      colour: category.colourToken,
      imageKey: product.imageKey,
      imageUrl: assetUrl(product.imageKey),
      glyph: tileGlyph(v.kind, category.name),
      price: price?.unitPriceCents ?? null,
      ruleName: price?.appliedRuleName ?? null,
      state: entry?.state ?? 'available',
      reason: entry?.reason ?? null,
      qtyAvailable: entry?.qtyAvailable ?? 0,
      sort: category.sortOrder * 1000 + v.sortOrder,
    });
  }
  items.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const used = new Set(items.map((i) => i.categoryId));
  return { items, categories: data.categories.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: c.name })) };
}
