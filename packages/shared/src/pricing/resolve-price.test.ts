import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PriceList, PriceListItem, PriceRule } from '../domain';
import { cents, shillings, sum } from '../money/cents';
import { parseClock, zonedInstant } from '../time/zoned';
import { allocateBillDiscount, createPricingIndex, resolvePrice, tryResolvePrice } from './resolve-price';
import { ruleCoversInstant } from './time-rules';

const TZ = 'Africa/Nairobi';
const at = (date: string, clock: string, ms = 0) => zonedInstant(date, parseClock(clock), TZ) + ms;

const list = (id: string, name: string, kind: PriceList['kind'], priority = 0): PriceList => ({
  id,
  outletId: 'o',
  name,
  kind,
  priority,
  effectiveFrom: null,
  effectiveTo: null,
  status: 'active',
});
const item = (priceListId: string, productVariantId: string, shs: number, minQty: number | null = null): PriceListItem => ({
  id: `${priceListId}-${productVariantId}-${minQty ?? 0}`,
  priceListId,
  productVariantId,
  priceCents: shillings(shs),
  minQty,
  status: 'active',
});
const rule = (over: Partial<PriceRule>): PriceRule => ({
  id: 'r-happy',
  outletId: 'o',
  name: 'Happy hour',
  priceListId: 'happy',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '17:00',
  endTime: '19:00',
  crossesMidnight: false,
  appliesTo: 'category',
  targetIds: ['beer'],
  priority: 10,
  effectiveFrom: null,
  effectiveTo: null,
  status: 'active',
  ...over,
});

const index = createPricingIndex({
  products: [
    { id: 'tusker', categoryId: 'beer', status: 'active' },
    { id: 'gilbeys', categoryId: 'spirits', status: 'active' },
  ],
  variants: [
    { id: 'tusker-500', productId: 'tusker', kind: 'sealed', serveVolumeMl: null, isDefault: true, status: 'active' },
    { id: 'gilbeys-tot', productId: 'gilbeys', kind: 'serve', serveVolumeMl: 30, isDefault: true, status: 'active' },
    { id: 'gilbeys-double', productId: 'gilbeys', kind: 'serve', serveVolumeMl: 60, isDefault: false, status: 'active' },
  ],
  priceLists: [list('standard', 'Standard', 'base'), list('happy', 'Happy hour', 'overlay', 10)],
  priceListItems: [
    item('standard', 'tusker-500', 350),
    item('standard', 'tusker-500', 330, 12),
    item('standard', 'gilbeys-tot', 250),
    item('happy', 'tusker-500', 300),
  ],
  priceRules: [rule({})],
});

describe('time rules', () => {
  // 2026-09-04 is a Friday.
  it('applies at 18:59:59.999 and not at 19:00:00.000', () => {
    expect(ruleCoversInstant(rule({}), at('2026-09-04', '18:59:59', 999), TZ)).toBe(true);
    expect(ruleCoversInstant(rule({}), at('2026-09-04', '19:00:00', 0), TZ)).toBe(false);
  });

  it('treats 22:00 to 02:00 on Friday as one window', () => {
    const late = rule({ daysOfWeek: [5], startTime: '22:00', endTime: '02:00', crossesMidnight: true });
    expect(ruleCoversInstant(late, at('2026-09-04', '23:15'), TZ)).toBe(true);
    expect(ruleCoversInstant(late, at('2026-09-05', '01:30'), TZ)).toBe(true);
    expect(ruleCoversInstant(late, at('2026-09-05', '02:00'), TZ)).toBe(false);
    expect(ruleCoversInstant(late, at('2026-09-05', '23:15'), TZ)).toBe(false);
    expect(ruleCoversInstant(late, at('2026-09-04', '01:30'), TZ)).toBe(false);
  });
});

describe('resolvePrice', () => {
  it('prices a line fired at 18:59:59 at happy hour, and that price is what is stored (R4)', () => {
    const fired = resolvePrice(index, { variantId: 'tusker-500', qty: 2, at: at('2026-09-04', '18:59:59'), timeZone: TZ });
    expect(fired.unitPriceCents).toBe(shillings(300));
    expect(fired.lineTotalCents).toBe(shillings(600));
    expect(fired.appliedRuleName).toBe('Happy hour');
    // Settlement at 21:30 reads the stored line. Re-resolving at settlement would be the bug.
    const wrong = resolvePrice(index, { variantId: 'tusker-500', qty: 2, at: at('2026-09-04', '21:30'), timeZone: TZ });
    expect(wrong.lineTotalCents).toBe(shillings(700));
  });

  it('derives a double from the tot price through the serve size', () => {
    const double = resolvePrice(index, { variantId: 'gilbeys-double', qty: 1, at: at('2026-09-04', '21:00'), timeZone: TZ });
    expect(double.unitPriceCents).toBe(shillings(500));
    expect(double.derivation.map((s) => s.label)).toEqual(['Standard', 'Serve size', 'Quantity']);
  });

  it('uses case pricing at the bottle counter from the minimum quantity', () => {
    const crate = resolvePrice(index, { variantId: 'tusker-500', qty: 24, at: at('2026-09-06', '12:00'), timeZone: TZ });
    expect(crate.unitPriceCents).toBe(shillings(330));
  });

  it('adds modifiers, then applies a line discount and a bill share in order', () => {
    const line = resolvePrice(index, {
      variantId: 'gilbeys-tot',
      qty: 2,
      at: at('2026-09-06', '21:00'),
      timeZone: TZ,
      modifiers: [{ name: 'Tonic', priceDeltaCents: shillings(150), qty: 1 }],
      lineDiscount: { kind: 'rate', basisPoints: 1000, label: 'Staff discount' },
      billDiscountShareCents: cents(1234),
    });
    expect(line.unitPriceCents).toBe(shillings(400));
    expect(line.lineTotalCents).toBe(cents(80000 - 8000 - 1234));
    expect(line.derivation.map((s) => s.label)).toEqual(['Standard', 'Tonic', 'Quantity', 'Staff discount', 'Bill discount share']);
  });

  it('returns null rather than throwing for an unpriced variant when asked to', () => {
    expect(tryResolvePrice(index, { variantId: 'nothing', qty: 1, at: 0, timeZone: TZ })).toBeNull();
  });

  it('is deterministic and byte identical across calls (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 0, 1) }),
        fc.constantFrom('tusker-500', 'gilbeys-tot', 'gilbeys-double'),
        fc.integer({ min: 1, max: 30 }),
        (instant, variantId, qty) => {
          const a = resolvePrice(index, { variantId, qty, at: instant, timeZone: TZ });
          const b = resolvePrice(index, { variantId, qty, at: instant, timeZone: TZ });
          expect(JSON.stringify(a, (_, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(
            JSON.stringify(b, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
          );
        },
      ),
      { numRuns: 2000 },
    );
  });
});

describe('allocateBillDiscount', () => {
  it('allocates a bill discount across five lines to the cent (R4)', () => {
    const lines = [shillings(700), shillings(500), shillings(650), shillings(380), shillings(900)];
    const shares = allocateBillDiscount(lines, shillings(314));
    expect(sum(shares)).toBe(shillings(314));
  });

  it('always reconciles (property, 10,000 bills)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5_000_000 }), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 100 }),
        (totals, pct) => {
          const lineTotals = totals.map((t) => cents(t));
          const subtotal = sum(lineTotals);
          const discount = cents((subtotal * BigInt(pct)) / 100n);
          expect(sum(allocateBillDiscount(lineTotals, discount))).toBe(discount);
        },
      ),
      { numRuns: 10_000 },
    );
  });
});
