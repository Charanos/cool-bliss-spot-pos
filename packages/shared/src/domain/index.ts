/**
 * Domain entity shapes, mapped one to one from docs/04-data-model.md with camelCase names.
 * Money is Cents. Timestamps are epoch milliseconds in UTC. Business dates are YYYY-MM-DD.
 *
 * These are the shapes the clients and the module services agree on. The Drizzle schema in
 * packages/db will map the same columns; nothing here knows about a driver.
 */
import type { Cents } from '../money/cents';
import type { IsoDate } from '../time/zoned';

export type Id = string;
export type EpochMs = number;

/* ------------------------------------------------------------------ identity */

export type RoleKey = 'owner' | 'manager' | 'supervisor' | 'cashier' | 'waiter' | 'stock_controller';

export type PermissionKey =
  | 'cost.read'
  | 'price.write'
  | 'void.approve'
  | 'discount.approve'
  | 'hold.set'
  | 'stock.count.commit'
  | 'stock.writeoff'
  | 'drawer.close'
  | 'refund.approve'
  | 'staff.manage'
  | 'device.manage'
  | 'report.margin'
  | 'export.run';

export interface Outlet {
  id: Id;
  name: string;
  legalName: string;
  timezone: string;
  businessDayCutover: string;
  address: string;
  currency: 'KES';
  taxRateBps: number;
  pricesTaxInclusive: boolean;
  lowStockDefault: number;
  drawerVarianceThresholdCents: Cents;
  status: 'active' | 'archived';
}

export interface Role {
  id: Id;
  key: RoleKey;
  name: string;
  isSystem: boolean;
  permissions: PermissionKey[];
}

export type EmploymentStatus = 'active' | 'suspended' | 'left';

export interface Staff {
  id: Id;
  outletId: Id;
  fullName: string;
  displayName: string;
  roleId: Id;
  employmentStatus: EmploymentStatus;
  colourIndex: number;
  pinLockedUntil: EpochMs | null;
}

export type DeviceKind = 'floor' | 'counter' | 'bar' | 'console';
export type DeviceStatus = 'active' | 'suspended' | 'lost' | 'retired';

export interface Device {
  id: Id;
  outletId: Id;
  label: string;
  kind: DeviceKind;
  enrolledAt: EpochMs;
  enrolledBy: Id;
  lastSeenAt: EpochMs | null;
  lastEventSeq: number;
  appVersion: string;
  status: DeviceStatus;
  revokedAt: EpochMs | null;
  revokedReason: string | null;
}

/* ------------------------------------------------------- catalogue and pricing */

export type RoutingTarget = 'bar' | 'kitchen' | 'none';
export type CatalogueStatus = 'active' | 'archived';

/** A category colour is a token key, never a hex value. */
export type CategoryColourToken = 'glacier' | 'ember' | 'leaf' | 'iris' | 'rose' | 'steel' | 'brass' | 'jade';

export interface Category {
  id: Id;
  outletId: Id;
  parentId: Id | null;
  name: string;
  sortOrder: number;
  routingTarget: RoutingTarget;
  colourToken: CategoryColourToken;
  trackStock: boolean;
  status: CatalogueStatus;
}

export interface Product {
  id: Id;
  outletId: Id;
  categoryId: Id;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  containerVolumeMl: number | null;
  abv: number | null;
  isSoldSealed: boolean;
  isSoldByServe: boolean;
  lowStockThreshold: number | null;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  defaultSupplierId: Id | null;
  /**
   * Proposed amendment to docs/04-data-model.md: a product photograph for the Floor tile.
   * An asset key, resolved to a URL by the asset store and cached on the device for offline use.
   */
  imageKey: string | null;
  status: CatalogueStatus;
}

export type VariantKind = 'sealed' | 'serve';

export interface ProductVariant {
  id: Id;
  outletId: Id;
  productId: Id;
  name: string;
  kind: VariantKind;
  serveVolumeMl: number | null;
  depletionFactor: number;
  barcode: string | null;
  isDefault: boolean;
  sortOrder: number;
  status: CatalogueStatus;
}

export interface ModifierGroup {
  id: Id;
  outletId: Id;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  status: CatalogueStatus;
}

export interface Modifier {
  id: Id;
  modifierGroupId: Id;
  name: string;
  priceDeltaCents: Cents;
  linkedVariantId: Id | null;
  sortOrder: number;
  status: CatalogueStatus;
}

export interface VariantModifierGroup {
  productVariantId: Id;
  modifierGroupId: Id;
  sortOrder: number;
}

export interface PriceList {
  id: Id;
  outletId: Id;
  name: string;
  kind: 'base' | 'overlay';
  priority: number;
  effectiveFrom: EpochMs | null;
  effectiveTo: EpochMs | null;
  status: CatalogueStatus;
}

export interface PriceListItem {
  id: Id;
  priceListId: Id;
  productVariantId: Id;
  priceCents: Cents;
  minQty: number | null;
  status: CatalogueStatus;
}

export type PriceRuleTarget = 'all' | 'category' | 'product' | 'variant';

export interface PriceRule {
  id: Id;
  outletId: Id;
  name: string;
  priceListId: Id;
  /** ISO weekdays, 1 Monday to 7 Sunday. */
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  appliesTo: PriceRuleTarget;
  targetIds: Id[];
  priority: number;
  effectiveFrom: EpochMs | null;
  effectiveTo: EpochMs | null;
  status: CatalogueStatus;
}

/* ------------------------------------------------ inventory and availability */

export type AvailabilityState = 'available' | 'low' | 'last_few' | 'finished';
export type AvailabilityReason = 'stock' | 'hold' | 'variant_status' | 'category_status';

export interface AvailabilityEntry {
  productVariantId: Id;
  state: AvailabilityState;
  qtyAvailable: number;
  threshold: number;
  reason: AvailabilityReason | null;
  computedAt: EpochMs;
  version: number;
}

export type StockLocationKind = 'store' | 'service' | 'retail';

export interface StockLocation {
  id: Id;
  outletId: Id;
  name: string;
  kind: StockLocationKind;
  isDefaultReceipt: boolean;
  isDefaultSale: boolean;
  status: CatalogueStatus;
}

export type MovementType =
  | 'receipt'
  | 'sale'
  | 'sale_reversal'
  | 'transfer_out'
  | 'transfer_in'
  | 'write_off_breakage'
  | 'write_off_spillage'
  | 'write_off_expiry'
  | 'staff_drink'
  | 'comp'
  | 'count_adjustment'
  | 'return_to_supplier'
  | 'opening_balance';

export interface StockMovement {
  id: Id;
  outletId: Id;
  businessDate: IsoDate;
  productVariantId: Id;
  stockLocationId: Id;
  /** Signed, in the variant's stock unit: bottles for spirits, units for beer. */
  qtyDelta: number;
  volumeDeltaMl: number | null;
  unitCostCents: Cents;
  movementType: MovementType;
  sourceType: string;
  sourceId: Id | null;
  reason: string | null;
  occurredAt: EpochMs;
  createdBy: Id;
  deviceId: Id | null;
}

export interface StockHold {
  id: Id;
  outletId: Id;
  productVariantId: Id;
  placedBy: Id;
  placedAt: EpochMs;
  reason: string;
  expectedBack: IsoDate | null;
  releasedBy: Id | null;
  releasedAt: EpochMs | null;
  releaseNote: string | null;
  status: 'active' | 'released';
}

export type CountKind = 'full' | 'cycle' | 'spot';
export type CountStatus = 'open' | 'counting' | 'review' | 'committed' | 'cancelled';

export interface StockCount {
  id: Id;
  outletId: Id;
  businessDate: IsoDate;
  stockLocationId: Id;
  kind: CountKind;
  isBlind: boolean;
  status: CountStatus;
  openedBy: Id;
  openedAt: EpochMs;
  committedBy: Id | null;
  committedAt: EpochMs | null;
  totalVarianceCents: Cents | null;
  notes: string | null;
}

/* ------------------------------------------------------------------- trade */

export interface Zone {
  id: Id;
  outletId: Id;
  name: string;
  sortOrder: number;
  defaultPriceListId: Id | null;
  status: CatalogueStatus;
}

export type TableStatus = 'available' | 'occupied' | 'out_of_service';

export interface ServiceTable {
  id: Id;
  outletId: Id;
  zoneId: Id;
  label: string;
  seats: number;
  positionX: number;
  positionY: number;
  status: TableStatus;
}

export type TabStatus = 'open' | 'part_settled' | 'settling' | 'settled' | 'voided' | 'merged_into';

export interface Tab {
  id: Id;
  outletId: Id;
  businessDate: IsoDate;
  serviceTableId: Id | null;
  zoneId: Id;
  /** Server allocated, gapless per business day. Null until the open is acknowledged. */
  tabNumber: number | null;
  name: string | null;
  guestCount: number;
  openedBy: Id;
  openedAt: EpochMs;
  assignedTo: Id;
  status: TabStatus;
  mergedIntoTabId: Id | null;
  closedAt: EpochMs | null;
}

export type SeatStatus = 'active' | 'settled' | 'removed';

export interface TabSeat {
  id: Id;
  outletId: Id;
  tabId: Id;
  seatNo: number;
  label: string | null;
  colourIndex: number;
  status: SeatStatus;
  settledBillId: Id | null;
  settledAt: EpochMs | null;
  createdBy: Id;
  createdAt: EpochMs;
}

/** `draft` exists only on the client. Anything the server holds is at least `fired`. */
export type OrderStatus = 'draft' | 'fired' | 'partially_served' | 'served' | 'voided';

export interface Order {
  id: Id;
  outletId: Id;
  tabId: Id;
  businessDate: IsoDate;
  orderNumber: number | null;
  firedAt: EpochMs | null;
  firedBy: Id | null;
  deviceId: Id;
  status: OrderStatus;
  clientCreatedAt: EpochMs;
  serverReceivedAt: EpochMs | null;
  note: string | null;
}

export type LineStatus = 'draft' | 'pending' | 'served' | 'voided';

export interface DerivationStep {
  label: string;
  input: string;
  op: string;
  output: string;
}

export interface OrderLine {
  id: Id;
  outletId: Id;
  orderId: Id;
  /** Denormalised for local queries. On the server it is derived through orders.tab_id. */
  tabId: Id;
  /** Null means Shared. */
  tabSeatId: Id | null;
  productVariantId: Id;
  qty: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  priceDerivation: DerivationStep[];
  note: string | null;
  status: LineStatus;
  stockConflict: boolean;
  servedAt: EpochMs | null;
  servedBy: Id | null;
  voidedBy: Id | null;
  voidedAt: EpochMs | null;
  voidReason: string | null;
  createdBy: Id;
  deviceId: Id;
  clientCreatedAt: EpochMs;
}

export interface OrderLineModifier {
  id: Id;
  orderLineId: Id;
  modifierId: Id;
  /** Name snapshot for the ticket and the bar, so a renamed modifier never rewrites history. */
  name: string;
  qty: number;
  priceDeltaCents: Cents;
  linkedVariantId: Id | null;
}

export interface Shift {
  id: Id;
  outletId: Id;
  businessDate: IsoDate;
  staffId: Id;
  roleAtShift: RoleKey;
  startedAt: EpochMs;
  endedAt: EpochMs | null;
  handoverTo: Id | null;
  handoverAt: EpochMs | null;
  tabsOpened: number;
  tabsHandedOver: number;
  salesCents: Cents;
  voidsCents: Cents;
  discountsCents: Cents;
  status: 'open' | 'closed';
}

/* -------------------------------------------------------------- settlement */

export type BillScope = 'tab' | 'seat' | 'even_split' | 'quick_sale';
export type BillStatus = 'open' | 'settled' | 'refunded' | 'partially_refunded' | 'voided';

export interface Bill {
  id: Id;
  outletId: Id;
  businessDate: IsoDate;
  tabId: Id | null;
  tabSeatId: Id | null;
  billNumber: number;
  scope: BillScope;
  splitGroupId: Id | null;
  subtotalCents: Cents;
  discountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  roundingCents: Cents;
  status: BillStatus;
  settledAt: EpochMs | null;
  settledBy: Id | null;
  deviceId: Id;
}

/** A tender is a record of what the cashier observed. Bliss never processes a payment. */
export type TenderKind = 'cash' | 'mpesa' | 'card' | 'account' | 'comp';

export interface Tender {
  id: Id;
  billId: Id;
  kind: TenderKind;
  amountCents: Cents;
  tenderedCents: Cents | null;
  changeCents: Cents | null;
  reference: string | null;
  createdBy: Id;
  deviceId: Id;
  createdAt: EpochMs;
}

/* ---------------------------------------------------------------- platform */

export type AuditSeverity = 'info' | 'notable' | 'sensitive';

export interface AuditEvent {
  id: Id;
  outletId: Id;
  occurredAt: EpochMs;
  actorStaffId: Id | null;
  actorDeviceId: Id | null;
  actorIp: string | null;
  action: string;
  entityType: string;
  entityId: Id;
  before: unknown;
  after: unknown;
  reason: string | null;
  severity: AuditSeverity;
}

export interface OutboxDeadLetter {
  id: Id;
  deviceId: Id;
  outboxEntryId: Id;
  kind: string;
  payload: unknown;
  rejectionCode: string;
  rejectionDetail: string;
  firstSeenAt: EpochMs;
  resolvedAt: EpochMs | null;
  resolvedBy: Id | null;
  resolutionNote: string | null;
}
