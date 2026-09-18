import type { EpochMs, PriceRule } from '../domain';
import { msOfDay, parseClock, zonedParts } from '../time/zoned';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function previousWeekday(weekday: number): number {
  return weekday === 1 ? 7 : weekday - 1;
}

function isEffective(rule: Pick<PriceRule, 'effectiveFrom' | 'effectiveTo' | 'status'>, at: EpochMs): boolean {
  if (rule.status !== 'active') return false;
  if (rule.effectiveFrom !== null && at < rule.effectiveFrom) return false;
  if (rule.effectiveTo !== null && at >= rule.effectiveTo) return false;
  return true;
}

/**
 * Does a time rule cover this instant? Windows are half open, [start, end), to the millisecond:
 * with a 17:00 to 19:00 window, 18:59:59.999 applies and 19:00:00.000 does not.
 *
 * A window that crosses midnight belongs to the day it starts on. 22:00 to 02:00 on Friday is one
 * window, so Saturday 01:30 is inside it when Friday is listed, whether or not Saturday is.
 */
export function ruleCoversInstant(rule: PriceRule, at: EpochMs, timeZone: string): boolean {
  if (!isEffective(rule, at)) return false;
  const parts = zonedParts(at, timeZone);
  const t = msOfDay(parts);
  const start = parseClock(rule.startTime);
  const end = parseClock(rule.endTime);
  const days = rule.daysOfWeek;

  if (!rule.crossesMidnight) {
    return days.includes(parts.weekday) && t >= start && t < end;
  }
  const lateSameDay = days.includes(parts.weekday) && t >= start;
  const earlyNextDay = days.includes(previousWeekday(parts.weekday)) && t < end;
  return lateSameDay || earlyNextDay;
}

function dayRange(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  const contiguous = sorted.every((d, i) => i === 0 || d === (sorted[i - 1] ?? 0) + 1);
  if (contiguous && sorted.length > 2) return `${DAY_NAMES[sorted[0] ?? 1]} to ${DAY_NAMES[sorted[sorted.length - 1] ?? 7]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

/** "Mon to Fri, 17:00 to 19:00" */
export function describeRuleWindow(rule: Pick<PriceRule, 'daysOfWeek' | 'startTime' | 'endTime'>): string {
  return `${dayRange(rule.daysOfWeek)}, ${rule.startTime.slice(0, 5)} to ${rule.endTime.slice(0, 5)}`;
}
