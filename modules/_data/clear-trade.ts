import type { Dataset } from '@bliss/db/seed/types';
import type { StockBatch, StockMovement } from '@bliss/shared/domain';

/**
 * What clearing trade takes away: every tab and what hangs off it, the bills and their tenders, the
 * shifts, the drawers and their cash, and refused entries from the stations. What the outlet is made
 * of stays: tables and zones, staff, roles and PINs, devices, the menu and its prices, suppliers,
 * deliveries, counts and holds, and the audit trail.
 */
export const TRADE_COLLECTIONS = ['tabs', 'seats', 'orders', 'lines', 'lineModifiers', 'bills', 'billLines', 'tenders', 'shifts', 'drawerSessions', 'cashMovements', 'deadLetters', 'notifications'] as const satisfies readonly (keyof Dataset)[];

/** Stock that moved because of a sale: the sale, its reversal, what was brought to the bar for it, and what was covered. */
export function isTradeMovement(m: StockMovement): boolean {
  return m.movementType === 'sale' || m.movementType === 'sale_reversal' || m.movementType === 'sale_cover' || m.sourceType === 'sale_restock';
}

export interface ClearPlan {
  movementIds: string[];
  /** Delivery lots with what the cleared sales drew from them put back. */
  batches: StockBatch[];
  summary: { tabs: number; bills: number; orders: number; lines: number; shifts: number; drawers: number; stockMovements: number };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function planClearTrade(data: Dataset): ClearPlan {
  const moves = data.movements.filter(isTradeMovement);
  const back = new Map<string, number>();
  for (const m of moves) if (m.stockBatchId) back.set(m.stockBatchId, (back.get(m.stockBatchId) ?? 0) - m.qtyDelta);
  const batches = data.stockBatches
    .filter((b) => back.has(b.id))
    .map((b) => ({ ...b, remainingQty: Math.min(b.initialQty, Math.max(0, round4(b.remainingQty + (back.get(b.id) ?? 0)))) }));
  return {
    movementIds: moves.map((m) => m.id),
    batches,
    summary: {
      tabs: data.tabs.length,
      bills: data.bills.length,
      orders: data.orders.length,
      lines: data.lines.length,
      shifts: data.shifts.length,
      drawers: data.drawerSessions.length,
      stockMovements: moves.length,
    },
  };
}

/** Apply a plan to a dataset held in memory: the arrays are replaced, so every cache over them rebuilds. */
export function applyClearTrade(data: Dataset, plan: ClearPlan, epoch: string): void {
  const record = data as unknown as Record<string, unknown>;
  for (const c of TRADE_COLLECTIONS) record[c] = [];
  const gone = new Set(plan.movementIds);
  data.movements = data.movements.filter((m) => !gone.has(m.id));
  const lots = new Map(plan.batches.map((b) => [b.id, b]));
  data.stockBatches = data.stockBatches.map((b) => lots.get(b.id) ?? b);
  data.changes = [];
  data.applied = new Set();
  data.epoch = epoch;
  data.availabilityVersion += 1;
}
