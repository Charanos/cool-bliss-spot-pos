import { describe, expect, it } from 'vitest';
import { parseClock, zonedInstant } from '../time/zoned';
import { formatAgo, formatBps, formatDate, formatElapsed, formatIsoDate, formatTime, listJoin, plural } from './index';

const TZ = 'Africa/Nairobi';

describe('format', () => {
  it('writes dates as 6 Sep 2026 and times on a 24 hour clock', () => {
    const t = zonedInstant('2026-09-06', parseClock('22:41'), TZ);
    expect(formatDate(t, TZ)).toBe('6 Sep 2026');
    expect(formatTime(t, TZ)).toBe('22:41');
    expect(formatIsoDate('2026-09-06')).toBe('6 Sep 2026');
  });

  it('writes elapsed shift time as 4h12', () => {
    expect(formatElapsed((4 * 60 + 12) * 60_000)).toBe('4h12');
    expect(formatElapsed(38 * 60_000)).toBe('0h38');
  });

  it('writes ages for tickets', () => {
    expect(formatAgo(20_000)).toBe('just now');
    expect(formatAgo(2 * 60_000)).toBe('2 min ago');
  });

  it('pluralises counts', () => {
    expect(plural(1, 'line')).toBe('1 line');
    expect(plural(3, 'line')).toBe('3 lines');
  });

  it('formats percentages from basis points without floats in the output', () => {
    expect(formatBps(6240)).toBe('62.4%');
    expect(formatBps(800, { signed: true })).toBe('+8.0%');
    expect(formatBps(-640)).toBe('-6.4%');
  });

  it('joins lists in plain English', () => {
    expect(listJoin(['Seat 2', 'Seat 3'])).toBe('Seat 2 and Seat 3');
    expect(listJoin(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
