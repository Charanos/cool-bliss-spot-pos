import { DEFAULT_TIME_ZONE, type IsoDate, addDays, isoDate, msOfDay, parseClock, zonedInstant, zonedParts } from './zoned';

/**
 * docs/01-product-spec.md R11. A trading day is defined by an outlet cutover time, not midnight.
 * With a 05:00 cutover a sale at 01:47 belongs to the previous calendar date's business day.
 *
 * business_date is computed once, at write time, and stored. It is never recomputed on read, which
 * is what keeps historic values still when the cutover configuration later changes.
 */
export function businessDate(at: Date | number, timeZone: string = DEFAULT_TIME_ZONE, cutover = '05:00'): IsoDate {
  const parts = zonedParts(at, timeZone);
  const date = isoDate(parts.year, parts.month, parts.day);
  return msOfDay(parts) < parseClock(cutover) ? addDays(date, -1) : date;
}

/** The half-open UTC window [start, end) that a business date covers. */
export function businessDayWindow(
  date: IsoDate,
  timeZone: string = DEFAULT_TIME_ZONE,
  cutover = '05:00',
): { start: number; end: number } {
  const cut = parseClock(cutover);
  return {
    start: zonedInstant(date, cut, timeZone),
    end: zonedInstant(addDays(date, 1), cut, timeZone),
  };
}
