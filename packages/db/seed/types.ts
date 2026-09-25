import type {
  AuditEvent,
  Bill,
  Category,
  Device,
  Modifier,
  ModifierGroup,
  Order,
  OrderLine,
  OrderLineModifier,
  Outlet,
  OutboxDeadLetter,
  PriceList,
  PriceListItem,
  PriceRule,
  Product,
  ProductVariant,
  Role,
  ServiceTable,
  Shift,
  Staff,
  StockBatch,
  StockCount,
  StockHold,
  StockLocation,
  StockMovement,
  GoodsReceivedNote,
  Tab,
  TabSeat,
  Tender,
  VariantModifierGroup,
  Zone,
} from '@bliss/shared/domain';
import type { Cents } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import type { Recipe } from './catalogue';
import type { Supplier } from './organisation';

export interface BillLine {
  id: string;
  billId: string;
  orderLineId: string | null;
  productVariantId: string;
  description: string;
  seatNo: number | null;
  seatLabel: string | null;
  qty: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
}

export interface StockCountLine {
  id: string;
  stockCountId: string;
  productVariantId: string;
  /** Withheld from every response until the count reaches review. */
  expectedQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  varianceCents: Cents | null;
  reason: string | null;
  countedBy: string | null;
  countedAt: number | null;
  recountOf: string | null;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  outletId: string;
  supplierId: string;
  poNumber: number;
  status: PurchaseOrderStatus;
  expectedAt: number | null;
  subtotalCents: Cents;
  totalCents: Cents;
  raisedBy: string;
  raisedAt: number;
  approvedBy: string | null;
  approvedAt: number | null;
  notes: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  productVariantId: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostCents: Cents;
  lineTotalCents: Cents;
}

export interface GoodsReceipt {
  id: string;
  outletId: string;
  purchaseOrderId: string | null;
  supplierId: string;
  grnNumber: number;
  deliveryNoteRef: string;
  receivedAt: number;
  receivedBy: string;
  stockLocationId: string;
  status: 'draft' | 'posted' | 'cancelled';
  varianceNote: string | null;
}

export interface GoodsReceiptLine {
  id: string;
  goodsReceiptId: string;
  purchaseOrderLineId: string | null;
  productVariantId: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyRejected: number;
  rejectionReason: string | null;
  unitCostCents: Cents;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productVariantId: string;
  supplierSku: string;
  packSize: number;
  lastCostCents: Cents;
  lastPurchasedAt: number;
  history: { at: number; costCents: Cents }[];
}

/** Cash that moved in or out of a drawer other than a sale: the float and drops to the safe. docs/04. */
export interface CashMovement {
  id: string;
  drawerSessionId: string;
  kind: 'opening_float' | 'drop_to_safe' | 'payout' | 'adjustment';
  /** Signed: a drop is negative. */
  amountCents: Cents;
  reason: string | null;
  createdBy: string;
  deviceId: string;
  occurredAt: number;
}

/** One row changed, in the order it changed. The development change feed behind pull ?since. */
export interface ChangeRef {
  seq: number;
  table: SyncTable;
  id: string;
}

export type SyncTable = 'tabs' | 'seats' | 'orders' | 'lines' | 'lineModifiers' | 'bills' | 'billLines' | 'tenders' | 'drawerSessions';

export interface DrawerSession {
  id: string;
  outletId: string;
  businessDate: IsoDate;
  deviceId: string;
  openedBy: string;
  openedAt: number;
  openingFloatCents: Cents;
  closedBy: string | null;
  closedAt: number | null;
  countedCashCents: Cents | null;
  expectedCashCents: Cents | null;
  varianceCents: Cents | null;
  varianceReason: string | null;
  status: 'open' | 'counting' | 'closed';
}

export interface DevicePresence {
  deviceId: string;
  online: boolean;
  lastSeenAt: number;
  staffId: string | null;
  unsyncedCount: number;
  appVersion: string;
}

export interface PourSpec {
  productVariantId: string;
  nominalVolumeMl: number;
  tolerancePct: number;
}

export interface Dataset {
  generatedAt: number;
  now: number;
  /** The business date trading right now, or most recently. */
  currentBusinessDate: IsoDate;
  /** The most recent business date whose trading has finished. */
  lastNight: IsoDate;
  tradingInProgress: boolean;
  firstBusinessDate: IsoDate;

  outlet: Outlet;
  roles: Role[];
  staff: Staff[];
  devices: Device[];
  zones: Zone[];
  tables: ServiceTable[];
  locations: StockLocation[];
  suppliers: Supplier[];

  catalogueVersion: number;
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  variantModifierGroups: VariantModifierGroup[];
  priceLists: PriceList[];
  priceListItems: PriceListItem[];
  priceRules: PriceRule[];
  recipes: Recipe[];
  pourSpecs: PourSpec[];

  tabs: Tab[];
  seats: TabSeat[];
  orders: Order[];
  lines: OrderLine[];
  lineModifiers: OrderLineModifier[];
  bills: Bill[];
  billLines: BillLine[];
  tenders: Tender[];
  shifts: Shift[];
  drawerSessions: DrawerSession[];

  movements: StockMovement[];
  holds: StockHold[];
  counts: StockCount[];
  countLines: StockCountLine[];
  stockBatches: StockBatch[];
  goodsReceivedNotes: GoodsReceivedNote[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  receipts: GoodsReceipt[];
  receiptLines: GoodsReceiptLine[];
  supplierProducts: SupplierProduct[];

  auditEvents: AuditEvent[];
  deadLetters: OutboxDeadLetter[];
  presence: DevicePresence[];
  availabilityVersion: number;

  /** Changes a fresh dataset makes the devices discard their local trade copy. docs/14 section 4. */
  epoch: string;
  cashMovements: CashMovement[];
  changeSeq: number;
  changes: ChangeRef[];
  /** Outbox entry ids already applied, so a retried entry is acknowledged without a second effect. */
  applied: Set<string>;
}
