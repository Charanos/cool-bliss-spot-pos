import 'server-only';

import { DomainError } from '../_data/errors';

import type { CountKind, MovementType, StockBatch, StockCount, StockHold, StockMovement } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, add, multiplyByQuantity, weightedAverage } from '@bliss/shared/money';
import { type Actor, checkReason, requireReasoned } from '@bliss/shared/reason';
import { type IsoDate, businessDate } from '@bliss/shared/time';
import { bumpAvailabilityVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import { inventoryTables } from './schema';

const nextId = createUuidV7();

/* ------------------------------------------------------------------ ledger */

/**
 * Indexes over the ledger, rebuilt when the ledger changes. The ledger is append-only in normal use,
 * but a failed write is rolled back, so a cache also checks the last row it saw is still the last row.
 */
interface LedgerIndex {
  source: StockMovement[];
  length: number;
  last: StockMovement | undefined;
  onHand: Map<string, number>;
  lastCost: Map<string, Cents>;
  sales: Map<string, { at: number; qty: number }[]>;
  lastAt: Map<string, Map<MovementType, number>>;
}

let ledgerCache: LedgerIndex | null = null;

function ledger(): LedgerIndex {
  const { movements } = inventoryTables();
  const last = movements[movements.length - 1];
  if (ledgerCache && ledgerCache.source === movements && ledgerCache.length === movements.length && ledgerCache.last === last) return ledgerCache;
  const onHandMap = new Map<string, number>();
  const lastCost = new Map<string, Cents>();
  const sales = new Map<string, { at: number; qty: number }[]>();
  const lastAt = new Map<string, Map<MovementType, number>>();
  for (const m of movements) {
    const k = `${m.productVariantId}|${m.stockLocationId}`;
    onHandMap.set(k, Math.round(((onHandMap.get(k) ?? 0) + m.qtyDelta) * 10_000) / 10_000);
    lastCost.set(m.productVariantId, m.unitCostCents);
    if (m.movementType === 'sale') {
      const list = sales.get(m.productVariantId) ?? [];
      list.push({ at: m.occurredAt, qty: -m.qtyDelta });
      sales.set(m.productVariantId, list);
    }
    const byType = lastAt.get(m.productVariantId) ?? new Map<MovementType, number>();
    byType.set(m.movementType, Math.max(byType.get(m.movementType) ?? 0, m.occurredAt));
    lastAt.set(m.productVariantId, byType);
  }
  ledgerCache = { source: movements, length: movements.length, last, onHand: onHandMap, lastCost, sales, lastAt };
  return ledgerCache;
}

function onHandIndex(): Map<string, number> {
  return ledger().onHand;
}

/**
 * On hand is the sum of the ledger. docs/04-data-model.md, "On hand at a moment". With `at`, the
 * sum runs to that instant, which is the definition; without it, a cached index of the same sum.
 */
export function onHand(variantId: string, locationId?: string | null, at?: number): number {
  const { movements, locations } = inventoryTables();
  if (at !== undefined) {
    let total = 0;
    for (const m of movements) {
      if (m.occurredAt > at) break;
      if (m.productVariantId === variantId && (!locationId || m.stockLocationId === locationId)) total += m.qtyDelta;
    }
    return Math.round(total * 10_000) / 10_000;
  }
  const index = onHandIndex();
  if (locationId) return index.get(`${variantId}|${locationId}`) ?? 0;
  return locations.reduce((sum, l) => sum + (index.get(`${variantId}|${l.id}`) ?? 0), 0);
}

export function locations() {
  return inventoryTables().locations;
}

/** Moving average cost as of the latest movement, which stores the cost at the time it happened. */
export function averageCost(variantId: string): Cents {
  return ledger().lastCost.get(variantId) ?? ZERO;
}

export function valueAtCost(variantId: string, qty: number): Cents {
  return multiplyByQuantity(averageCost(variantId), qty);
}

export interface MovementFilter {
  variantId?: string | null;
  locationId?: string | null;
  type?: MovementType | null;
  from?: number;
  to?: number;
}

export function movements(filter: MovementFilter = {}): StockMovement[] {
  return inventoryTables().movements.filter(
    (m) =>
      (!filter.variantId || m.productVariantId === filter.variantId) &&
      (!filter.locationId || m.stockLocationId === filter.locationId) &&
      (!filter.type || m.movementType === filter.type) &&
      (filter.from === undefined || m.occurredAt >= filter.from) &&
      (filter.to === undefined || m.occurredAt < filter.to),
  );
}

/** Units sold per day over a window, from sale movements, in stock units. */
export function velocityPerDay(variantId: string, days = 28, now = Date.now()): number {
  const from = now - days * 86_400_000;
  let sold = 0;
  for (const sale of ledger().sales.get(variantId) ?? []) if (sale.at >= from && sale.at <= now) sold += sale.qty;
  return sold / days;
}

export function lastMovementAt(variantId: string, types: MovementType[] = ['sale']): number | null {
  const byType = ledger().lastAt.get(variantId);
  if (!byType) return null;
  let latest: number | null = null;
  for (const type of types) {
    const at = byType.get(type);
    if (at !== undefined && (latest === null || at > latest)) latest = at;
  }
  return latest;
}

/**
 * Append a movement. The only write path to stock: no path writes on hand directly, and a correction
 * is a compensating movement, never an edit. docs/01-product-spec.md R8.
 */
export function recordMovement(input: {
  variantId: string;
  locationId: string;
  stockBatchId?: string | null;
  qtyDelta: number;
  type: MovementType;
  sourceType: string;
  sourceId: string | null;
  reason: string | null;
  actor: Actor;
  /** A receipt brings its own cost; the moving average is recomputed from it. Anything else moves at average. */
  unitCostCents?: Cents;
}): StockMovement {
  const needsReason = input.type.startsWith('write_off') || input.type === 'count_adjustment' || input.type === 'comp' || input.type === 'staff_drink';
  if (needsReason && !checkReason(input.reason ?? '').ok) throw new DomainError('Reason needs at least 10 characters. Say what happened, not just "mistake".');
  const outlet = identity.outlet();
  const now = Date.now();
  const movement: StockMovement = {
    id: nextId(),
    outletId: outlet.id,
    businessDate: businessDate(now, outlet.timezone, outlet.businessDayCutover),
    productVariantId: input.variantId,
    stockLocationId: input.locationId,
    stockBatchId: input.stockBatchId ?? null,
    qtyDelta: input.qtyDelta,
    volumeDeltaMl: null,
    unitCostCents:
      input.unitCostCents === undefined
        ? averageCost(input.variantId)
        : weightedAverage([
            [averageCost(input.variantId), Math.max(0, onHand(input.variantId))],
            [input.unitCostCents, Math.max(0, input.qtyDelta)],
          ]),
    movementType: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    reason: input.reason,
    occurredAt: now,
    createdBy: input.actor.staffId,
    deviceId: input.actor.deviceId,
  };
  inventoryTables().movements.push(movement);
  bumpAvailabilityVersion();
  return movement;
}

export function createBatch(input: {
  variantId: string;
  locationId: string;
  qty: number;
  unitCostCents: Cents;
  batchNumber: string | null;
  expiryDate: number | null;
  actor: Actor;
}) {
  const batch = {
    id: nextId(),
    outletId: identity.outlet().id,
    productVariantId: input.variantId,
    stockLocationId: input.locationId,
    batchNumber: input.batchNumber,
    initialQty: input.qty,
    remainingQty: input.qty,
    unitCostCents: input.unitCostCents,
    receivedAt: Date.now(),
    expiryDate: input.expiryDate,
  };
  inventoryTables().stockBatches.push(batch);
  return batch;
}

export function batches(): StockBatch[] {
  return inventoryTables().stockBatches;
}

export function batchesForVariant(variantId: string): StockBatch[] {
  return inventoryTables().stockBatches.filter((b) => b.productVariantId === variantId);
}

/* ------------------------------------------------------------------- holds */

export function holds(): StockHold[] {
  return inventoryTables().holds;
}

export function activeHolds(): StockHold[] {
  return inventoryTables().holds.filter((h) => h.status === 'active');
}

/**
 * Put an item on hold. docs/05-flows-and-channels.md section 2.10. A hold always outranks the
 * computed stock figure. It is placed on the stock variant, so every serve of that bottle stops.
 */
export function placeHold(input: { variantId: string; reason: string; expectedBack: string | null; actor: Actor }): StockHold {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'hold.set', 'putting items on hold');
  const stock = catalogue.stockVariantFor(input.variantId)?.stockVariantId ?? input.variantId;
  const existing = activeHolds().find((h) => h.productVariantId === stock);
  if (existing) throw new DomainError(`${catalogue.productOfVariant(stock)?.name ?? 'This item'} is already on hold.`);
  const hold: StockHold = {
    id: nextId(),
    outletId: identity.outlet().id,
    productVariantId: stock,
    placedBy: actor.staffId,
    placedAt: Date.now(),
    reason,
    expectedBack: input.expectedBack,
    releasedBy: null,
    releasedAt: null,
    releaseNote: null,
    status: 'active',
  };
  inventoryTables().holds.push(hold);
  bumpAvailabilityVersion();
  audit.record({
    outletId: hold.outletId,
    actorStaffId: actor.staffId,
    action: 'hold.placed',
    entityType: 'stock_hold',
    entityId: hold.id,
    before: null,
    after: { variantId: stock, expectedBack: hold.expectedBack },
    reason,
    severity: 'notable',
  });
  return hold;
}

export function releaseHold(input: { holdId: string; note: string; actor: Actor }): StockHold {
  identity.assertCan(input.actor.staffId, 'hold.set', 'taking items off hold');
  const hold = inventoryTables().holds.find((h) => h.id === input.holdId);
  if (!hold) throw new DomainError('That hold no longer exists.');
  if (hold.status !== 'active') throw new DomainError('That item is already off hold.');
  const note = input.note.trim();
  hold.status = 'released';
  hold.releasedBy = input.actor.staffId;
  hold.releasedAt = Date.now();
  hold.releaseNote = note.length > 0 ? note : null;
  bumpAvailabilityVersion();
  audit.record({
    outletId: hold.outletId,
    actorStaffId: input.actor.staffId,
    action: 'hold.released',
    entityType: 'stock_hold',
    entityId: hold.id,
    before: { status: 'active' },
    after: { status: 'released' },
    reason: hold.releaseNote,
    severity: 'notable',
  });
  return hold;
}

/* ---------------------------------------------------------------- write-off */

export const WRITE_OFF_CATEGORIES = ['write_off_breakage', 'write_off_spillage', 'write_off_expiry', 'staff_drink', 'comp'] as const;
export type WriteOffCategory = (typeof WRITE_OFF_CATEGORIES)[number];

export function writeOff(input: { variantId: string; locationId: string; qty: number; category: WriteOffCategory; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.writeoff', 'writing off stock');
  if (!WRITE_OFF_CATEGORIES.includes(input.category)) throw new DomainError('Choose what kind of write-off this is.');
  if (!locations().some((l) => l.id === input.locationId)) throw new DomainError('Choose where the stock was written off.');
  if (!(input.qty > 0) || !Number.isFinite(input.qty)) throw new DomainError('Write off at least one unit.');
  const stock = catalogue.stockVariantFor(input.variantId);
  if (!stock) throw new DomainError('This item does not hold stock.');
  const qty = input.qty;
  const available = onHand(stock.stockVariantId, input.locationId);
  const name = catalogue.variantById(stock.stockVariantId)?.name ?? 'this item';
  if (available - qty < -1e-9) {
    throw new DomainError(`This would take ${name} below zero. Post a delivery first, or record a count adjustment with a reason.`);
  }
  const outlet = identity.outlet();
  const now = Date.now();
  const cost = averageCost(stock.stockVariantId);
  const written: StockMovement[] = [];
  // One key for the whole write-off, so it can be taken back as one.
  const group = nextId();
  // An expiry write-off takes the lot closest to its date, like every other draw.
  for (const { batchId, qty: part } of depleteBatches(stock.stockVariantId, qty)) {
    if (part <= 0) continue;
    const movement: StockMovement = {
      id: nextId(),
      outletId: outlet.id,
      businessDate: businessDate(now, outlet.timezone, outlet.businessDayCutover),
      productVariantId: stock.stockVariantId,
      stockLocationId: input.locationId,
      stockBatchId: batchId,
      qtyDelta: -part,
      volumeDeltaMl: null,
      unitCostCents: cost,
      movementType: input.category,
      sourceType: 'write_off',
      sourceId: group,
      reason,
      occurredAt: now,
      createdBy: actor.staffId,
      deviceId: null,
    };
    inventoryTables().movements.push(movement);
    written.push(movement);
  }
  bumpAvailabilityVersion();
  audit.record({
    outletId: outlet.id,
    actorStaffId: actor.staffId,
    action: 'stock.written_off',
    entityType: 'stock_movement',
    entityId: written[0]!.id,
    before: { onHand: available },
    after: { onHand: available - qty, category: input.category },
    reason,
    severity: 'notable',
  });
  return written[0]!;
}

/* ------------------------------------------------------------------ counts */

export function counts(): StockCount[] {
  return [...inventoryTables().counts].sort((a, b) => b.openedAt - a.openedAt);
}

export function count(id: string): StockCount | null {
  return inventoryTables().counts.find((c) => c.id === id) ?? null;
}

/** What a counter sees before review. There is no expected quantity in this type at all. */
export interface BlindCountLine {
  id: string;
  productVariantId: string;
  countedQty: number | null;
  countedBy: string | null;
  countedAt: number | null;
}

/** What a reviewer sees once the count reaches review. */
export interface ReviewCountLine extends BlindCountLine {
  expectedQty: number;
  varianceQty: number | null;
  varianceCents: Cents | null;
  reason: string | null;
  tolerancePct: number;
  outsideTolerance: boolean;
}

export type CountLinesView = { stage: 'blind'; lines: BlindCountLine[] } | { stage: 'review'; lines: ReviewCountLine[] };

function toleranceFor(variantId: string): number {
  const category = catalogue.categoryOfVariant(variantId);
  return category?.name === 'Spirits' ? 2 : category?.name === 'Wine' ? 1.5 : 1;
}

/**
 * docs/04-data-model.md, blind count rule: expected_qty is omitted from the response until the count
 * moves to review. Hiding it in the UI is not sufficient. The blind branch builds a new object from
 * an allow list, so the field is physically absent, and contract.test.ts fails if it ever appears.
 */
export function countLines(countId: string): CountLinesView {
  const c = count(countId);
  if (!c) throw new DomainError('That count no longer exists.');
  const lines = inventoryTables().countLines.filter((l) => l.stockCountId === countId);
  if (c.status === 'open' || c.status === 'counting') {
    return {
      stage: 'blind',
      lines: lines.map((l) => ({ id: l.id, productVariantId: l.productVariantId, countedQty: l.countedQty, countedBy: l.countedBy, countedAt: l.countedAt })),
    };
  }
  return {
    stage: 'review',
    lines: lines.map((l) => {
      const varianceQty = l.countedQty === null ? null : Math.round((l.countedQty - l.expectedQty) * 10_000) / 10_000;
      const tolerancePct = toleranceFor(l.productVariantId);
      const base = Math.max(1, Math.abs(l.expectedQty));
      return {
        id: l.id,
        productVariantId: l.productVariantId,
        countedQty: l.countedQty,
        countedBy: l.countedBy,
        countedAt: l.countedAt,
        expectedQty: l.expectedQty,
        varianceQty,
        varianceCents: varianceQty === null ? null : valueAtCost(l.productVariantId, varianceQty),
        reason: l.reason,
        tolerancePct,
        outsideTolerance: varianceQty !== null && (Math.abs(varianceQty) / base) * 100 > tolerancePct && Math.abs(varianceQty) >= 0.1,
      };
    }),
  };
}

export const COUNT_KINDS = ['full', 'cycle', 'spot'] as const satisfies readonly CountKind[];

export function openCount(input: { locationId: string; kind: CountKind; categoryIds: string[]; notes: string | null; actor: Actor }): StockCount {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'running stock counts');
  if (!locations().some((l) => l.id === input.locationId && l.status === 'active')) throw new DomainError('Choose where the count happens.');
  if (!COUNT_KINDS.includes(input.kind)) throw new DomainError('Choose a full, cycle or spot count.');
  for (const id of input.categoryIds) if (!catalogue.categories().some((c) => c.id === id)) throw new DomainError('One of the categories is not in the catalogue.');
  const running = counts().find((c) => c.stockLocationId === input.locationId && (c.status === 'counting' || c.status === 'review'));
  if (running) throw new DomainError('A count is already running at this location. Finish or cancel it first.');
  const outlet = identity.outlet();
  const now = Date.now();
  const stockCount: StockCount = {
    id: nextId(),
    outletId: outlet.id,
    businessDate: businessDate(now, outlet.timezone, outlet.businessDayCutover),
    stockLocationId: input.locationId,
    kind: input.kind,
    isBlind: true,
    status: 'counting',
    openedBy: input.actor.staffId,
    openedAt: now,
    committedBy: null,
    committedAt: null,
    totalVarianceCents: null,
    notes: input.notes,
  };
  const scope = catalogue
    .stockVariants()
    .filter((v) => input.kind === 'full' || input.categoryIds.length === 0 || input.categoryIds.includes(catalogue.productOfVariant(v.id)?.categoryId ?? ''));
  inventoryTables().counts.push(stockCount);
  for (const v of scope) {
    inventoryTables().countLines.push({
      id: nextId(),
      stockCountId: stockCount.id,
      productVariantId: v.id,
      // Captured at open, withheld until review.
      expectedQty: onHand(v.id, input.locationId),
      countedQty: null,
      varianceQty: null,
      varianceCents: null,
      reason: null,
      countedBy: null,
      countedAt: null,
      recountOf: null,
    });
  }
  return stockCount;
}

export function recordCounted(input: { countLineId: string; countedQty: number | null; actor: Actor }) {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'counting stock');
  const line = inventoryTables().countLines.find((l) => l.id === input.countLineId);
  if (!line) throw new DomainError('That count line no longer exists.');
  const c = count(line.stockCountId);
  if (c?.status !== 'counting') throw new DomainError('This count is not accepting figures.');
  if (input.countedQty !== null && (!Number.isFinite(input.countedQty) || input.countedQty < 0 || input.countedQty > 1_000_000)) throw new DomainError('Counts are zero or more.');
  line.countedQty = input.countedQty;
  line.countedBy = input.countedQty === null ? null : input.actor.staffId;
  line.countedAt = input.countedQty === null ? null : Date.now();
}

export function submitForReview(input: { countId: string; actor: Actor }) {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'sending counts to review');
  const c = count(input.countId);
  if (!c) throw new DomainError('That count no longer exists.');
  if (c.status !== 'counting') throw new DomainError('Only a count in progress can go to review.');
  const missing = inventoryTables().countLines.filter((l) => l.stockCountId === c.id && l.countedQty === null).length;
  if (missing > 0) throw new DomainError(`${missing} ${missing === 1 ? 'line has' : 'lines have'} no figure yet. Count them, or enter zero.`);
  c.status = 'review';
}

export function returnLineToCounting(input: { countLineId: string; actor: Actor }) {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'sending lines back to counting');
  const line = inventoryTables().countLines.find((l) => l.id === input.countLineId);
  const c = line ? count(line.stockCountId) : null;
  if (!line || !c) throw new DomainError('That count line no longer exists.');
  if (c.status !== 'review') throw new DomainError('Only a count in review can send a line back.');
  line.countedQty = null;
  line.countedBy = null;
  line.countedAt = null;
  c.status = 'counting';
}

/**
 * Commit a count: adjustment movements with the supplied reasons, one availability recompute, and the
 * count locks permanently. There is no transition out of committed.
 */
export function commitCount(input: { countId: string; reasons: Record<string, string>; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.count.commit', 'committing counts');
  const c = count(input.countId);
  if (!c) throw new DomainError('That count no longer exists.');
  if (c.status !== 'review') throw new DomainError('Only a count in review can be committed.');
  const view = countLines(c.id);
  if (view.stage !== 'review') throw new DomainError('Only a count in review can be committed.');

  for (const line of view.lines) {
    if (!line.outsideTolerance) continue;
    const given = input.reasons[line.id] ?? line.reason ?? '';
    if (!checkReason(given).ok) {
      const name = catalogue.variantById(line.productVariantId)?.name ?? 'A line';
      throw new DomainError(`${name} is outside tolerance. Write what you think happened before committing.`);
    }
  }

  const outlet = identity.outlet();
  const now = Date.now();
  let total = ZERO;
  for (const line of view.lines) {
    const stored = inventoryTables().countLines.find((l) => l.id === line.id)!;
    if (line.varianceQty === null || line.varianceQty === 0) continue;
    const lineReason = input.reasons[line.id]?.trim() || stored.reason || 'Within tolerance, adjusted to count';
    stored.varianceQty = line.varianceQty;
    stored.varianceCents = line.varianceCents;
    stored.reason = lineReason;
    total = add(total, line.varianceCents ?? ZERO);
    const cost = averageCost(line.productVariantId);
    // A shortfall draws down the lots like any other loss; a surplus is unbatched stock found.
    const parts = line.varianceQty < 0 ? depleteBatches(line.productVariantId, -line.varianceQty).map((d) => ({ batchId: d.batchId, qty: -d.qty })) : [{ batchId: null, qty: line.varianceQty }];
    for (const part of parts) {
      if (part.qty === 0) continue;
      inventoryTables().movements.push({
        id: nextId(),
        outletId: outlet.id,
        businessDate: c.businessDate,
        productVariantId: line.productVariantId,
        stockLocationId: c.stockLocationId,
        stockBatchId: part.batchId,
        qtyDelta: part.qty,
        volumeDeltaMl: null,
        unitCostCents: cost,
        movementType: 'count_adjustment',
        sourceType: 'stock_count',
        sourceId: c.id,
        reason: lineReason,
        occurredAt: now,
        createdBy: actor.staffId,
        deviceId: null,
      });
    }
  }
  c.status = 'committed';
  c.committedBy = actor.staffId;
  c.committedAt = now;
  c.totalVarianceCents = total;
  bumpAvailabilityVersion();
  audit.record({
    outletId: outlet.id,
    actorStaffId: actor.staffId,
    action: 'count.committed',
    entityType: 'stock_count',
    entityId: c.id,
    before: { status: 'review' },
    after: { status: 'committed', totalVarianceCents: total.toString() },
    reason,
    severity: 'notable',
  });
  return c;
}

export function cancelCount(input: { countId: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.count.commit', 'cancelling counts');
  const c = count(input.countId);
  if (!c) throw new DomainError('That count no longer exists.');
  if (c.status === 'committed' || c.status === 'cancelled') throw new DomainError('A committed count is locked permanently.');
  c.status = 'cancelled';
  audit.record({
    outletId: c.outletId,
    actorStaffId: actor.staffId,
    action: 'count.cancelled',
    entityType: 'stock_count',
    entityId: c.id,
    before: null,
    after: { status: 'cancelled' },
    reason,
    severity: 'info',
  });
}

/** The latest committed variance for a stock variant, for the Stock view's Variance column. */
export function latestVariance(variantId: string): { pct: number; qty: number; cents: Cents; at: number } | null {
  const { counts: all, countLines: lines } = inventoryTables();
  const committed = all.filter((c) => c.status === 'committed').sort((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0));
  for (const c of committed) {
    const line = lines.find((l) => l.stockCountId === c.id && l.productVariantId === variantId);
    if (line && line.varianceQty !== null) {
      const base = Math.max(1, Math.abs(line.expectedQty));
      return { pct: (line.varianceQty / base) * 100, qty: line.varianceQty, cents: line.varianceCents ?? ZERO, at: c.committedAt ?? c.openedAt };
    }
  }
  return null;
}

export function recipes() {
  return inventoryTables().recipes.filter((r) => r.status !== 'archived');
}

export function pourSpecs() {
  return inventoryTables().pourSpecs;
}

export function recipeFor(variantId: string) {
  return inventoryTables().recipes.find((r) => r.productVariantId === variantId && r.status !== 'archived') ?? null;
}

/**
 * Take back a write-off recorded by mistake, the same business day it was made. The units return
 * to the lots they came from, as a count adjustment that names the write-off it undoes.
 */
export function reverseWriteOff(input: { groupId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.writeoff', 'taking back write-offs');
  const all = inventoryTables().movements;
  const taken = all.filter((m) => m.sourceType === 'write_off' && m.sourceId === input.groupId);
  if (taken.length === 0) throw new DomainError('That write-off is not in the ledger.');
  if (all.some((m) => m.sourceType === 'write_off_reversal' && m.sourceId === input.groupId)) throw new DomainError('That write-off was taken back already.');
  const outlet = identity.outlet();
  const now = Date.now();
  const today = businessDate(now, outlet.timezone, outlet.businessDayCutover);
  if (taken[0]!.businessDate !== today) throw new DomainError('A write-off can be taken back on the business day it was made. Correct it with a count instead.');
  for (const m of taken) {
    restoreBatch(m.stockBatchId, -m.qtyDelta);
    all.push({ ...m, id: nextId(), qtyDelta: -m.qtyDelta, movementType: 'count_adjustment', sourceType: 'write_off_reversal', sourceId: input.groupId, reason, occurredAt: now, createdBy: actor.staffId, businessDate: today });
  }
  bumpAvailabilityVersion();
  audit.record({ outletId: outlet.id, actorStaffId: actor.staffId, action: 'stock.write_off_reversed', entityType: 'stock_movement', entityId: taken[0]!.id, before: { qty: -taken.reduce((a, m) => a + m.qtyDelta, 0) }, after: { qty: 0 }, reason, severity: 'notable' });
}

/** Change when a held item is expected back. */
export function updateHold(input: { holdId: string; expectedBack: IsoDate | null; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'hold.set', 'changing holds');
  const hold = inventoryTables().holds.find((h) => h.id === input.holdId);
  if (!hold || hold.status !== 'active') throw new DomainError('That hold has been released.');
  if (input.expectedBack !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.expectedBack)) throw new DomainError('Enter a date, such as 2027-03-31.');
  if (hold.expectedBack === input.expectedBack) return;
  const before = { expectedBack: hold.expectedBack };
  hold.expectedBack = input.expectedBack;
  audit.record({ outletId: hold.outletId, actorStaffId: input.actor.staffId, action: 'hold.updated', entityType: 'stock_hold', entityId: hold.id, before, after: { expectedBack: input.expectedBack }, reason: null, severity: 'info' });
}

/* ---------------------------------------------------------------- sale cascade */

export interface SaleInput {
  lineId: string;
  productVariantId: string;
  qty: number;
  modifiers: readonly { linkedVariantId: string | null; qty: number }[];
  actor: Actor;
  /** A quick sale takes stock from the retail location when it holds the bottle. */
  preferLocationKind?: 'retail' | 'service';
}

/**
 * The stock a sold line takes, per stock variant. docs/05 section 2.4: a recipe depletes its
 * components; otherwise a serve depletes its bottle by the depletion factor and a sealed unit
 * depletes itself; a modifier linked to a variant, such as Coke as a mixer, depletes that too.
 */
export function depletionFor(input: Pick<SaleInput, 'productVariantId' | 'qty' | 'modifiers'>): Map<string, number> {
  const out = new Map<string, number>();
  const bump = (variantId: string, amount: number) => out.set(variantId, Math.round(((out.get(variantId) ?? 0) + amount) * 10_000) / 10_000);
  const recipe = recipeFor(input.productVariantId);
  if (recipe) {
    for (const c of recipe.components) {
      const stock = catalogue.stockVariantFor(c.componentVariantId);
      if (stock) bump(stock.stockVariantId, input.qty * c.qty * stock.factor * (1 + c.wastagePct / 100));
    }
  } else {
    const stock = catalogue.stockVariantFor(input.productVariantId);
    if (stock) bump(stock.stockVariantId, input.qty * stock.factor);
  }
  for (const m of input.modifiers) {
    if (!m.linkedVariantId) continue;
    const stock = catalogue.stockVariantFor(m.linkedVariantId);
    if (stock) bump(stock.stockVariantId, input.qty * m.qty * stock.factor);
  }
  return out;
}

function saleLocation(variantId: string, amount: number, prefer: SaleInput['preferLocationKind']) {
  const all = locations();
  if (prefer === 'retail') {
    const retail = all.find((l) => l.kind === 'retail');
    if (retail && onHand(variantId, retail.id) >= amount) return retail.id;
  }
  return (all.find((l) => l.isDefaultSale) ?? all.find((l) => l.kind === 'service') ?? all[0]!).id;
}

/**
 * Batches are lots: what arrived on one delivery, at one cost, with one expiry. They are tracked for
 * the outlet as a whole, because stock moves from the store to the bar shelf without a transfer
 * record, so a sale at the bar draws down the lot that arrived in the store. Draws go first expiry
 * first, then oldest first; anything beyond the lots on record is unbatched.
 */
function depleteBatches(variantId: string, amount: number): { batchId: string | null; qty: number }[] {
  const lots = inventoryTables()
    .stockBatches.filter((b) => b.productVariantId === variantId && b.remainingQty > 0)
    .sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate - b.expiryDate;
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return a.receivedAt - b.receivedAt;
    });

  let remaining = amount;
  const deductions: { batchId: string | null; qty: number }[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.remainingQty, remaining);
    lot.remainingQty = Math.round((lot.remainingQty - take) * 10_000) / 10_000;
    remaining = Math.round((remaining - take) * 10_000) / 10_000;
    deductions.push({ batchId: lot.id, qty: take });
  }
  if (remaining > 0) deductions.push({ batchId: null, qty: remaining });
  return deductions;
}

/** Put units back on the lot they came from, never above what the lot started with. */
function restoreBatch(batchId: string | null, qty: number) {
  if (!batchId || qty <= 0) return;
  const lot = inventoryTables().stockBatches.find((b) => b.id === batchId);
  if (!lot) return;
  lot.remainingQty = Math.min(lot.initialQty, Math.round((lot.remainingQty + qty) * 10_000) / 10_000);
}

/** Take units off one lot, for a delivery that is reversed. Returns what was actually taken. */
export function drawFromBatch(batchId: string, qty: number): number {
  const lot = inventoryTables().stockBatches.find((b) => b.id === batchId);
  if (!lot || qty <= 0) return 0;
  const take = Math.min(lot.remainingQty, qty);
  lot.remainingQty = Math.round((lot.remainingQty - take) * 10_000) / 10_000;
  return take;
}

/** Write the sale movements for a fired line or a quick sale item. The ledger is the only stock write. */
export function recordSale(input: SaleInput) {
  for (const [variantId, amount] of depletionFor(input)) {
    if (amount === 0) continue;
    const locationId = saleLocation(variantId, amount, input.preferLocationKind);
    const deductions = depleteBatches(variantId, amount);
    for (const { batchId, qty } of deductions) {
      if (qty <= 0) continue;
      recordMovement({
        variantId,
        locationId,
        stockBatchId: batchId,
        qtyDelta: -qty,
        type: 'sale',
        sourceType: 'order_line',
        sourceId: input.lineId,
        reason: null,
        actor: input.actor,
      });
    }
  }
}

/** A voided line gives its stock back, to the location and the lot each sale movement took it from. */
export function reverseSale(input: { lineId: string; actor: Actor }) {
  const all = inventoryTables().movements;
  const key = (m: StockMovement) => `${m.productVariantId}|${m.stockLocationId}|${m.stockBatchId ?? ''}`;
  const reversed = new Set(all.filter((m) => m.sourceId === input.lineId && m.movementType === 'sale_reversal').map(key));
  const sales = all.filter((m) => m.sourceId === input.lineId && m.movementType === 'sale');
  for (const m of sales) {
    if (reversed.has(key(m))) continue;
    restoreBatch(m.stockBatchId, -m.qtyDelta);
    recordMovement({
      variantId: m.productVariantId,
      locationId: m.stockLocationId,
      stockBatchId: m.stockBatchId,
      qtyDelta: -m.qtyDelta,
      type: 'sale_reversal',
      sourceType: 'order_line',
      sourceId: input.lineId,
      reason: null,
      actor: input.actor,
    });
  }
}
