import type { AvailabilityReason, AvailabilityState } from '../domain';

/** "Last few" is three serves or fewer, per docs/01-product-spec.md section 5. */
export const LAST_FEW_SERVES = 3;

export interface AvailabilityInput {
  /** A manual hold (86) is active for this variant. */
  hasActiveHold: boolean;
  variantActive: boolean;
  categoryActive: boolean;
  /** Category tracks stock. Untracked items (a kitchen plate) are only ever held, never counted. */
  tracked: boolean;
  /** Sellable units of this variant on hand: serves for a serve, whole units for a sealed item. */
  qtyAvailable: number;
  /** Low stock threshold in the same units, from the product or the outlet default. */
  threshold: number;
}

export interface AvailabilityResult {
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  qtyAvailable: number;
}

/**
 * The one answer to "can the floor sell this right now". ADR-008.
 *
 * Evaluated in exactly this order, and the hold check is first for a reason: the bar knowing a
 * bottle broke beats the ledger thinking it is full.
 *
 *   hold active?                     -> finished, reason 'hold'
 *   variant or category not active?  -> finished, reason 'variant_status' | 'category_status'
 *   qty <= 0                         -> finished, reason 'stock'
 *   qty <= 3 serves                  -> last_few
 *   qty <= threshold                 -> low
 *   otherwise                        -> available
 */
export function evaluateAvailability(input: AvailabilityInput): AvailabilityResult {
  const qty = input.qtyAvailable;
  if (input.hasActiveHold) return { state: 'finished', reason: 'hold', qtyAvailable: qty };
  if (!input.variantActive) return { state: 'finished', reason: 'variant_status', qtyAvailable: qty };
  if (!input.categoryActive) return { state: 'finished', reason: 'category_status', qtyAvailable: qty };
  if (!input.tracked) return { state: 'available', reason: null, qtyAvailable: qty };
  if (qty <= 0) return { state: 'finished', reason: 'stock', qtyAvailable: qty };
  if (qty <= LAST_FEW_SERVES) return { state: 'last_few', reason: 'stock', qtyAvailable: qty };
  if (qty <= input.threshold) return { state: 'low', reason: 'stock', qtyAvailable: qty };
  return { state: 'available', reason: null, qtyAvailable: qty };
}

/**
 * Whole serves available from stock on hand. docs/05-flows-and-channels.md section 2.4: a serve
 * depletes `qty x depletion_factor` of its stock unit, so depletion_factor is the bottle fraction one
 * serve consumes. A 30ml tot from a 750ml bottle is 0.04, giving 25 tots a bottle. A deliberately
 * generous house pour is stored as a larger factor rather than showing as permanent variance.
 * Fractions of a serve cannot be poured, so this floors.
 */
export function servesFromStock(stockUnits: number, depletionFactor: number): number {
  if (depletionFactor <= 0) return 0;
  return Math.floor((stockUnits + 1e-9) / depletionFactor);
}

/** The bottle fraction a serve consumes, from its volume and the container volume. */
export function depletionFactorFor(serveVolumeMl: number, containerVolumeMl: number): number {
  if (containerVolumeMl <= 0) return 0;
  return serveVolumeMl / containerVolumeMl;
}

/** A tile is tappable in every state except finished. */
export function isSellable(state: AvailabilityState): boolean {
  return state !== 'finished';
}
