'use client';

import type { AvailabilityReason, AvailabilityState, CategoryColourToken, OrderLine, OrderLineModifier, ServiceTable, Tab, TabSeat, Zone } from '@bliss/shared/domain';
import { type Cents, ZERO, add, sum } from '@bliss/shared/money';
import { tryResolvePrice } from '@bliss/shared/pricing';
import { type TableStage, isSeated, tabLabel, tableStage } from '@bliss/shared/trade';
import { showsSeatChips, showsSeatControls } from '@bliss/shared/seats';
import type { OutboxEntry } from '@bliss/shared/sync';
import type { TicketLineState } from '@bliss/ui/components/floor/ticket';
import type { TileGlyph } from '@bliss/ui/components/floor/product-tile';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { assetUrl } from '../assets';
import { META, type StaffDirectoryEntry, posDb, getMeta } from './db';
import type { SeatSelection } from './mutations';
import { usePricingIndex } from './pricing';

export interface OutletMeta {
  id: string;
  name: string;
  timezone: string;
  cutover: string;
}

export function useOutlet(): OutletMeta | undefined {
  return useLiveQuery(() => getMeta<OutletMeta>(META.outlet), []);
}

export { assetUrl };

const GLYPH_BY_CATEGORY: Record<string, TileGlyph> = { Beer: 'beer', Spirits: 'spirit', Wine: 'wine', 'Soft drinks': 'soft', Food: 'food' };

/** The glyph a tile falls back on when it has no photograph. Shared by the Floor grid and the Counter's quick sale. */
export function tileGlyph(kind: string, categoryName: string): TileGlyph {
  return kind === 'sealed' && categoryName !== 'Beer' && categoryName !== 'Soft drinks' && categoryName !== 'Food' ? 'bottle' : (GLYPH_BY_CATEGORY[categoryName] ?? 'soft');
}

export interface TileModel {
  variantId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  colour: CategoryColourToken;
  glyph: TileGlyph;
  imageUrl: string | null;
  price: Cents | null;
  ruleName: string | null;
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  qtyAvailable: number;
  sort: number;
}

/**
 * The item grid, driven by live availability rather than a static catalogue. docs/01 section 5.
 * Prices resolve at `now` with the same pipeline the server runs, so a happy hour boundary flips the
 * tiles without a reload.
 */
export function useGrid(now: number, timezone: string | undefined) {
  const index = usePricingIndex();
  const data = useLiveQuery(async () => {
    const db = posDb();
    const [categories, products, variants, availability] = await Promise.all([
      db.categories.orderBy('sortOrder').toArray(),
      db.products.toArray(),
      db.variants.toArray(),
      db.availability.toArray(),
    ]);
    return { categories, products, variants, availability };
  }, []);

  return useMemo(() => {
    if (!data || !index || !timezone) return undefined;
    const productById = new Map(data.products.map((p) => [p.id, p]));
    const categoryById = new Map(data.categories.map((c) => [c.id, c]));
    const availabilityById = new Map(data.availability.map((a) => [a.productVariantId, a]));
    const tiles: TileModel[] = [];
    for (const variant of data.variants) {
      if (variant.status !== 'active') continue;
      const product = productById.get(variant.productId);
      const category = product ? categoryById.get(product.categoryId) : undefined;
      if (!product || !category || product.status !== 'active' || category.status !== 'active') continue;
      const entry = availabilityById.get(variant.id);
      const resolved = tryResolvePrice(index, { variantId: variant.id, qty: 1, at: now, timeZone: timezone });
      tiles.push({
        variantId: variant.id,
        name: variant.name,
        categoryId: category.id,
        categoryName: category.name,
        colour: category.colourToken,
        glyph: tileGlyph(variant.kind, category.name),
        imageUrl: assetUrl(product.imageKey),
        price: resolved?.unitPriceCents ?? null,
        ruleName: resolved?.appliedRuleName ?? null,
        state: entry?.state ?? 'available',
        reason: entry?.reason ?? null,
        qtyAvailable: entry?.qtyAvailable ?? 0,
        sort: category.sortOrder * 1000 + variant.sortOrder,
      });
    }
    tiles.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    const counts = new Map<string, number>();
    for (const t of tiles) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    const activeRule = tiles.find((t) => t.ruleName)?.ruleName ?? null;
    return { categories: data.categories.filter((c) => c.status === 'active').map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })), tiles, activeRule };
  }, [data, index, now, timezone]);
}

async function unsentOrderIds(): Promise<Set<string>> {
  const entries = (await posDb().outbox.where('status').anyOf('pending', 'inflight', 'rejected').toArray()) as OutboxEntry[];
  return new Set(entries.filter((e): e is OutboxEntry<'order.fire'> => e.kind === 'order.fire').map((e) => e.payload.orderId));
}

/**
 * A line's state for the screens. The line's own status says whether the counter poured it (the
 * status is still called `served` from before delivery was its own step); the order says whether
 * the waiter has set it down at the table.
 */
export function lineState(line: OrderLine, unsent: Set<string>, delivered?: ReadonlySet<string>): TicketLineState {
  if (line.status === 'draft') return 'draft';
  if (line.status === 'served') return delivered?.has(line.orderId) ? 'served' : 'poured';
  if (unsent.has(line.orderId)) return 'unsent';
  if (line.stockConflict) return 'ran_out';
  return 'waiting';
}

export interface TabListItem {
  tab: Tab;
  table: ServiceTable | null;
  label: string;
  seats: TabSeat[];
  total: Cents;
  unsentCount: number;
  draftCount: number;
  ranOutCount: number;
  showSeats: boolean;
  waiterName: string;
  /** Where the table stands, and so what its card offers next. */
  stage: TableStage;
  /** Rounds poured and not yet at the table. */
  toServe: number;
}

export interface SeatedTab {
  tab: Tab;
  table: ServiceTable | null;
  label: string;
  paid: Cents;
  waiterName: string;
  settledFor: number;
}

/**
 * Tonight's paid tabs whose guests have not left. docs/16 section 8. They hold their table until a
 * waiter clears it, so the free table list leaves them out and the tab list offers the clear.
 */
export function useSeatedTabs(): SeatedTab[] | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const [tabs, bills, tables, staff] = await Promise.all([db.tabs.where('status').equals('settled').toArray(), db.bills.toArray(), db.serviceTables.toArray(), db.staff.toArray()]);
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const staffById = new Map(staff.map((x) => [x.id, x]));
    return tabs
      .filter((t) => isSeated(t))
      .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))
      .map((tab) => {
        const table = tab.serviceTableId ? (tableById.get(tab.serviceTableId) ?? null) : null;
        return {
          tab,
          table,
          label: tabLabel({ tableLabel: table?.label, name: tab.name }),
          paid: sum(bills.filter((b) => b.tabId === tab.id).map((b) => b.totalCents)),
          waiterName: staffById.get(tab.assignedTo)?.displayName ?? '',
          settledFor: tab.closedAt ?? tab.openedAt,
        };
      });
  }, []);
}

export function useOpenTabs(): TabListItem[] | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const [tabs, seats, lines, tables, staff, unsent, orders] = await Promise.all([
      db.tabs.where('status').anyOf('open', 'part_settled', 'settling').toArray(),
      db.seats.toArray(),
      db.lines.toArray(),
      db.serviceTables.toArray(),
      db.staff.toArray(),
      unsentOrderIds(),
      db.orders.toArray(),
    ]);
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const delivered = new Set(orders.filter((o) => o.deliveredAt).map((o) => o.id));
    return tabs
      .sort((a, b) => a.openedAt - b.openedAt)
      .map((tab) => {
        const own = lines.filter((l) => l.tabId === tab.id && l.status !== 'voided');
        const tabSeats = seats.filter((s) => s.tabId === tab.id && s.status !== 'removed').sort((a, b) => a.seatNo - b.seatNo);
        const table = tab.serviceTableId ? (tableById.get(tab.serviceTableId) ?? null) : null;
        return {
          tab,
          table,
          label: tabLabel({ tableLabel: table?.label, name: tab.name }),
          seats: tabSeats,
          total: sum(own.map((l) => l.lineTotalCents)),
          unsentCount: own.filter((l) => l.status !== 'draft' && unsent.has(l.orderId)).length,
          draftCount: own.filter((l) => l.status === 'draft').length,
          ranOutCount: own.filter((l) => l.stockConflict && l.status !== 'served').length,
          showSeats: showsSeatChips(tabSeats),
          waiterName: staffById.get(tab.assignedTo)?.displayName ?? '',
          stage: tableStage(tab, own, (id) => delivered.has(id)),
          toServe: new Set(own.filter((l) => l.status === 'served' && !delivered.has(l.orderId)).map((l) => l.orderId)).size,
        };
      });
  }, []);
}

export interface TicketGroup {
  key: string;
  seat: TabSeat | null;
  subtotal: Cents;
  lines: { line: OrderLine; state: TicketLineState; deliveredAt: number | null; modifiers: OrderLineModifier[]; name: string; imageUrl: string | null }[];
}

export interface TabDetail {
  tab: Tab;
  table: ServiceTable | null;
  zone: Zone | null;
  label: string;
  seats: (TabSeat & { total: Cents })[];
  activeSeats: TabSeat[];
  sharedTotal: Cents;
  total: Cents;
  groups: TicketGroup[];
  draftCount: number;
  draftTotal: Cents;
  unsentCount: number;
  selected: SeatSelection;
  showControls: boolean;
  showChips: boolean;
  blocked: boolean;
}

export function useTab(tabId: string): TabDetail | null | undefined {
  return useLiveQuery(async () => {
    const db = posDb();
    const tab = await db.tabs.get(tabId);
    if (!tab) return null;
    const [seats, lines, modifiers, variants, products, table, zones, unsent, selected, rejected, orders] = await Promise.all([
      db.seats.where('tabId').equals(tabId).toArray(),
      db.lines.where('tabId').equals(tabId).toArray(),
      db.lineModifiers.toArray(),
      db.variants.toArray(),
      db.products.toArray(),
      tab.serviceTableId ? db.serviceTables.get(tab.serviceTableId) : Promise.resolve(undefined),
      db.zones.toArray(),
      unsentOrderIds(),
      getMeta<SeatSelection>(META.selectedSeat(tabId)),
      db.outbox.where('aggregateId').equals(tabId).filter((e) => e.status === 'rejected').count(),
      db.orders.where('tabId').equals(tabId).toArray(),
    ]);
    const delivered = new Set(orders.filter((o) => o.deliveredAt).map((o) => o.id));
    const deliveredAt = new Map(orders.map((o) => [o.id, o.deliveredAt ?? null]));
    const nameOf = new Map(variants.map((v) => [v.id, v.name]));
    const productById = new Map(products.map((p) => [p.id, p]));
    const imageOf = new Map(variants.map((v) => {
      const prod = productById.get(v.productId);
      return [v.id, prod ? assetUrl(prod.imageKey) : null];
    }));
    const live = lines.filter((l) => l.status !== 'voided').sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
    const visibleSeats = seats.filter((s) => s.status !== 'removed').sort((a, b) => a.seatNo - b.seatNo);
    const activeSeats = visibleSeats.filter((s) => s.status === 'active');
    const seatTotals = visibleSeats.map((s) => ({ ...s, total: sum(live.filter((l) => l.tabSeatId === s.id).map((l) => l.lineTotalCents)) }));
    const decorate = (l: OrderLine) => ({
      line: l,
      state: lineState(l, unsent, delivered),
      deliveredAt: deliveredAt.get(l.orderId) ?? null,
      modifiers: modifiers.filter((m) => m.orderLineId === l.id),
      name: nameOf.get(l.productVariantId) ?? 'Unknown item',
      imageUrl: imageOf.get(l.productVariantId) ?? null,
    });
    const groups: TicketGroup[] = seatTotals
      .map((s) => ({ key: s.id, seat: s as TabSeat, subtotal: s.total, lines: live.filter((l) => l.tabSeatId === s.id).map(decorate) }))
      .filter((g) => g.lines.length > 0);
    const shared = live.filter((l) => l.tabSeatId === null);
    if (shared.length > 0) groups.push({ key: 'shared', seat: null, subtotal: sum(shared.map((l) => l.lineTotalCents)), lines: shared.map(decorate) });

    const drafts = live.filter((l) => l.status === 'draft');
    const selectedValid =
      selected === 'shared' || activeSeats.some((s) => s.id === selected) ? (selected as SeatSelection) : (activeSeats[0]?.id ?? 'shared');
    return {
      tab,
      table: table ?? null,
      zone: zones.find((z) => z.id === tab.zoneId) ?? null,
      label: tabLabel({ tableLabel: table?.label, name: tab.name }),
      seats: seatTotals,
      activeSeats,
      sharedTotal: shared.reduce((a, l) => add(a, l.lineTotalCents), ZERO),
      total: sum(live.map((l) => l.lineTotalCents)),
      groups,
      draftCount: drafts.length,
      draftTotal: sum(drafts.map((l) => l.lineTotalCents)),
      unsentCount: live.filter((l) => l.status !== 'draft' && unsent.has(l.orderId)).length,
      selected: showsSeatControls(visibleSeats) ? selectedValid : (activeSeats[0]?.id ?? 'shared'),
      showControls: showsSeatControls(visibleSeats),
      showChips: showsSeatChips(visibleSeats),
      blocked: rejected > 0,
    };
  }, [tabId]);
}

export function useZonesAndTables() {
  return useLiveQuery(async () => {
    const db = posDb();
    const [zones, tables] = await Promise.all([db.zones.orderBy('sortOrder').toArray(), db.serviceTables.toArray()]);
    return { zones, tables };
  }, []);
}

export function useStaffDirectory(): StaffDirectoryEntry[] | undefined {
  return useLiveQuery(() => posDb().staff.toArray(), []);
}

export interface FiredOrderLine {
  line: OrderLine;
  name: string;
  seatNo: number | null;
  state: TicketLineState;
  modifiers: string[];
}

export interface FiredOrderView {
  orderId: string;
  tabId: string;
  label: string;
  firedAt: number;
  unsent: boolean;
  lines: FiredOrderLine[];
  state: 'held' | 'at_bar' | 'poured' | 'served' | 'needs_you';
  deliveredAt?: number;
  waiterName?: string;
  waiterId?: string;
  zoneName?: string;
  total: Cents;
}

export function useFiredOrders(staffId?: string | null): FiredOrderView[] | undefined {
  return useLiveQuery(async () => {
    if (staffId === undefined) return [];
    const db = posDb();
    const [tabs, orders, lines, seats, variants, tables, zones, staff, modifiers, modDefs, unsent, allMeta] = await Promise.all([
      staffId === null
        ? db.tabs.where('status').anyOf('open', 'part_settled', 'settling').toArray()
        : db.tabs.where('assignedTo').equals(staffId).toArray(),
      db.orders.toArray(),
      db.lines.toArray(),
      db.seats.toArray(),
      db.variants.toArray(),
      db.serviceTables.toArray(),
      db.zones.toArray(),
      db.staff.toArray(),
      db.lineModifiers.toArray(),
      db.modifiers.toArray(),
      unsentOrderIds(),
      db.meta.toArray(),
    ]);
    const relevantTabs = new Map(
      tabs
        .filter((t) => t.status === 'open' || t.status === 'part_settled' || t.status === 'settling')
        .map((t) => [t.id, t]),
    );
    const deliveredOrders = new Map<string, { deliveredAt: number; deliveredBy: string }>();
    for (const m of allMeta) {
      if (typeof m.key === 'string' && m.key.startsWith('orderDelivered:')) {
        const oId = m.key.slice('orderDelivered:'.length);
        deliveredOrders.set(oId, m.value as { deliveredAt: number; deliveredBy: string });
      }
    }
    const nameOf = new Map(variants.map((v) => [v.id, v.name]));
    const modifierNameOf = new Map(modDefs.map((m) => [m.id, m.name]));
    const staffNameOf = new Map(staff.map((s) => [s.id, s.displayName]));
    const zoneNameOf = new Map(zones.map((z) => [z.id, z.name]));
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const delivered = new Set(orders.filter((o) => o.deliveredAt || deliveredOrders.has(o.id)).map((o) => o.id));

    return orders
      .filter((o) => relevantTabs.has(o.tabId) && o.status !== 'draft' && o.firedAt)
      .sort((a, b) => (b.firedAt ?? 0) - (a.firedAt ?? 0))
      .map((o) => {
        const tab = relevantTabs.get(o.tabId)!;
        const table = tab.serviceTableId ? tableById.get(tab.serviceTableId) : undefined;
        const own = lines
          .filter((l) => l.orderId === o.id && l.status !== 'voided')
          .map((l) => {
            const lineMods = modifiers
              .filter((m) => m.orderLineId === l.id)
              .map((m) => modifierNameOf.get(m.modifierId) ?? '')
              .filter(Boolean);
            return {
              line: l,
              name: nameOf.get(l.productVariantId) ?? '',
              seatNo: seats.find((s) => s.id === l.tabSeatId)?.seatNo ?? null,
              state: lineState(l, unsent, delivered),
              modifiers: lineMods,
            };
          });
        // Delivery is on the order now, synced; the old device-only mark is read until it is gone.
        const delivery = o.deliveredAt ? { deliveredAt: o.deliveredAt, deliveredBy: o.deliveredBy ?? '' } : deliveredOrders.get(o.id);
        const isAllPoured = own.length > 0 && own.every((l) => l.state === 'poured' || l.state === 'served');
        const state: FiredOrderView['state'] = unsent.has(o.id)
          ? 'held'
          : own.some((l) => l.state === 'ran_out')
            ? 'needs_you'
            : delivery
              ? 'served'
              : isAllPoured
                ? 'poured'
                : 'at_bar';
        return {
          orderId: o.id,
          tabId: o.tabId,
          label: tabLabel({ tableLabel: table?.label, name: tab.name }),
          firedAt: o.firedAt ?? 0,
          unsent: unsent.has(o.id),
          lines: own,
          state,
          deliveredAt: delivery?.deliveredAt,
          waiterName: staffNameOf.get(tab.assignedTo) ?? '',
          waiterId: tab.assignedTo,
          zoneName: tab.zoneId ? zoneNameOf.get(tab.zoneId) : undefined,
          total: sum(own.map((l) => l.line.lineTotalCents)),
        };
      })
      .filter((o) => o.lines.length > 0);
  }, [staffId]);
}
