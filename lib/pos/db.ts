'use client';

import type { BillLine, DrawerSession } from '@bliss/db/seed/types';
import type { StaffSurface } from '@bliss/shared/identity';
import type {
  AvailabilityEntry,
  Bill,
  Category,
  Modifier,
  ModifierGroup,
  Order,
  OrderLine,
  OrderLineModifier,
  PermissionKey,
  PriceList,
  PriceListItem,
  PriceRule,
  Product,
  ProductVariant,
  RoleKey,
  ServiceTable,
  Tab,
  TabSeat,
  Tender,
  VariantModifierGroup,
  Zone,
} from '@bliss/shared/domain';
import type { OutboxEntry } from '@bliss/shared/sync';
import Dexie, { type EntityTable } from 'dexie';

export interface StaffDirectoryEntry {
  id: string;
  displayName: string;
  roleKey: RoleKey;
  permissions: PermissionKey[];
  colourIndex: number;
}

export interface DeviceEntry {
  id: string;
  label: string;
  kind: string;
  status: string;
}

export interface RecipeEntry {
  id: string;
  productVariantId: string;
  name: string;
  components: { componentVariantId: string; qty: number }[];
}

/**
 * A drawer session as a device holds it: the blind projection from the server. Before the count is
 * committed the expected figure is absent from the row, because the server never sent it.
 */
export interface DrawerRow extends Pick<DrawerSession, 'id' | 'businessDate' | 'deviceId' | 'openedBy' | 'openedAt' | 'openingFloatCents' | 'status'> {
  drops: { id: string; amountCents: DrawerSession['openingFloatCents']; reason: string | null; occurredAt: number; createdBy: string }[];
  cashBills: number;
  closedBy?: string | null;
  closedAt?: number | null;
  countedCashCents?: DrawerSession['countedCashCents'];
  expectedCashCents?: DrawerSession['expectedCashCents'];
  varianceCents?: DrawerSession['varianceCents'];
  varianceReason?: string | null;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * The Floor's local store, docs/09 Phase 4 CLIENT: catalogue snapshot, availability map, open tabs,
 * seats, orders, lines, outbox and cursors. The tablet trades from here; the cloud is a destination,
 * not a dependency (docs/02 constraint K1).
 */
export class PosDatabase extends Dexie {
  meta!: EntityTable<MetaEntry, 'key'>;
  categories!: EntityTable<Category, 'id'>;
  products!: EntityTable<Product, 'id'>;
  variants!: EntityTable<ProductVariant, 'id'>;
  modifierGroups!: EntityTable<ModifierGroup, 'id'>;
  modifiers!: EntityTable<Modifier, 'id'>;
  variantModifierGroups!: Dexie.Table<VariantModifierGroup, [string, string]>;
  priceLists!: EntityTable<PriceList, 'id'>;
  priceListItems!: EntityTable<PriceListItem, 'id'>;
  priceRules!: EntityTable<PriceRule, 'id'>;
  recipes!: EntityTable<RecipeEntry, 'id'>;
  availability!: EntityTable<AvailabilityEntry, 'productVariantId'>;
  zones!: EntityTable<Zone, 'id'>;
  serviceTables!: EntityTable<ServiceTable, 'id'>;
  staff!: EntityTable<StaffDirectoryEntry, 'id'>;
  devices!: EntityTable<DeviceEntry, 'id'>;
  tabs!: EntityTable<Tab, 'id'>;
  seats!: EntityTable<TabSeat, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  lines!: EntityTable<OrderLine, 'id'>;
  lineModifiers!: EntityTable<OrderLineModifier, 'id'>;
  bills!: EntityTable<Bill, 'id'>;
  billLines!: EntityTable<BillLine, 'id'>;
  tenders!: EntityTable<Tender, 'id'>;
  drawers!: EntityTable<DrawerRow, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;

  constructor(surface: StaffSurface) {
    // One database per surface, so a browser can be Floor 1 and Counter 1 at once and an outbox never
    // mixes the two. docs/14 section 3.
    super(`bliss-${surface}`);
    this.version(1).stores({
      meta: 'key',
      categories: 'id, sortOrder',
      products: 'id, categoryId',
      variants: 'id, productId',
      modifierGroups: 'id',
      modifiers: 'id, modifierGroupId',
      variantModifierGroups: '[productVariantId+modifierGroupId], productVariantId',
      priceLists: 'id',
      priceListItems: 'id, priceListId, productVariantId',
      priceRules: 'id',
      recipes: 'id, productVariantId',
      availability: 'productVariantId',
      zones: 'id, sortOrder',
      serviceTables: 'id, zoneId',
      staff: 'id',
      devices: 'id',
      tabs: 'id, status, assignedTo, serviceTableId',
      seats: 'id, tabId',
      orders: 'id, tabId, status',
      lines: 'id, tabId, orderId, tabSeatId, status',
      lineModifiers: 'id, orderLineId',
      outbox: 'id, seq, status, aggregateId, kind',
    });
    this.version(2).stores({
      bills: 'id, tabId, businessDate, deviceId, settledAt',
      billLines: 'id, billId, orderLineId',
      tenders: 'id, billId',
      drawers: 'id, deviceId, status',
    });
  }
}

let instance: PosDatabase | null = null;

/** The surface this page runs as, from the root layout's data-surface attribute. */
export function currentSurface(): StaffSurface {
  if (typeof document === 'undefined') throw new Error('The device store only exists in the browser.');
  return document.documentElement.dataset.surface === 'counter' ? 'counter' : 'floor';
}

export function posDb(): PosDatabase {
  if (typeof window === 'undefined') throw new Error('The device store only exists in the browser.');
  instance ??= new PosDatabase(currentSurface());
  return instance;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await posDb().meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await posDb().meta.put({ key, value });
}

export const META = {
  deviceId: 'device.id',
  deviceSeq: 'device.outboxSeq',
  session: 'session',
  catalogueVersion: 'cursor.catalogueVersion',
  availabilityVersion: 'cursor.availabilityVersion',
  lastPulledAt: 'cursor.lastPulledAt',
  lastPushedAt: 'cursor.lastPushedAt',
  tradeCursor: 'cursor.trade',
  epoch: 'cursor.epoch',
  outlet: 'outlet',
  businessDate: 'businessDate',
  bootstrapped: 'bootstrapped',
  selectedSeat: (tabId: string) => `selectedSeat:${tabId}`,
  orderDelivered: (orderId: string) => `orderDelivered:${orderId}`,
  forceOffline: 'dev.forceOffline',
  onboarded: 'onboarded',
  deviceNickname: 'device.nickname',
  preferredZone: 'device.preferredZone',
  ticketTarget: 'device.ticketTarget',
  screenKeepAwake: 'device.screenKeepAwake',
  hapticsEnabled: 'device.hapticsEnabled',
} as const;
