/**
 * Money, per ADR-009 and docs/01-product-spec.md R5.
 *
 * Every monetary value is a signed 64 bit integer of KES cents, branded so it cannot be mixed
 * with a plain number or bigint by accident. No floating point arithmetic touches money here.
 * Rounding happens once, at tender, half up to the nearest shilling (see roundToShilling).
 *
 * This file is the only place raw operators are applied to Cents. The bliss/no-cents-arithmetic
 * lint rule exempts this directory and bans raw operators everywhere else.
 */

export type Cents = bigint & { readonly __brand: 'Cents' };

const INT64_MAX = 9_223_372_036_854_775_807n;
const INT64_MIN = -9_223_372_036_854_775_808n;

function brand(value: bigint): Cents {
  if (value > INT64_MAX || value < INT64_MIN) {
    throw new RangeError(`Money value ${value} does not fit a 64 bit integer`);
  }
  return value as Cents;
}

export const ZERO: Cents = brand(0n);

/** Build Cents from an integer count of cents. Numbers must be safe integers. */
export function cents(value: bigint | number | string): Cents {
  if (typeof value === 'bigint') return brand(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Cents must be built from a safe integer, received ${value}`);
    }
    return brand(BigInt(value));
  }
  if (!/^-?\d+$/.test(value)) {
    throw new TypeError(`Cents string must be an integer count of cents, received "${value}"`);
  }
  return brand(BigInt(value));
}

/** Whole shillings to cents. */
export function shillings(value: bigint | number): Cents {
  const whole = typeof value === 'number' ? cents(value) : brand(value);
  return brand(whole * 100n);
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'bigint';
}

export function add(...values: readonly Cents[]): Cents {
  let total = 0n;
  for (const v of values) total += v;
  return brand(total);
}

export function sum(values: Iterable<Cents>): Cents {
  let total = 0n;
  for (const v of values) total += v;
  return brand(total);
}

export function subtract(a: Cents, b: Cents): Cents {
  return brand(a - b);
}

export function negate(a: Cents): Cents {
  return brand(-a);
}

export function abs(a: Cents): Cents {
  return brand(a < 0n ? -a : a);
}

export function compare(a: Cents, b: Cents): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isZero(a: Cents): boolean {
  return a === 0n;
}

export function isNegative(a: Cents): boolean {
  return a < 0n;
}

export function isPositive(a: Cents): boolean {
  return a > 0n;
}

export function max(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

export function min(a: Cents, b: Cents): Cents {
  return a <= b ? a : b;
}

/** Integer division rounding half away from zero. Denominator must be positive. */
function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Denominator must be positive');
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const quotient = n / denominator;
  const remainder = n - quotient * denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** Multiply a unit price by a whole quantity. */
export function multiplyByQty(unit: Cents, qty: number): Cents {
  if (!Number.isSafeInteger(qty)) {
    throw new TypeError(`Quantity must be a whole number, received ${qty}`);
  }
  return brand(unit * BigInt(qty));
}

/** Scale by a rational numerator / denominator, half up. Used for serve size multipliers. */
export function scale(value: Cents, numerator: bigint, denominator: bigint): Cents {
  return brand(divideHalfUp(value * numerator, denominator));
}

/**
 * Multiply by a fractional quantity, such as 0.4 of a bottle at cost. The quantity is fixed to four
 * decimal places, the precision of numeric(14,4) in the data model, then applied in integers, half up.
 */
export function multiplyByQuantity(unit: Cents, quantity: number): Cents {
  if (!Number.isFinite(quantity)) throw new TypeError(`Quantity must be finite, received ${quantity}`);
  const fixed = BigInt(Math.round(quantity * 10_000));
  return brand(divideHalfUp(unit * fixed, 10_000n));
}

/** Weighted average of unit costs, for moving average cost on receipt. Weights in ten-thousandths. */
export function weightedAverage(entries: readonly (readonly [Cents, number])[]): Cents {
  let numerator = 0n;
  let denominator = 0n;
  for (const [value, weight] of entries) {
    const w = BigInt(Math.max(0, Math.round(weight * 10_000)));
    numerator += value * w;
    denominator += w;
  }
  if (denominator === 0n) return entries[0]?.[0] ?? ZERO;
  return brand(divideHalfUp(numerator, denominator));
}

/** Round up to a multiple of a step, for the note a guest hands over: 1,150 in 500s is 1,500. */
export function roundUpTo(value: Cents, step: Cents): Cents {
  if (step <= 0n) throw new RangeError('Step must be positive');
  const quotient = (value + step - 1n) / step;
  return brand(quotient * step);
}

/** Change from one amount to another in basis points, half up. 200.00 to 212.00 is 600 (6%). */
export function percentChangeBps(from: Cents, to: Cents): number {
  if (from === 0n) return 0;
  const magnitude = from < 0n ? -from : from;
  return Number(divideHalfUp((to - from) * 10_000n, magnitude));
}

/** A share of a whole in basis points, half up. 620.00 of 1,000.00 is 6200. */
export function shareBps(part: Cents, whole: Cents): number {
  if (whole === 0n) return 0;
  const negative = (part < 0n) !== (whole < 0n);
  const p = part < 0n ? -part : part;
  const w = whole < 0n ? -whole : whole;
  const bps = Number(divideHalfUp(p * 10_000n, w));
  return negative ? -bps : bps;
}

/** Apply a rate in basis points (1% = 100 bps), half up. 10% of 4,200.00 is 420.00. */
export function multiplyByRate(value: Cents, basisPoints: number): Cents {
  if (!Number.isSafeInteger(basisPoints)) {
    throw new TypeError(`Basis points must be a whole number, received ${basisPoints}`);
  }
  return brand(divideHalfUp(value * BigInt(basisPoints), 10_000n));
}

/**
 * Split an amount into parts using the largest remainder method, so the parts always sum back
 * to the total exactly. See docs/04-data-model.md, "Even split with exact reconciliation".
 *
 * With a count, every part gets the integer base and the first `remainder` parts get one more
 * cent each. With weights, parts are proportional and leftover cents go to the largest
 * fractional remainders, ties broken by position so the result is deterministic.
 */
export function allocate(total: Cents, partsOrWeights: number | readonly bigint[]): Cents[] {
  const negative = total < 0n;
  const amount = negative ? -total : total;

  let shares: bigint[];
  if (typeof partsOrWeights === 'number') {
    const n = partsOrWeights;
    if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('Allocate needs at least one part');
    const count = BigInt(n);
    const base = amount / count;
    const remainder = amount - base * count;
    shares = Array.from({ length: n }, (_, i) => (BigInt(i) < remainder ? base + 1n : base));
  } else {
    const weights = partsOrWeights;
    if (weights.length === 0) throw new RangeError('Allocate needs at least one weight');
    if (weights.some((w) => w < 0n)) throw new RangeError('Weights must not be negative');
    const weightTotal = weights.reduce((a, w) => a + w, 0n);
    if (weightTotal === 0n) return allocate(total, weights.length);
    const floors = weights.map((w) => (amount * w) / weightTotal);
    const fractions = weights.map((w, i) => ({ index: i, remainder: (amount * w) % weightTotal }));
    let leftover = amount - floors.reduce((a, f) => a + f, 0n);
    fractions.sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));
    shares = [...floors];
    for (const f of fractions) {
      if (leftover === 0n) break;
      shares[f.index] = (shares[f.index] ?? 0n) + 1n;
      leftover -= 1n;
    }
  }

  const result = shares.map((s) => brand(negative ? -s : s));
  const check = result.reduce((a, s) => a + s, 0n);
  if (check !== total) throw new Error(`Allocation of ${total} does not reconcile: ${check}`);
  return result;
}

/**
 * Round half up to the nearest shilling, applied once at tender.
 * Returns the rounded amount and the rounding adjustment so the bill can store both.
 */
export function roundToShilling(value: Cents): { rounded: Cents; rounding: Cents } {
  const rounded = brand(divideHalfUp(value, 100n) * 100n);
  return { rounded, rounding: brand(rounded - value) };
}

/** Whole shilling part and the cents remainder, for display only. */
export function splitParts(value: Cents): { negative: boolean; shillings: bigint; cents: bigint } {
  const negative = value < 0n;
  const a = negative ? -value : value;
  return { negative, shillings: a / 100n, cents: a % 100n };
}

/** Change due on a cash tender. Never negative. */
export function changeDue(tendered: Cents, due: Cents): Cents {
  const diff = tendered - due;
  return brand(diff > 0n ? diff : 0n);
}

/**
 * Interpolate for display tweens without touching floats: progress is a whole number of
 * ten-thousandths from 0 to 10000. The returned value is only ever rendered, never stored.
 */
export function interpolate(from: Cents, to: Cents, progressTenThousandths: number): Cents {
  const p = BigInt(Math.max(0, Math.min(10_000, Math.round(progressTenThousandths))));
  return brand(from + ((to - from) * p) / 10_000n);
}

/** JSON carries money as a string, to survive the 53 bit limit. */
export function toJSON(value: Cents): string {
  return value.toString();
}

export function fromJSON(value: string): Cents {
  return cents(value);
}
