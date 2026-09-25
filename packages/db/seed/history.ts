import type {
  AuditEvent,
  Bill,
  OrderLine,
  OrderLineModifier,
  Order,
  Shift,
  StockCount,
  StockHold,
  StockMovement,
  Tab,
  TabSeat,
  Tender,
  TenderKind,
} from '@bliss/shared/domain';
import {
  type Cents,
  ZERO,
  add,
  allocate,
  isPositive,
  multiplyByQty,
  multiplyByQuantity,
  roundToShilling,
  roundUpTo,
  scale,
  shillings,
  subtract,
  sum,
  weightedAverage,
} from '@bliss/shared/money';
import { createPricingIndex, resolvePrice } from '@bliss/shared/pricing';
import { seatColourIndex } from '@bliss/shared/seats';
import { type IsoDate, addDays, businessDate, weekdayOf, zonedInstant, zonedParts } from '@bliss/shared/time';
import {
  ALL_PRODUCTS,
  ALL_VARIANTS,
  CATALOGUE_VERSION,
  CATEGORIES,
  MODIFIERS,
  MODIFIER_GROUPS,
  PRICE_LISTS,
  PRICE_LIST_ITEMS,
  PRICE_RULES,
  PRODUCT_SPECS,
  RECIPES,
  RECIPE_VARIANT,
  STOCK_VARIANT,
  UNIT_COST,
  VARIANTS,
  VARIANT_MODIFIER_GROUPS,
  productIdFor,
  variantIdFor,
} from './catalogue';
import { hashSeed, prng, seedId } from './ids';
import { DEVICES, LOCATIONS, OUTLET, ROLES, STAFF, SUPPLIERS, TABLES, WAITERS, ZONES, deviceByKey, staffByKey, supplierByKey } from './organisation';
import type {
  BillLine,
  Dataset,
  DevicePresence,
  DrawerSession,
  GoodsReceipt,
  GoodsReceiptLine,
  PourSpec,
  PurchaseOrder,
  PurchaseOrderLine,
  StockCountLine,
  SupplierProduct,
} from './types';

/**
 * Eight weeks of deterministic trading for Cool Bliss Spot, generated through the real domain logic:
 * prices come from resolvePrice at fire time, splits from allocate, stock from an append-only
 * movement ledger with the full depletion cascade, and count variance from a physical shelf that
 * drifts from the ledger the way an over-pouring bar does.
 *
 * `pnpm db:seed` writes it to Postgres, which is the outlet's store from then on (docs/17); the tests
 * build it in memory.
 */

const TZ = OUTLET.timezone;
const HOUR = 3_600_000;
const MIN = 60_000;

const STORE = LOCATIONS[0]!.id;
const BAR = LOCATIONS[1]!.id;

type Rand = () => number;

function pick<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length]!;
}

function weighted<T>(rand: Rand, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const v = variantIdFor;

const BEER_WEIGHTS: [string, number][] = [
  [v('tusker', 'bottle'), 30],
  [v('tusker-lite', 'bottle'), 16],
  [v('white-cap', 'bottle'), 12],
  [v('balozi', 'bottle'), 10],
  [v('guinness', 'bottle'), 12],
  [v('heineken', 'bottle'), 6],
  [v('pilsner', 'bottle'), 8],
  [v('summit', 'bottle'), 5],
];
const SPIRIT_WEIGHTS: [string, number][] = [
  [v('gilbeys', 'tot'), 14],
  [v('gilbeys', 'double'), 6],
  [v('smirnoff', 'tot'), 7],
  [RECIPE_VARIANT.id, 10],
  [v('kenya-cane', 'tot'), 12],
  [v('captain-morgan', 'tot'), 6],
  [v('jameson', 'tot'), 5],
  [v('hunters', 'tot'), 5],
  [v('gilbeys', 'bottle'), 0.6],
  [v('jameson', 'bottle'), 0.3],
];
const WINE_WEIGHTS: [string, number][] = [
  [v('four-cousins', 'glass'), 6],
  [v('four-cousins', 'bottle'), 1.5],
  [v('nederburg', 'glass'), 3],
  [v('drostdy-hof', 'bottle'), 2],
];
const SOFT_WEIGHTS: [string, number][] = [
  [v('coke', 'unit'), 12],
  [v('fanta', 'unit'), 5],
  [v('sprite', 'unit'), 5],
  [v('dasani', 'unit'), 8],
  [v('tonic', 'unit'), 3],
  [v('red-bull', 'unit'), 4],
];
const FOOD_WEIGHTS: [string, number][] = [
  [v('nyama-choma', 'plate'), 6],
  [v('mishkaki', 'plate'), 4],
  [v('kachumbari', 'plate'), 5],
  [v('tilapia', 'plate'), 2],
];

/** How much more a bar pours than it sells, per product. The source of count variance. */
const OVERPOUR: Record<string, number> = {
  [productIdFor('gilbeys')]: 0.07,
  [productIdFor('kenya-cane')]: 0.045,
  [productIdFor('smirnoff')]: 0.03,
  [productIdFor('captain-morgan')]: 0.02,
  [productIdFor('jameson')]: 0.012,
  [productIdFor('hunters')]: 0.025,
  [productIdFor('four-cousins')]: 0.03,
  [productIdFor('nederburg')]: 0.015,
  [productIdFor('tusker')]: 0.006,
};

const SEAT_LABELS = ['Kofi', 'Mercy', 'Birthday', 'Boss', 'Cap', 'Njeri', 'Wambui', 'Juma', 'Leah', 'Sam', 'Otis', 'Mzee'];
const VOID_REASONS = [
  'Wrong item, the guest wanted a Tusker Lite',
  'Customer changed mind before it was poured',
  'Poured twice by mistake at the bar',
  'Guest left before the round arrived',
];

const productOf = new Map(ALL_VARIANTS.map((variant) => [variant.id, ALL_PRODUCTS.find((p) => p.id === variant.productId)!]));
const variantById = new Map(ALL_VARIANTS.map((variant) => [variant.id, variant]));
const specByProductId = new Map(PRODUCT_SPECS.map((s) => [productIdFor(s.key), s]));

const TRACKED_STOCK_VARIANTS = VARIANTS.filter((variant) => {
  const product = productOf.get(variant.id)!;
  const cat = CATEGORIES.find((c) => c.id === product.categoryId)!;
  return cat.trackStock && variant.kind === 'sealed';
}).map((variant) => variant.id);

/**
 * Supply gaps, in days before today, during which a product is not reordered. Real bars have these
 * weeks: the distributor is out of Jameson, the Guinness standing order lapsed, a Gilbeys order is
 * late. They are what make finished, last few and low appear on the floor honestly, from the ledger.
 */
const SUPPLY_GAP_DAYS: Record<string, number> = {
  [productIdFor('jameson')]: 56,
  [productIdFor('guinness')]: 9,
  [productIdFor('gilbeys')]: 4,
};

/** Smaller opening stock for the products in a supply gap. */
const OPENING_STORE: Record<string, number> = {
  [productIdFor('jameson')]: 1,
  [productIdFor('guinness')]: 60,
};

/** Par levels on the bar shelf, in stock units. */
function barPar(stockVariantId: string): number {
  const product = productOf.get(stockVariantId)!;
  const cat = product.categoryId;
  if (product.id === productIdFor('guinness')) return 48;
  if (cat === seedId('category:beer')) return 96;
  if (cat === seedId('category:soft')) return 36;
  if (cat === seedId('category:wine')) return 4;
  return 3;
}

function mpesaReference(rand: Rand): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = pick(rand, ['S', 'T', 'U']);
  for (let i = 0; i < 9; i += 1) out += chars[Math.floor(rand() * chars.length)];
  return out;
}

function roundQty(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function tradingClock(now: number) {
  const current = businessDate(now, TZ, OUTLET.businessDayCutover);
  const hour = zonedParts(now, TZ).hour;
  const inProgress = hour >= 16 || hour < 2;
  const finishedToday = hour >= 2 && hour < 5;
  const lastNight = finishedToday ? current : addDays(current, -1);
  return { current, lastNight, inProgress };
}

export function buildDataset(now: number = Date.now(), days = 56): Dataset {
  const clock = tradingClock(now);
  const firstDate = addDays(clock.current, -(days - 1));
  const pricing = createPricingIndex({
    products: ALL_PRODUCTS,
    variants: ALL_VARIANTS,
    priceLists: PRICE_LISTS,
    priceListItems: PRICE_LIST_ITEMS,
    priceRules: PRICE_RULES,
  });

  const tabs: Tab[] = [];
  const seats: TabSeat[] = [];
  const orders: Order[] = [];
  const lines: OrderLine[] = [];
  const lineModifiers: OrderLineModifier[] = [];
  const bills: Bill[] = [];
  const billLines: BillLine[] = [];
  const tenders: Tender[] = [];
  const shifts: Shift[] = [];
  const drawerSessions: DrawerSession[] = [];
  const movements: StockMovement[] = [];
  const holds: StockHold[] = [];
  const counts: StockCount[] = [];
  const countLines: StockCountLine[] = [];
  const purchaseOrders: PurchaseOrder[] = [];
  const purchaseOrderLines: PurchaseOrderLine[] = [];
  const receipts: GoodsReceipt[] = [];
  const receiptLines: GoodsReceiptLine[] = [];
  const auditEvents: AuditEvent[] = [];

  // Ledger and the physical shelf, per stock variant and location.
  const ledger = new Map<string, number>();
  const physical = new Map<string, number>();
  const avgCost = new Map<string, Cents>();
  const key = (variantId: string, locationId: string) => `${variantId}|${locationId}`;
  const get = (m: Map<string, number>, variantId: string, locationId: string) => m.get(key(variantId, locationId)) ?? 0;
  const bump = (m: Map<string, number>, variantId: string, locationId: string, delta: number) =>
    m.set(key(variantId, locationId), roundQty(get(m, variantId, locationId) + delta));

  let movementSeq = 0;
  let billNumber = 18_400;
  let poNumber = 310;
  let grnNumber = 290;

  const supplierProducts = new Map<string, SupplierProduct>();

  function move(input: {
    variantId: string;
    locationId: string;
    qty: number;
    type: StockMovement['movementType'];
    at: number;
    date: IsoDate;
    sourceType: string;
    sourceId: string | null;
    reason?: string | null;
    by: string;
    physicalQty?: number;
    deviceId?: string | null;
  }) {
    movementSeq += 1;
    const variant = variantById.get(input.variantId)!;
    const product = productOf.get(input.variantId)!;
    movements.push({
      id: seedId(`movement:${movementSeq}`),
      outletId: OUTLET.id,
      businessDate: input.date,
      productVariantId: input.variantId,
      stockLocationId: input.locationId,
      stockBatchId: null,
      qtyDelta: roundQty(input.qty),
      volumeDeltaMl: product.containerVolumeMl && variant.kind === 'sealed' ? Math.round(input.qty * product.containerVolumeMl) : null,
      unitCostCents: avgCost.get(input.variantId) ?? UNIT_COST.get(input.variantId) ?? ZERO,
      movementType: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason ?? null,
      occurredAt: input.at,
      createdBy: input.by,
      deviceId: input.deviceId ?? null,
    });
    bump(ledger, input.variantId, input.locationId, input.qty);
    bump(physical, input.variantId, input.locationId, input.physicalQty ?? input.qty);
    // A shelf cannot hold less than nothing. What the ledger thinks is there, and is not, is variance.
    if (get(physical, input.variantId, input.locationId) < 0) physical.set(key(input.variantId, input.locationId), 0);
  }

  const dayStart = (date: IsoDate) => zonedInstant(date, 0, TZ);
  const dan = staffByKey('dan').id;
  const grace = staffByKey('grace').id;
  const kevin = staffByKey('kevin').id;
  const counter = deviceByKey('counter-1').id;

  // Opening balances.
  for (const stockId of TRACKED_STOCK_VARIANTS) {
    const product = productOf.get(stockId)!;
    const cost = UNIT_COST.get(stockId) ?? ZERO;
    avgCost.set(stockId, cost);
    const at = dayStart(firstDate) + 9 * HOUR;
    move({ variantId: stockId, locationId: STORE, qty: OPENING_STORE[product.id] ?? product.reorderQty * 1.5, type: 'opening_balance', at, date: firstDate, sourceType: 'opening', sourceId: null, by: dan });
    move({ variantId: stockId, locationId: BAR, qty: barPar(stockId), type: 'opening_balance', at, date: firstDate, sourceType: 'opening', sourceId: null, by: dan });
  }

  const pendingPos: { po: PurchaseOrder; lines: PurchaseOrderLine[]; expected: IsoDate }[] = [];
  const onOrder = new Set<string>();

  const dates: IsoDate[] = [];
  for (let d = firstDate; d <= clock.current; d = addDays(d, 1)) dates.push(d);

  // A Tusker case price rise three weeks ago, the supplier alert docs/04 describes.
  const priceRiseDate = addDays(clock.current, -21);

  for (const date of dates) {
    const rand = prng(hashSeed(`bliss:${date}`));
    const start = dayStart(date);
    const weekday = weekdayOf(date);
    // The trading day in play is tonight while trading, otherwise last night. A calendar day whose
    // evening has not started yet gets its morning (deliveries, counts, transfers) and nothing else.
    const tradingDate = clock.inProgress ? clock.current : clock.lastNight;
    const isToday = date === tradingDate;
    const beforeTrading = date > tradingDate;
    const daysAgo = dates.length - 1 - dates.indexOf(date);

    // 09:00 deliveries due today, then reorder anything below its reorder point.
    for (const pending of [...pendingPos]) {
      if (pending.expected !== date) continue;
      pendingPos.splice(pendingPos.indexOf(pending), 1);
      grnNumber += 1;
      const receiptId = seedId(`grn:${grnNumber}`);
      const at = start + 11 * HOUR + Math.floor(rand() * 40) * MIN;
      const short = rand() < 0.12;
      receipts.push({
        id: receiptId,
        outletId: OUTLET.id,
        purchaseOrderId: pending.po.id,
        supplierId: pending.po.supplierId,
        grnNumber,
        deliveryNoteRef: `DN-${Math.floor(10000 + rand() * 89999)}`,
        receivedAt: at,
        receivedBy: dan,
        stockLocationId: STORE,
        status: 'posted',
        varianceNote: short ? 'One case short on the delivery note, supplier to credit' : null,
      });
      let anyShort = false;
      pending.lines.forEach((line, i) => {
        const rejected = short && i === 0 ? Math.min(line.qtyOrdered, 12) : 0;
        const received = line.qtyOrdered - rejected;
        anyShort = anyShort || rejected > 0;
        line.qtyReceived = received;
        receiptLines.push({
          id: seedId(`grnline:${grnNumber}:${i}`),
          goodsReceiptId: receiptId,
          purchaseOrderLineId: line.id,
          productVariantId: line.productVariantId,
          qtyExpected: line.qtyOrdered,
          qtyReceived: received,
          qtyRejected: rejected,
          rejectionReason: rejected > 0 ? 'Case short on delivery, noted on the delivery note' : null,
          unitCostCents: line.unitCostCents,
        });
        // Moving average cost, stored per movement so historic cost of goods never moves.
        const onHand = Math.max(0, get(ledger, line.productVariantId, STORE) + get(ledger, line.productVariantId, BAR));
        const previous = avgCost.get(line.productVariantId) ?? line.unitCostCents;
        const blended = weightedAverage([
          [previous, onHand],
          [line.unitCostCents, received],
        ]);
        avgCost.set(line.productVariantId, blended);
        move({ variantId: line.productVariantId, locationId: STORE, qty: received, type: 'receipt', at, date, sourceType: 'goods_receipt', sourceId: receiptId, by: dan });
        onOrder.delete(line.productVariantId);
        const sp = supplierProducts.get(line.productVariantId);
        if (sp) {
          sp.lastCostCents = line.unitCostCents;
          sp.lastPurchasedAt = at;
          sp.history.push({ at, costCents: line.unitCostCents });
        }
      });
      pending.po.status = anyShort ? 'partially_received' : 'received';
    }

    if (!isToday) {
      const bySupplier = new Map<string, string[]>();
      for (const stockId of TRACKED_STOCK_VARIANTS) {
        if (onOrder.has(stockId)) continue;
        const product = productOf.get(stockId)!;
        if (daysAgo < (SUPPLY_GAP_DAYS[product.id] ?? 0)) continue;
        const total = get(ledger, stockId, STORE) + get(ledger, stockId, BAR);
        if (total > product.reorderPoint) continue;
        const supplierId = product.defaultSupplierId;
        if (!supplierId) continue;
        const list = bySupplier.get(supplierId) ?? [];
        list.push(stockId);
        bySupplier.set(supplierId, list);
      }
      for (const [supplierId, stockIds] of bySupplier) {
        poNumber += 1;
        const poId = seedId(`po:${poNumber}`);
        const supplier = SUPPLIERS.find((s) => s.id === supplierId)!;
        const raisedAt = start + 9 * HOUR + Math.floor(rand() * 30) * MIN;
        const poLines: PurchaseOrderLine[] = stockIds.map((stockId, i) => {
          const product = productOf.get(stockId)!;
          let cost = UNIT_COST.get(stockId) ?? ZERO;
          if (stockId === v('tusker', 'bottle') && date >= priceRiseDate) cost = scale(cost, 106n, 100n);
          const qty = product.reorderQty;
          const line: PurchaseOrderLine = {
            id: seedId(`poline:${poNumber}:${i}`),
            purchaseOrderId: poId,
            productVariantId: stockId,
            qtyOrdered: qty,
            qtyReceived: 0,
            unitCostCents: cost,
            lineTotalCents: multiplyByQty(cost, qty),
          };
          onOrder.add(stockId);
          if (!supplierProducts.has(stockId)) {
            supplierProducts.set(stockId, {
              id: seedId(`supplierproduct:${stockId}`),
              supplierId,
              productVariantId: stockId,
              supplierSku: `${product.sku}-C`,
              packSize: product.categoryId === seedId('category:beer') || product.categoryId === seedId('category:soft') ? 24 : 6,
              lastCostCents: cost,
              lastPurchasedAt: raisedAt,
              history: [],
            });
          }
          return line;
        });
        purchaseOrderLines.push(...poLines);
        const subtotal = sum(poLines.map((l) => l.lineTotalCents));
        const po: PurchaseOrder = {
          id: poId,
          outletId: OUTLET.id,
          supplierId,
          poNumber,
          status: 'sent',
          expectedAt: dayStart(addDays(date, supplier.leadTimeDays)) + 11 * HOUR,
          subtotalCents: subtotal,
          totalCents: subtotal,
          raisedBy: dan,
          raisedAt,
          approvedBy: staffByKey('dan').id,
          approvedAt: raisedAt + 25 * MIN,
          notes: null,
        };
        purchaseOrders.push(po);
        pendingPos.push({ po, lines: poLines, expected: addDays(date, supplier.leadTimeDays) });
      }
    }

    // 15:00 transfer from the store to bring the bar shelf up to par.
    for (const stockId of TRACKED_STOCK_VARIANTS) {
      const need = barPar(stockId) - get(ledger, stockId, BAR);
      const available = get(ledger, stockId, STORE);
      const qty = Math.floor(Math.min(need, available));
      if (qty <= 0) continue;
      const at = start + 15 * HOUR + Math.floor(rand() * 20) * MIN;
      const transferId = seedId(`transfer:${date}:${stockId}`);
      move({ variantId: stockId, locationId: STORE, qty: -qty, type: 'transfer_out', at, date, sourceType: 'transfer', sourceId: transferId, by: dan });
      move({ variantId: stockId, locationId: BAR, qty, type: 'transfer_in', at, date, sourceType: 'transfer', sourceId: transferId, by: dan });
    }

    // Sunday blind count of the bar shelf at 15:40, once the shelf is stocked for the night.
    if (weekday === 7 && !isToday) {
      const countId = seedId(`count:${date}:bar`);
      const at = start + 15 * HOUR + 40 * MIN;
      let totalVariance = ZERO;
      TRACKED_STOCK_VARIANTS.forEach((stockId, i) => {
        const expected = get(ledger, stockId, BAR);
        const actualRaw = get(physical, stockId, BAR);
        const product = productOf.get(stockId)!;
        const sealedOnly = !VARIANTS.some((x) => x.productId === product.id && x.kind === 'serve');
        const counted = sealedOnly ? Math.round(actualRaw) : Math.round(actualRaw * 10) / 10;
        const varianceQty = roundQty(counted - expected);
        const cost = avgCost.get(stockId) ?? ZERO;
        const varianceCents = multiplyByQuantity(cost, varianceQty);
        totalVariance = add(totalVariance, varianceCents);
        const spec = specByProductId.get(product.id);
        const tolerance = spec?.category === 'spirits' ? 0.02 : 0.01;
        const theoreticalBase = Math.max(1, expected);
        const outside = Math.abs(varianceQty) / theoreticalBase > tolerance && Math.abs(varianceQty) >= 0.1;
        const reason = varianceQty === 0 ? null : outside ? pick(rand, ['Over pouring on a busy night, spoke to the bar team', 'Breakage not recorded during service', 'Miscount, recounted and confirmed']) : 'Within tolerance, adjusted to count';
        countLines.push({
          id: seedId(`countline:${date}:${i}`),
          stockCountId: countId,
          productVariantId: stockId,
          expectedQty: expected,
          countedQty: counted,
          varianceQty,
          varianceCents,
          reason,
          countedBy: dan,
          countedAt: at + i * MIN,
          recountOf: null,
        });
        if (varianceQty !== 0) {
          move({ variantId: stockId, locationId: BAR, qty: varianceQty, type: 'count_adjustment', at: at + 50 * MIN, date, sourceType: 'stock_count', sourceId: countId, reason, by: dan, physicalQty: 0 });
          physical.set(key(stockId, BAR), counted);
        }
      });
      counts.push({
        id: countId,
        outletId: OUTLET.id,
        businessDate: date,
        stockLocationId: BAR,
        kind: 'full',
        isBlind: true,
        status: 'committed',
        openedBy: dan,
        openedAt: at,
        committedBy: dan,
        committedAt: at + 50 * MIN,
        totalVarianceCents: totalVariance,
        notes: null,
      });
      auditEvents.push(audit('count.committed', 'stock_count', countId, at + 50 * MIN, dan, null, { totalVarianceCents: totalVariance.toString() }, 'Weekly full count of the bar shelf', 'notable'));
    }

    // Occasional breakage, recorded properly.
    if (rand() < 0.25 && !isToday) {
      const stockId = pick(rand, [v('tusker', 'bottle'), v('white-cap', 'bottle'), v('coke', 'unit'), v('guinness', 'bottle')]);
      const at = start + 20 * HOUR + Math.floor(rand() * 120) * MIN;
      const writeOffId = seedId(`writeoff:${date}`);
      const reason = 'Bottle dropped behind the bar during service';
      move({ variantId: stockId, locationId: BAR, qty: -1, type: 'write_off_breakage', at, date, sourceType: 'write_off', sourceId: writeOffId, reason, by: kevin });
      auditEvents.push(audit('stock.written_off', 'stock_movement', writeOffId, at, kevin, null, { variantId: stockId, qty: -1 }, reason, 'notable'));
    }

    if (beforeTrading) continue;

    // Trading.
    const baseTabs = [0, 22, 24, 28, 34, 48, 52, 30][weekday] ?? 28;
    const tabCount = Math.round(baseTabs * (0.85 + rand() * 0.3));
    const onShift = WAITERS;
    const drawerId = seedId(`drawer:${date}`);
    const openAt = start + 15 * HOUR + 30 * MIN;
    const shiftTotals = new Map<string, { sales: Cents; voids: Cents; tabs: number }>();
    let cashTaken = ZERO;
    let tabNumber = 0;

    for (let t = 0; t < tabCount; t += 1) {
      const hourWeights: [number, number][] = [
        [16, 2],
        [17, 5],
        [18, 7],
        [19, 9],
        [20, 11],
        [21, 10],
        [22, 8],
        [23, 5],
        [24, 2],
      ];
      const hour = weighted(rand, hourWeights);
      const openedAt = start + hour * HOUR + Math.floor(rand() * 60) * MIN;
      if (clock.inProgress && isToday && openedAt > now) continue;

      tabNumber += 1;
      const tabId = seedId(`tab:${date}:${tabNumber}`);
      const walkUp = rand() < 0.08;
      const tableRow = walkUp ? null : pick(rand, TABLES.filter((x) => !x.label.startsWith('S')));
      const zoneId = tableRow?.zoneId ?? seedId('zone:stools');
      const guestCount = weighted(rand, [
        [1, 15],
        [2, 33],
        [3, 20],
        [4, 22],
        [5, 6],
        [6, 4],
      ] as [number, number][]);
      const waiter = pick(rand, onShift);
      const waiterDevice = deviceByKey(waiter.id === WAITERS[0]!.id ? 'floor-1' : 'floor-3').id;
      const totals = shiftTotals.get(waiter.id) ?? { sales: ZERO, voids: ZERO, tabs: 0 };
      totals.tabs += 1;
      shiftTotals.set(waiter.id, totals);

      const tabSeats: TabSeat[] = Array.from({ length: guestCount }, (_, i) => ({
        id: seedId(`seat:${tabId}:${i + 1}`),
        outletId: OUTLET.id,
        tabId,
        seatNo: i + 1,
        label: guestCount > 1 && rand() < 0.18 ? pick(rand, SEAT_LABELS) : null,
        colourIndex: seatColourIndex(i + 1),
        status: 'active',
        settledBillId: null,
        settledAt: null,
        createdBy: waiter.id,
        createdAt: openedAt,
      }));
      seats.push(...tabSeats);

      const tab: Tab = {
        id: tabId,
        outletId: OUTLET.id,
        businessDate: date,
        serviceTableId: tableRow?.id ?? null,
        zoneId,
        tabNumber,
        name: walkUp ? pick(rand, ['Walk up', 'Bar stool', 'Takeaway']) : null,
        guestCount,
        openedBy: waiter.id,
        openedAt,
        assignedTo: waiter.id,
        status: 'open',
        mergedIntoTabId: null,
        closedAt: null,
      };
      tabs.push(tab);

      const rounds = Math.max(1, Math.min(4, Math.round(1 + rand() * 3)));
      const tabLines: OrderLine[] = [];
      let lastFire = openedAt;
      for (let r = 0; r < rounds; r += 1) {
        const firedAt = openedAt + 2 * MIN + r * (20 + Math.floor(rand() * 30)) * MIN;
        if (clock.inProgress && isToday && firedAt > now) break;
        lastFire = firedAt;
        const orderId = seedId(`order:${tabId}:${r + 1}`);
        orders.push({
          id: orderId,
          outletId: OUTLET.id,
          tabId,
          businessDate: date,
          orderNumber: r + 1,
          firedAt,
          firedBy: waiter.id,
          deviceId: waiterDevice,
          status: 'served',
          clientCreatedAt: firedAt - 40_000,
          serverReceivedAt: firedAt + 600,
          note: null,
        });

        const targets: (TabSeat | null)[] = [...tabSeats.filter(() => rand() < (r === 0 ? 0.95 : 0.7))];
        if (rand() < (r === 0 ? 0.25 : 0.12)) targets.push(null);
        for (const seat of targets) {
          const shared = seat === null;
          const cat = shared ? weighted(rand, [['food', 6], ['wine', 1], ['spirits', 1]] as [string, number][]) : weighted(rand, [['beer', 50], ['spirits', 26], ['wine', 6], ['soft', 13], ['food', 3]] as [string, number][]);
          const table = cat === 'beer' ? BEER_WEIGHTS : cat === 'spirits' ? SPIRIT_WEIGHTS : cat === 'wine' ? WINE_WEIGHTS : cat === 'soft' ? SOFT_WEIGHTS : FOOD_WEIGHTS;
          let variantId = weighted(rand, table);
          if (variantId === v('hunters', 'tot') && daysAgo <= 2) variantId = v('kenya-cane', 'tot');
          let qty = cat === 'beer' && rand() < 0.22 ? 2 : 1;
          const withMixer = variantById.get(variantId)?.kind === 'serve' && cat === 'spirits' && variantId !== RECIPE_VARIANT.id && rand() < 0.45;
          let mixer = withMixer ? pick(rand, MODIFIERS.filter((m) => m.modifierGroupId === seedId('modgroup:mixer') && m.linkedVariantId)) : null;

          // Depletion cascade: the serve or sealed unit, recipe components, then linked mixers.
          const plan = (id: string, q: number, mix: typeof mixer): [string, number][] => {
            const out: [string, number][] = [];
            const recipe = RECIPES.find((x) => x.productVariantId === id);
            const stock = STOCK_VARIANT.get(id);
            if (recipe) for (const c of recipe.components) out.push([c.componentVariantId, c.qty * q]);
            else if (stock && TRACKED_STOCK_VARIANTS.includes(stock.stockVariantId)) out.push([stock.stockVariantId, stock.factor * q]);
            if (mix?.linkedVariantId) out.push([mix.linkedVariantId, q]);
            return out;
          };
          // The bar cannot pour what is not there: the guest picks something else in the same
          // category that is on the shelf, or goes without.
          const fits = (deps: [string, number][]) => deps.every(([s, amount]) => get(ledger, s, BAR) - amount >= -1e-9);
          let depletions = plan(variantId, qty, mixer);
          if (!fits(depletions)) {
            const alternative = table.map(([id]) => id).find((id) => fits(plan(id, 1, null)));
            if (!alternative) continue;
            variantId = alternative;
            qty = 1;
            mixer = null;
            depletions = plan(variantId, qty, mixer);
          }
          const resolved = resolvePrice(pricing, {
            variantId,
            qty,
            at: firedAt,
            timeZone: TZ,
            modifiers: mixer ? [{ name: mixer.name, priceDeltaCents: mixer.priceDeltaCents, qty: 1 }] : [],
          });
          const lineId = seedId(`line:${orderId}:${tabLines.length}`);
          const pending = clock.inProgress && isToday && firedAt > now - 6 * MIN;
          const voided = !pending && rand() < 0.015;
          const line: OrderLine = {
            id: lineId,
            outletId: OUTLET.id,
            orderId,
            tabId,
            tabSeatId: seat?.id ?? null,
            productVariantId: variantId,
            qty,
            unitPriceCents: resolved.unitPriceCents,
            lineTotalCents: resolved.lineTotalCents,
            priceDerivation: resolved.derivation,
            note: rand() < 0.06 ? pick(rand, ['No ice', 'Cold one', 'Warm', 'Bring with the food']) : null,
            status: voided ? 'voided' : pending ? 'pending' : 'served',
            stockConflict: false,
            servedAt: pending ? null : firedAt + (2 + Math.floor(rand() * 5)) * MIN,
            servedBy: pending ? null : kevin,
            voidedBy: voided ? waiter.id : null,
            voidedAt: voided ? firedAt + 3 * MIN : null,
            voidReason: voided ? pick(rand, VOID_REASONS) : null,
            createdBy: waiter.id,
            deviceId: waiterDevice,
            clientCreatedAt: firedAt - 20_000,
          };
          lines.push(line);
          tabLines.push(line);
          if (mixer) {
            lineModifiers.push({
              id: seedId(`linemod:${lineId}`),
              orderLineId: lineId,
              modifierId: mixer.id,
              name: mixer.name,
              qty: 1,
              priceDeltaCents: mixer.priceDeltaCents,
              linkedVariantId: mixer.linkedVariantId,
            });
          }

          if (voided) {
            totals.voids = add(totals.voids, line.lineTotalCents);
            auditEvents.push(audit('line.voided', 'order_line', lineId, line.voidedAt!, waiter.id, { status: 'pending' }, { status: 'voided' }, line.voidReason, 'sensitive'));
            continue;
          }
          totals.sales = add(totals.sales, line.lineTotalCents);

          for (const [stockId, amount] of depletions) {
            const product = productOf.get(stockId)!;
            const over = OVERPOUR[product.id] ?? 0;
            move({
              variantId: stockId,
              locationId: BAR,
              qty: -amount,
              physicalQty: -(amount * (1 + over * (0.6 + rand() * 0.8))),
              type: 'sale',
              at: firedAt,
              date,
              sourceType: 'order_line',
              sourceId: lineId,
              by: waiter.id,
            });
          }
        }
      }

      // A round reaches the table two minutes after its last pour. Tonight's last half hour stays in the
      // waiter's hands, so the Floor opens on tables at every stage. No rand() here: drawing from
      // it would shift the rest of the night.
      for (let i = orders.length - 1; i >= 0 && orders[i]!.tabId === tabId; i -= 1) {
        const order = orders[i]!;
        const own = tabLines.filter((l) => l.orderId === order.id && l.status !== 'voided');
        if (own.length === 0 || own.some((l) => l.servedAt === null)) continue;
        const at = Math.max(...own.map((l) => l.servedAt ?? 0)) + 2 * MIN;
        if (clock.inProgress && isToday && at > now - 25 * MIN) continue;
        order.deliveredAt = at;
        order.deliveredBy = waiter.id;
      }

      // Settlement: the tab closes 20 to 50 minutes after its last round, unless it is still open.
      const liveLines = tabLines.filter((l) => l.status !== 'voided');
      const closeAt = lastFire + (20 + Math.floor(rand() * 30)) * MIN;
      // Outside trading hours the last few tabs of the night stay open, so a review of the Floor and the
      // Console always has live tabs to work with. During trading, a tab is open until it closes.
      const staysOpen = isToday && (clock.inProgress ? closeAt > now : t >= tabCount - 6);
      if (staysOpen || liveLines.length === 0) {
        if (liveLines.length === 0 && !staysOpen) tab.status = 'voided';
        continue;
      }

      const usedSeats = tabSeats.filter((s) => liveLines.some((l) => l.tabSeatId === s.id));
      const scope: Bill['scope'] =
        guestCount === 1 || usedSeats.length <= 1 ? 'tab' : weighted(rand, [['tab', 55], ['seat', 30], ['even_split', 15]] as [Bill['scope'], number][]);
      const settledBy = rand() < 0.6 ? grace : kevin;

      const settle = (billScope: Bill['scope'], billLinesFor: OrderLine[], amount: Cents, at: number, seat: TabSeat | null, splitGroupId: string | null) => {
        billNumber += 1;
        const billId = seedId(`bill:${billNumber}`);
        const { rounded, rounding } = roundToShilling(amount);
        bills.push({
          id: billId,
          outletId: OUTLET.id,
          businessDate: date,
          tabId,
          tabSeatId: seat?.id ?? null,
          billNumber,
          scope: billScope,
          splitGroupId,
          subtotalCents: amount,
          discountCents: ZERO,
          taxCents: ZERO,
          totalCents: amount,
          roundingCents: rounding,
          status: 'settled',
          settledAt: at,
          settledBy,
          deviceId: counter,
        });
        for (const l of billLinesFor) {
          const s = tabSeats.find((x) => x.id === l.tabSeatId) ?? null;
          billLines.push({
            id: seedId(`billline:${billId}:${l.id}`),
            billId,
            orderLineId: l.id,
            productVariantId: l.productVariantId,
            description: variantById.get(l.productVariantId)!.name,
            seatNo: s?.seatNo ?? null,
            seatLabel: s?.label ?? null,
            qty: l.qty,
            unitPriceCents: l.unitPriceCents,
            lineTotalCents: l.lineTotalCents,
          });
        }
        const kind = weighted(rand, [['mpesa', 50], ['cash', 40], ['card', 10]] as [TenderKind, number][]);
        const splitTender = isPositive(rounded) && rand() < 0.08;
        const parts: [TenderKind, Cents][] = splitTender ? [['cash', scale(rounded, 1n, 2n)], ['mpesa', subtract(rounded, scale(rounded, 1n, 2n))]] : [[kind, rounded]];
        parts.forEach(([k, value], i) => {
          const tendered = k === 'cash' ? roundUpTo(value, shillings(500)) : null;
          tenders.push({
            id: seedId(`tender:${billId}:${i}`),
            billId,
            kind: k,
            amountCents: value,
            tenderedCents: tendered,
            changeCents: tendered ? subtract(tendered, value) : null,
            reference: k === 'mpesa' ? mpesaReference(rand) : k === 'card' ? String(Math.floor(100000 + rand() * 899999)) : null,
            createdBy: settledBy,
            deviceId: counter,
            createdAt: at,
          });
          if (k === 'cash') cashTaken = add(cashTaken, value);
        });
        return billId;
      };

      const total = sum(liveLines.map((l) => l.lineTotalCents));
      if (scope === 'tab') {
        settle('tab', liveLines, total, closeAt, null, null);
      } else if (scope === 'seat') {
        usedSeats.forEach((seat, i) => {
          const seatLines = liveLines.filter((l) => l.tabSeatId === seat.id);
          const at = closeAt - (usedSeats.length - i) * 4 * MIN;
          const billId = settle('seat', seatLines, sum(seatLines.map((l) => l.lineTotalCents)), at, seat, null);
          seat.status = 'settled';
          seat.settledBillId = billId;
          seat.settledAt = at;
        });
        const shared = liveLines.filter((l) => l.tabSeatId === null);
        if (shared.length > 0) settle('tab', shared, sum(shared.map((l) => l.lineTotalCents)), closeAt, null, null);
      } else {
        const groupId = seedId(`split:${tabId}`);
        const shares = allocate(total, usedSeats.length);
        usedSeats.forEach((seat, i) => settle('even_split', i === 0 ? liveLines : [], shares[i]!, closeAt, seat, groupId));
      }
      tab.status = 'settled';
      tab.closedAt = closeAt;
    }

    // Shifts and the drawer, for business days that have finished.
    for (const [staffId, totals] of shiftTotals) {
      const done = !(isToday && clock.inProgress);
      shifts.push({
        id: seedId(`shift:${date}:${staffId}`),
        outletId: OUTLET.id,
        businessDate: date,
        staffId,
        roleAtShift: 'waiter',
        startedAt: start + 16 * HOUR,
        endedAt: done ? start + 26 * HOUR : null,
        handoverTo: null,
        handoverAt: null,
        tabsOpened: totals.tabs,
        tabsHandedOver: 0,
        salesCents: totals.sales,
        voidsCents: totals.voids,
        discountsCents: ZERO,
        status: done ? 'closed' : 'open',
      });
    }

    const float = shillings(5000);
    const expectedCash = add(float, cashTaken);
    const finished = !isToday || !clock.inProgress;
    const bigVariance = date === clock.lastNight;
    const varianceShs = bigVariance ? -1240 : rand() < 0.7 ? 0 : Math.round((rand() - 0.6) * 300);
    const variance = shillings(varianceShs);
    drawerSessions.push({
      id: drawerId,
      outletId: OUTLET.id,
      businessDate: date,
      deviceId: counter,
      openedBy: grace,
      openedAt: openAt,
      openingFloatCents: float,
      closedBy: finished && !isToday ? kevin : finished && isToday ? kevin : null,
      closedAt: finished ? start + 25 * HOUR + 12 * MIN : null,
      countedCashCents: finished ? add(expectedCash, variance) : null,
      expectedCashCents: finished ? expectedCash : null,
      varianceCents: finished ? variance : null,
      varianceReason: finished && Math.abs(varianceShs) > 500 ? 'Change given in error to table 7, noticed at close' : null,
      status: finished ? 'closed' : 'open',
    });
    if (finished && bigVariance) {
      auditEvents.push(audit('drawer.closed', 'drawer_session', drawerId, start + 25 * HOUR + 12 * MIN, kevin, null, { varianceCents: variance.toString() }, 'Change given in error to table 7, noticed at close', 'sensitive'));
    }
  }

  // Holds: Hunters Choice is on hold since two days ago. Jameson was held once last month and released.
  const huntersHoldAt = zonedInstant(addDays(clock.current, -2), 20 * HOUR + 4 * MIN, TZ);
  holds.push({
    id: seedId('hold:hunters'),
    outletId: OUTLET.id,
    productVariantId: v('hunters', 'bottle'),
    placedBy: grace,
    placedAt: huntersHoldAt,
    reason: 'Bottles from the last delivery taste off, supplier checking the batch',
    expectedBack: addDays(clock.current, 2),
    releasedBy: null,
    releasedAt: null,
    releaseNote: null,
    status: 'active',
  });
  auditEvents.push(audit('hold.placed', 'stock_hold', seedId('hold:hunters'), huntersHoldAt, grace, null, { variant: 'Hunters Choice' }, 'Bottles from the last delivery taste off, supplier checking the batch', 'notable'));
  const oldHoldAt = zonedInstant(addDays(clock.current, -24), 19 * HOUR, TZ);
  holds.push({
    id: seedId('hold:jameson-old'),
    outletId: OUTLET.id,
    productVariantId: v('jameson', 'bottle'),
    placedBy: kevin,
    placedAt: oldHoldAt,
    reason: 'Bottle broke on the shelf, the rest need checking',
    expectedBack: null,
    releasedBy: kevin,
    releasedAt: oldHoldAt + 26 * HOUR,
    releaseNote: 'Checked the rest, all sealed and fine',
    status: 'released',
  });

  // Counts still in progress: a cycle count of beer being counted now, and a spot count of spirits in review.
  const today = clock.current;
  const openCountAt = Math.min(zonedInstant(today, 10 * HOUR + 30 * MIN, TZ), now - 50 * MIN);
  const beerCountId = seedId(`count:${today}:beer-cycle`);
  counts.push({ id: beerCountId, outletId: OUTLET.id, businessDate: today, stockLocationId: BAR, kind: 'cycle', isBlind: true, status: 'counting', openedBy: dan, openedAt: openCountAt, committedBy: null, committedAt: null, totalVarianceCents: null, notes: 'Beer fridge, after the delivery' });
  TRACKED_STOCK_VARIANTS.filter((id) => productOf.get(id)!.categoryId === seedId('category:beer')).forEach((id, i) => {
    const counted = i < 3 ? Math.round(get(physical, id, BAR)) : null;
    countLines.push({ id: seedId(`countline:${beerCountId}:${i}`), stockCountId: beerCountId, productVariantId: id, expectedQty: get(ledger, id, BAR), countedQty: counted, varianceQty: null, varianceCents: null, reason: null, countedBy: counted === null ? null : dan, countedAt: counted === null ? null : openCountAt + i * MIN, recountOf: null });
  });
  const spiritCountId = seedId(`count:${today}:spirits-spot`);
  counts.push({ id: spiritCountId, outletId: OUTLET.id, businessDate: today, stockLocationId: BAR, kind: 'spot', isBlind: true, status: 'review', openedBy: dan, openedAt: openCountAt - 40 * MIN, committedBy: null, committedAt: null, totalVarianceCents: null, notes: 'Spot check after the Gilbeys variance' });
  TRACKED_STOCK_VARIANTS.filter((id) => productOf.get(id)!.categoryId === seedId('category:spirits')).forEach((id, i) => {
    const expected = get(ledger, id, BAR);
    const counted = Math.round(get(physical, id, BAR) * 10) / 10;
    const varianceQty = roundQty(counted - expected);
    const cost = avgCost.get(id) ?? ZERO;
    countLines.push({ id: seedId(`countline:${spiritCountId}:${i}`), stockCountId: spiritCountId, productVariantId: id, expectedQty: expected, countedQty: counted, varianceQty, varianceCents: multiplyByQuantity(cost, varianceQty), reason: null, countedBy: dan, countedAt: openCountAt - 30 * MIN + i * MIN, recountOf: null });
  });

  // A draft order for the Jameson gap and a price change on record.
  poNumber += 1;
  purchaseOrders.push({ id: seedId(`po:${poNumber}`), outletId: OUTLET.id, supplierId: supplierByKey('kariuki').id, poNumber, status: 'draft', expectedAt: null, subtotalCents: shillings(17400), totalCents: shillings(17400), raisedBy: dan, raisedAt: now - 3 * HOUR, approvedBy: null, approvedAt: null, notes: 'Jameson finished mid service, needs approval' });
  purchaseOrderLines.push({ id: seedId(`poline:${poNumber}:0`), purchaseOrderId: seedId(`po:${poNumber}`), productVariantId: v('jameson', 'bottle'), qtyOrdered: 6, qtyReceived: 0, unitCostCents: shillings(2900), lineTotalCents: shillings(17400) });
  const priceChangeAt = zonedInstant(priceRiseDate, 10 * HOUR, TZ);
  auditEvents.push(audit('price.changed', 'price_list_item', seedId(`priceitem:happy-hour:${v('tusker', 'bottle')}:0`), priceChangeAt, staffByKey('dan').id, { priceCents: '28000' }, { priceCents: '30000' }, 'Supplier case price went up seven per cent', 'notable'));
  auditEvents.push(audit('device.enrolled', 'device', deviceByKey('floor-3').id, zonedInstant(firstDate, 9 * HOUR, TZ), staffByKey('dan').id, null, { label: 'Floor 3' }, null, 'info'));

  // Dead letters: two orders Floor 3 could not send last night.
  const lastNightLate = zonedInstant(clock.lastNight, 23 * HOUR + 38 * MIN, TZ);
  const deadLetters = [
    { id: seedId('dead:1'), deviceId: deviceByKey('floor-3').id, outboxEntryId: seedId('outbox:floor-3:812'), kind: 'order.fire', payload: { tab: 'T4', lines: 2 }, rejectionCode: 'SEAT_ALREADY_SETTLED', rejectionDetail: 'Seat 2 on tab 31 was settled at 23:31 before this order arrived', firstSeenAt: lastNightLate, resolvedAt: null, resolvedBy: null, resolutionNote: null },
    { id: seedId('dead:2'), deviceId: deviceByKey('floor-3').id, outboxEntryId: seedId('outbox:floor-3:815'), kind: 'line.move', payload: { tab: 'T4' }, rejectionCode: 'SEAT_ALREADY_SETTLED', rejectionDetail: 'The target seat was settled while the tablet was offline', firstSeenAt: lastNightLate + 2 * MIN, resolvedAt: null, resolvedBy: null, resolutionNote: null },
    { id: seedId('dead:3'), deviceId: deviceByKey('floor-2').id, outboxEntryId: seedId('outbox:floor-2:402'), kind: 'seat.remove', payload: { tab: 'T9' }, rejectionCode: 'SEAT_HAS_LINES', rejectionDetail: 'Seat 3 has 2 lines on it', firstSeenAt: lastNightLate - 6 * 24 * HOUR, resolvedAt: lastNightLate - 6 * 24 * HOUR + 14 * HOUR, resolvedBy: staffByKey('dan').id, resolutionNote: 'Lines were moved at the counter, nothing lost' },
  ];

  const presence: DevicePresence[] = [
    { deviceId: deviceByKey('floor-1').id, online: true, lastSeenAt: now - 8_000, staffId: staffByKey('amina').id, unsyncedCount: 0, appVersion: '1.0.4' },
    { deviceId: deviceByKey('floor-3').id, online: false, lastSeenAt: now - 21 * MIN, staffId: staffByKey('peter').id, unsyncedCount: 6, appVersion: '1.0.3' },
    { deviceId: deviceByKey('counter-1').id, online: true, lastSeenAt: now - 3_000, staffId: grace, unsyncedCount: 0, appVersion: '1.0.4' },
  ];

  const pourSpecs: PourSpec[] = VARIANTS.filter((x) => x.kind === 'serve' && x.serveVolumeMl).map((x) => ({
    productVariantId: x.id,
    nominalVolumeMl: x.serveVolumeMl!,
    tolerancePct: productOf.get(x.id)!.categoryId === seedId('category:wine') ? 1.5 : 2,
  }));

  // A table holds one open tab at a time. Tabs still open move to free tables if two landed together.
  const taken = new Set<string>();
  for (const tab of tabs.filter((t) => t.status === 'open')) {
    if (!tab.serviceTableId) continue;
    if (!taken.has(tab.serviceTableId)) {
      taken.add(tab.serviceTableId);
      continue;
    }
    const free = TABLES.find((t) => !taken.has(t.id) && !t.label.startsWith('S'));
    if (free) {
      tab.serviceTableId = free.id;
      tab.zoneId = free.zoneId;
      taken.add(free.id);
    }
  }

  auditEvents.sort((a, b) => b.occurredAt - a.occurredAt);
  movements.sort((a, b) => a.occurredAt - b.occurredAt);

  return {
    generatedAt: Date.now(),
    now,
    currentBusinessDate: clock.current,
    lastNight: clock.lastNight,
    tradingInProgress: clock.inProgress,
    firstBusinessDate: firstDate,
    outlet: OUTLET,
    roles: ROLES,
    staff: STAFF,
    devices: DEVICES,
    zones: ZONES,
    tables: TABLES,
    locations: LOCATIONS,
    suppliers: SUPPLIERS,
    catalogueVersion: CATALOGUE_VERSION,
    categories: CATEGORIES,
    products: ALL_PRODUCTS,
    variants: ALL_VARIANTS,
    modifierGroups: MODIFIER_GROUPS,
    modifiers: MODIFIERS,
    variantModifierGroups: VARIANT_MODIFIER_GROUPS,
    priceLists: PRICE_LISTS,
    priceListItems: PRICE_LIST_ITEMS,
    priceRules: PRICE_RULES,
    recipes: RECIPES,
    pourSpecs,
    tabs,
    seats,
    orders,
    lines,
    lineModifiers,
    bills,
    billLines,
    tenders,
    shifts,
    drawerSessions,
    movements,
    holds,
    counts,
    countLines,
    stockBatches: [],
    goodsReceivedNotes: [],
    purchaseOrders,
    purchaseOrderLines,
    receipts,
    receiptLines,
    supplierProducts: [...supplierProducts.values()],
    auditEvents,
    deadLetters,
    presence,
    availabilityVersion: 4_000 + movements.length,
    epoch: `${clock.current}:${Date.now().toString(36)}`,
    cashMovements: [],
    changeSeq: 0,
    changes: [],
    applied: new Set<string>(),
  };
}

function audit(
  action: string,
  entityType: string,
  entityId: string,
  occurredAt: number,
  actorStaffId: string,
  before: unknown,
  after: unknown,
  reason: string | null,
  severity: AuditEvent['severity'],
): AuditEvent {
  return {
    id: seedId(`audit:${action}:${entityId}:${occurredAt}`),
    outletId: OUTLET.id,
    occurredAt,
    actorStaffId,
    actorDeviceId: null,
    actorIp: null,
    action,
    entityType,
    entityId,
    before,
    after,
    reason,
    severity,
  };
}
