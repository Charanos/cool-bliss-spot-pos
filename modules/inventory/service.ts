import 'server-only';

import type { CountKind, MovementType, StockBatch, StockCount, StockHold, StockMovement } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, add, multiplyByQuantity, weightedAverage } from '@bliss/shared/money';
import { type Actor, checkReason, requireReasoned } from '@bliss/shared/reason';
import { businessDate } from '@bliss/shared/time';
import { bumpAvailabilityVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import { inventoryTables } from './schema';

const nextId = createUuidV7();

/* ------------------------------------------------------------------ ledger */

let onHandCache: { source: StockMovement[]; length: number; byKey: Map<string, number> } | null = null;

function onHandIndex(): Map<string, number> {
  const { movements } = inventoryTables();
  if (onHandCache && onHandCache.source === movements && onHandCache.length === movements.length) return onHandCache.byKey;
  const byKey = new Map<string, number>();
  for (const m of movements) {
    const k = `${m.productVariantId}|${m.stockLocationId}`;
    byKey.set(k, Math.round(((byKey.get(k) ?? 0) + m.qtyDelta) * 10_000) / 10_000);
  }
  onHandCache = { source: movements, length: movements.length, byKey };
  return byKey;
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
  const { movements } = inventoryTables();
  for (let i = movements.length - 1; i >= 0; i -= 1) {
    const m = movements[i]!;
    if (m.productVariantId === variantId) return m.unitCostCents;
  }
  return ZERO;
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
  for (const m of inventoryTables().movements) {
    if (m.occurredAt < from || m.productVariantId !== variantId || m.movementType !== 'sale') continue;
    sold -= m.qtyDelta;
  }
  return sold / days;
}

export function lastMovementAt(variantId: string, types: MovementType[] = ['sale']): number | null {
  const { movements: list } = inventoryTables();
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i]!;
    if (m.productVariantId === variantId && types.includes(m.movementType)) return m.occurredAt;
  }
  return null;
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
  if (needsReason && !checkReason(input.reason ?? '').ok) throw new Error('Reason needs at least 10 characters. Say what happened, not just "mistake".');
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
  if (existing) throw new Error(`${catalogue.productOfVariant(stock)?.name ?? 'This item'} is already on hold.`);
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
  if (!hold) throw new Error('That hold no longer exists.');
  if (hold.status !== 'active') throw new Error('That item is already off hold.');
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

export type WriteOffCategory = 'write_off_breakage' | 'write_off_spillage' | 'write_off_expiry' | 'staff_drink' | 'comp';

export function writeOff(input: { variantId: string; locationId: string; qty: number; category: WriteOffCategory; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.writeoff', 'writing off stock');
  if (!(input.qty > 0)) throw new Error('Write off at least one unit.');
  const stock = catalogue.stockVariantFor(input.variantId);
  if (!stock) throw new Error('This item does not hold stock.');
  const qty = input.qty;
  const available = onHand(stock.stockVariantId, input.locationId);
  const name = catalogue.variantById(stock.stockVariantId)?.name ?? 'this item';
  if (available - qty < -1e-9) {
    throw new Error(`This would take ${name} below zero. Post a delivery first, or record a count adjustment with a reason.`);
  }
  const outlet = identity.outlet();
  const now = Date.now();
  const movement: StockMovement = {
    id: nextId(),
    outletId: outlet.id,
    businessDate: businessDate(now, outlet.timezone, outlet.businessDayCutover),
    productVariantId: stock.stockVariantId,
    stockLocationId: input.locationId,
    stockBatchId: null,
    qtyDelta: -qty,
    volumeDeltaMl: null,
    unitCostCents: averageCost(stock.stockVariantId),
    movementType: input.category,
    sourceType: 'write_off',
    sourceId: null,
    reason,
    occurredAt: now,
    createdBy: actor.staffId,
    deviceId: null,
  };
  inventoryTables().movements.push(movement);
  bumpAvailabilityVersion();
  audit.record({
    outletId: outlet.id,
    actorStaffId: actor.staffId,
    action: 'stock.written_off',
    entityType: 'stock_movement',
    entityId: movement.id,
    before: { onHand: available },
    after: { onHand: available - qty },
    reason,
    severity: 'notable',
  });
  return movement;
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
  if (!c) throw new Error('That count no longer exists.');
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

export function openCount(input: { locationId: string; kind: CountKind; categoryIds: string[]; notes: string | null; actor: Actor }): StockCount {
  identity.assertCan(input.actor.staffId, 'stock.count.commit', 'running stock counts');
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
  const line = inventoryTables().countLines.find((l) => l.id === input.countLineId);
  if (!line) throw new Error('That count line no longer exists.');
  const c = count(line.stockCountId);
  if (c?.status !== 'counting') throw new Error('This count is not accepting figures.');
  if (input.countedQty !== null && (!Number.isFinite(input.countedQty) || input.countedQty < 0)) throw new Error('Counts are zero or more.');
  line.countedQty = input.countedQty;
  line.countedBy = input.countedQty === null ? null : input.actor.staffId;
  line.countedAt = input.countedQty === null ? null : Date.now();
}

export function submitForReview(input: { countId: string; actor: Actor }) {
  const c = count(input.countId);
  if (!c) throw new Error('That count no longer exists.');
  if (c.status !== 'counting') throw new Error('Only a count in progress can go to review.');
  const missing = inventoryTables().countLines.filter((l) => l.stockCountId === c.id && l.countedQty === null).length;
  if (missing > 0) throw new Error(`${missing} ${missing === 1 ? 'line has' : 'lines have'} no figure yet. Count them, or enter zero.`);
  c.status = 'review';
}

export function returnLineToCounting(input: { countLineId: string; actor: Actor }) {
  const line = inventoryTables().countLines.find((l) => l.id === input.countLineId);
  const c = line ? count(line.stockCountId) : null;
  if (!line || !c) throw new Error('That count line no longer exists.');
  if (c.status !== 'review') throw new Error('Only a count in review can send a line back.');
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
  if (!c) throw new Error('That count no longer exists.');
  if (c.status !== 'review') throw new Error('Only a count in review can be committed.');
  const view = countLines(c.id);
  if (view.stage !== 'review') throw new Error('Only a count in review can be committed.');

  for (const line of view.lines) {
    if (!line.outsideTolerance) continue;
    const given = input.reasons[line.id] ?? line.reason ?? '';
    if (!checkReason(given).ok) {
      const name = catalogue.variantById(line.productVariantId)?.name ?? 'A line';
      throw new Error(`${name} is outside tolerance. Write what you think happened before committing.`);
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
    inventoryTables().movements.push({
      id: nextId(),
      outletId: outlet.id,
      businessDate: c.businessDate,
      productVariantId: line.productVariantId,
      stockLocationId: c.stockLocationId,
      stockBatchId: null,
      qtyDelta: line.varianceQty,
      volumeDeltaMl: null,
      unitCostCents: averageCost(line.productVariantId),
      movementType: 'count_adjustment',
      sourceType: 'stock_count',
      sourceId: c.id,
      reason: lineReason,
      occurredAt: now,
      createdBy: actor.staffId,
      deviceId: null,
    });
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
  const c = count(input.countId);
  if (!c) throw new Error('That count no longer exists.');
  if (c.status === 'committed' || c.status === 'cancelled') throw new Error('A committed count is locked permanently.');
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
  return inventoryTables().recipes;
}

export function pourSpecs() {
  return inventoryTables().pourSpecs;
}

export function recipeFor(variantId: string) {
  return inventoryTables().recipes.find((r) => r.productVariantId === variantId) ?? null;
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

function depleteBatches(variantId: string, locationId: string, amount: number): { batchId: string | null; qty: number }[] {
  const batches = inventoryTables().stockBatches
    .filter((b) => b.productVariantId === variantId && b.stockLocationId === locationId && b.remainingQty > 0)
    .sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate - b.expiryDate;
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return a.receivedAt - b.receivedAt;
    });

  let remaining = amount;
  const deductions: { batchId: string | null; qty: number }[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remainingQty, remaining);
    batch.remainingQty = Math.round((batch.remainingQty - take) * 10_000) / 10_000;
    remaining = Math.round((remaining - take) * 10_000) / 10_000;
    deductions.push({ batchId: batch.id, qty: take });
  }

  if (remaining > 0) {
    deductions.push({ batchId: null, qty: remaining });
  }

  return deductions;
}

/** Write the sale movements for a fired line or a quick sale item. The ledger is the only stock write. */
export function recordSale(input: SaleInput) {
  for (const [variantId, amount] of depletionFor(input)) {
    if (amount === 0) continue;
    const locationId = saleLocation(variantId, amount, input.preferLocationKind);
    const deductions = depleteBatches(variantId, locationId, amount);
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

/** A voided line gives its stock back, to the location each sale movement took it from. */
export function reverseSale(input: { lineId: string; actor: Actor }) {
  const sales = inventoryTables().movements.filter((m) => m.sourceId === input.lineId && m.movementType === 'sale');
  const reversed = new Set(inventoryTables().movements.filter((m) => m.sourceId === input.lineId && m.movementType === 'sale_reversal').map((m) => `${m.productVariantId}|${m.stockLocationId}`));
  for (const m of sales) {
    if (reversed.has(`${m.productVariantId}|${m.stockLocationId}`)) continue;
    recordMovement({
      variantId: m.productVariantId,
      locationId: m.stockLocationId,
      qtyDelta: -m.qtyDelta,
      type: 'sale_reversal',
      sourceType: 'order_line',
      sourceId: input.lineId,
      reason: null,
      actor: input.actor,
    });
  }
}
