import type { EpochMs } from '../domain';
import { DEFAULT_TIME_ZONE, type IsoDate, zonedParts } from '../time/zoned';

/**
 * Presentation formats from docs/08-ux-copy.md section 1, Register:
 * 24 hour clock everywhere, dates as 6 Sep 2026, money as KES 12,450.00.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 6 Sep 2026 */
export function formatDate(at: EpochMs, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = zonedParts(at, timeZone);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** 6 Sep 2026, from a stored business date. */
export function formatIsoDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Sat 6 Sep */
export function formatDayShort(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[js === 0 ? 7 : js]} ${d} ${MONTHS[m - 1]}`;
}

/** Saturday */
export function formatWeekday(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS_LONG[js === 0 ? 7 : js] ?? '';
}

/** 22:41 */
export function formatTime(at: EpochMs, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = zonedParts(at, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** 22:41:07 */
export function formatTimeSeconds(at: EpochMs, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = zonedParts(at, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** 6 Sep 2026 · 22:41 */
export function formatDateTime(at: EpochMs, timeZone: string = DEFAULT_TIME_ZONE): string {
  return `${formatDate(at, timeZone)} · ${formatTime(at, timeZone)}`;
}

/** Elapsed time as the Floor shows it: 4h12, 0h38. Never negative. */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
}

/** "2 min ago", "just now", "1h04 ago", for the bar ticket and activity rows. */
export function formatAgo(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${formatElapsed(ms)} ago`;
}

/** "1 line", "3 lines". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Whole numbers with grouping: 1,284 */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-KE');
}

/** Basis points as a percentage with one decimal: 6240 -> 62.4% */
export function formatBps(bps: number, options: { signed?: boolean } = {}): string {
  const sign = options.signed && bps > 0 ? '+' : bps < 0 ? '-' : '';
  const abs = Math.abs(bps);
  return `${sign}${Math.floor(abs / 100)}.${Math.floor((abs % 100) / 10)}%`;
}

/** Quantities that may be fractional, such as bottles in a count: 1.4, 12, 0.25 */
export function formatQty(value: number, maxDecimals = 2): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toLocaleString('en-KE', { maximumFractionDigits: maxDecimals });
}

/** Join names in plain English: "Seat 2 and Seat 3", "A, B and C". */
export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
