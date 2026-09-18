import { describe, expect, it } from 'vitest';
import { businessDate, businessDayWindow } from './business-date';
import { zonedInstant, parseClock, zonedParts } from './zoned';

const NAIROBI = 'Africa/Nairobi';
const at = (date: string, clock: string) => zonedInstant(date, parseClock(clock), NAIROBI);

describe('businessDate', () => {
  it('puts a 01:47 sale on the previous calendar date with a 05:00 cutover', () => {
    expect(businessDate(at('2026-09-06', '01:47'), NAIROBI, '05:00')).toBe('2026-09-05');
  });

  it('keeps a 22:41 sale on its own calendar date', () => {
    expect(businessDate(at('2026-09-05', '22:41'), NAIROBI, '05:00')).toBe('2026-09-05');
  });

  it('flips exactly at the cutover', () => {
    expect(businessDate(at('2026-09-06', '04:59:59'), NAIROBI)).toBe('2026-09-05');
    expect(businessDate(at('2026-09-06', '05:00'), NAIROBI)).toBe('2026-09-06');
  });

  it('crosses a month boundary', () => {
    expect(businessDate(at('2026-10-01', '02:00'), NAIROBI)).toBe('2026-09-30');
  });

  it('does not move a stored value when the cutover later changes', () => {
    const sale = at('2026-09-06', '04:30');
    const stored = { occurredAt: sale, businessDate: businessDate(sale, NAIROBI, '05:00') };
    // The outlet moves its cutover to 04:00. New writes use it. The stored row is not recomputed.
    const laterWrite = businessDate(sale, NAIROBI, '04:00');
    expect(laterWrite).toBe('2026-09-06');
    expect(stored.businessDate).toBe('2026-09-05');
  });
});

describe('zoned helpers', () => {
  it('reads Nairobi wall clock time from a UTC instant', () => {
    const parts = zonedParts(Date.UTC(2026, 8, 5, 19, 41, 7, 250), NAIROBI);
    expect(parts).toMatchObject({ year: 2026, month: 9, day: 5, hour: 22, minute: 41, second: 7, millisecond: 250, weekday: 6 });
  });

  it('computes the business day window', () => {
    const { start, end } = businessDayWindow('2026-09-05', NAIROBI, '05:00');
    expect(new Date(start).toISOString()).toBe('2026-09-05T02:00:00.000Z');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });
});
