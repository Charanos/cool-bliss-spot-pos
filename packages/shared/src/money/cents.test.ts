import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Cents,
  add,
  allocate,
  cents,
  changeDue,
  fromJSON,
  interpolate,
  multiplyByQuantity,
  multiplyByRate,
  roundToShilling,
  roundUpTo,
  weightedAverage,
  scale,
  shillings,
  subtract,
  sum,
  toJSON,
} from './cents';
import { formatDecimal, formatFigure, formatKes, formatKesCompact, parseKes } from './format';

const total = (parts: Cents[]) => sum(parts);

describe('allocate', () => {
  it('splits 1000 cents three ways and sums back to exactly 1000', () => {
    const parts = allocate(cents(1000), 3);
    expect(parts.map(String)).toEqual(['334', '333', '333']);
    expect(total(parts)).toBe(1000n);
  });

  it('splits 1333 cents seven ways and sums back to exactly 1333', () => {
    const parts = allocate(cents(1333), 7);
    expect(total(parts)).toBe(1333n);
    expect(parts.filter((p) => p === 191n)).toHaveLength(3);
    expect(parts.filter((p) => p === 190n)).toHaveLength(4);
  });

  it('splits a 1,333 shilling bill four ways and the bills sum to 1,333 (R5)', () => {
    const parts = allocate(shillings(1333), 4);
    expect(total(parts)).toBe(shillings(1333));
  });

  it('gives the extra cent to the first seats, as the even split flow specifies', () => {
    // KES 2,101.00 across 3 seats: one seat pays 700.34, two pay 700.33.
    const parts = allocate(shillings(2101), 3);
    expect(parts.map((p) => formatFigure(p))).toEqual(['700.34', '700.33', '700.33']);
  });

  it('reconciles exactly for any amount and seat count (property, 10,000 runs)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -10_000_000_000n, max: 10_000_000_000n }), fc.integer({ min: 1, max: 40 }), (amount, n) => {
        const parts = allocate(cents(amount), n);
        expect(parts).toHaveLength(n);
        expect(total(parts)).toBe(amount);
        const spread = parts.reduce((m, p) => (p > m ? p : m), parts[0]!) - parts.reduce((m, p) => (p < m ? p : m), parts[0]!);
        expect(spread <= 1n).toBe(true);
      }),
      { numRuns: 10_000 },
    );
  });

  it('allocates by weight and always reconciles (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 5_000_000n }),
        fc.array(fc.bigInt({ min: 0n, max: 2_000_000n }), { minLength: 1, maxLength: 25 }),
        (amount, weights) => {
          const parts = allocate(cents(amount), weights);
          expect(total(parts)).toBe(amount);
        },
      ),
      { numRuns: 2_000 },
    );
  });
});

describe('arithmetic', () => {
  it('adds and subtracts without losing precision above 2^53', () => {
    const big = cents(9_007_199_254_740_993n);
    expect(subtract(add(big, cents(7)), cents(7))).toBe(big);
  });

  it('refuses a fractional number', () => {
    expect(() => cents(10.5)).toThrow(TypeError);
  });

  it('applies a rate half up', () => {
    expect(multiplyByRate(shillings(4200), 1000)).toBe(shillings(420));
    expect(multiplyByRate(cents(5), 5000)).toBe(3n); // 2.5 rounds up
    expect(multiplyByRate(cents(-5), 5000)).toBe(-3n); // half away from zero
  });

  it('scales a tot price to a double', () => {
    expect(scale(shillings(250), 60n, 30n)).toBe(shillings(500));
  });

  it('rounds to the nearest shilling once, half up', () => {
    expect(roundToShilling(cents(70034))).toEqual({ rounded: 70000n, rounding: -34n });
    expect(roundToShilling(cents(70050))).toEqual({ rounded: 70100n, rounding: 50n });
  });

  it('never returns negative change', () => {
    expect(changeDue(shillings(500), shillings(700))).toBe(0n);
    expect(changeDue(shillings(1000), shillings(500))).toBe(shillings(500));
  });

  it('values a fractional bottle at cost to the cent', () => {
    expect(multiplyByQuantity(shillings(1480), 0.4)).toBe(shillings(592));
    expect(multiplyByQuantity(shillings(1480), -1.25)).toBe(shillings(-1850));
  });

  it('blends a moving average cost', () => {
    expect(weightedAverage([[shillings(200), 10], [shillings(230), 30]])).toBe(cents(22250));
  });

  it('rounds a cash tender up to the next note', () => {
    expect(roundUpTo(shillings(1150), shillings(500))).toBe(shillings(1500));
    expect(roundUpTo(shillings(1000), shillings(500))).toBe(shillings(1000));
  });

  it('interpolates for display with integer maths only', () => {
    expect(interpolate(cents(0), cents(70000), 5000)).toBe(35000n);
    expect(interpolate(cents(100), cents(0), 10_000)).toBe(0n);
  });
});

describe('format and parse', () => {
  it('formats with grouping and two decimals', () => {
    expect(formatKes(cents(1245000))).toBe('KES 12,450.00');
    expect(formatFigure(cents(-70000))).toBe('-700.00');
    expect(formatKes(shillings(4200), { decimals: 'whole' })).toBe('KES 4,200');
    expect(formatDecimal(cents(-5))).toBe('-0.05');
  });

  it('formats a compact figure for a glance, half up to one decimal', () => {
    expect(formatKesCompact(shillings(640))).toBe('KES 640');
    expect(formatKesCompact(shillings(54120))).toBe('KES 54.1k');
    expect(formatKesCompact(shillings(54150))).toBe('KES 54.2k');
    expect(formatKesCompact(shillings(12000))).toBe('KES 12k');
    expect(formatKesCompact(shillings(999_960))).toBe('KES 1m');
    expect(formatKesCompact(shillings(1_250_000))).toBe('KES 1.3m');
    expect(formatKesCompact(shillings(-2400))).toBe('KES -2.4k');
  });

  it('parses what a cashier types', () => {
    expect(parseKes('12,450')).toBe(1245000n);
    expect(parseKes('KES 700.5')).toBe(70050n);
    expect(parseKes('-3.25')).toBe(-325n);
    expect(() => parseKes('1.005')).toThrow();
    expect(() => parseKes('12,45')).toThrow();
  });

  it('round trips through JSON as a string', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(2n ** 62n), max: 2n ** 62n }), (n) => {
        const json = toJSON(cents(n));
        expect(typeof json).toBe('string');
        expect(fromJSON(json)).toBe(n);
      }),
    );
  });

  it('round trips format and parse (property)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -1_000_000_000n, max: 1_000_000_000n }), (n) => {
        expect(parseKes(formatFigure(cents(n)))).toBe(n);
      }),
    );
  });
});
