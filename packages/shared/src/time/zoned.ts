/**
 * Time zone helpers. Storage is UTC. Presentation and business rules use the outlet's IANA zone,
 * Africa/Nairobi at launch. Built on Intl so the browser and the server agree to the millisecond.
 */

export const DEFAULT_TIME_ZONE = 'Africa/Nairobi';

export interface ZonedParts {
  year: number;
  month: number; // 1 to 12
  day: number;
  /** ISO weekday, 1 Monday to 7 Sunday. */
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(at: Date | number, timeZone: string = DEFAULT_TIME_ZONE): ZonedParts {
  const epoch = typeof at === 'number' ? at : at.getTime();
  const parts = formatterFor(timeZone).formatToParts(epoch);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAYS[get('weekday')] ?? 1,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    millisecond: ((epoch % 1000) + 1000) % 1000,
  };
}

/** Milliseconds since local midnight in the zone. */
export function msOfDay(parts: ZonedParts): number {
  return ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 + parts.millisecond;
}

/** Parse "HH:MM" or "HH:MM:SS" into milliseconds since midnight. */
export function parseClock(value: string): number {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new TypeError(`"${value}" is not a 24 hour time`);
  const [, h, m, s = '0'] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  if (hours > 23 || minutes > 59 || seconds > 59) throw new RangeError(`"${value}" is out of range`);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

/** A calendar date as YYYY-MM-DD, the storage shape of business_date. */
export type IsoDate = string;

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** ISO weekday of a calendar date, 1 Monday to 7 Sunday. */
export function weekdayOf(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

/**
 * The UTC instant of a wall clock time on a date in a zone. Nairobi has no daylight saving, but
 * this resolves the offset from Intl rather than assuming it, so another zone still works.
 */
export function zonedInstant(date: IsoDate, clockMs: number, timeZone: string = DEFAULT_TIME_ZONE): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d) + clockMs;
  const parts = zonedParts(guess, timeZone);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day) + msOfDay(parts);
  const offset = asIfUtc - guess;
  return guess - offset;
}
