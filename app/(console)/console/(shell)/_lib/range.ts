import 'server-only';

import { formatIsoDate } from '@bliss/shared/format';
import { type IsoDate, addDays, businessDayWindow } from '@bliss/shared/time';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';

export type RangeKey = 'tonight' | '1' | '7' | '28' | '56';

export interface BusinessRange {
  key: RangeKey;
  from: IsoDate;
  to: IsoDate;
  /** Epoch bounds of the business days, cutover to cutover. */
  start: number;
  end: number;
  label: string;
  /** The same number of business days immediately before, for a comparison. */
  previous: { from: IsoDate; to: IsoDate };
}

const DAYS: Record<Exclude<RangeKey, 'tonight'>, number> = { '1': 1, '7': 7, '28': 28, '56': 56 };

/**
 * Report ranges are business days, never calendar days: a sale at 01:47 belongs to the night before.
 * "Last night" is the most recent business day whose trading has finished. docs/01 R11.
 */
export function businessRange(param: string | undefined, fallback: RangeKey = '7'): BusinessRange {
  const clock = reporting.clock();
  const outlet = identity.outlet();
  const key = (param && (param === 'tonight' || param in DAYS) ? param : fallback) as RangeKey;
  const to = key === 'tonight' ? clock.current : clock.lastNight;
  const days = key === 'tonight' ? 1 : DAYS[key];
  const earliest = clock.first;
  const wanted = addDays(to, -(days - 1));
  const from = wanted < earliest ? earliest : wanted;
  const previousTo = addDays(from, -1);
  return {
    key,
    from,
    to,
    start: businessDayWindow(from, outlet.timezone, outlet.businessDayCutover).start,
    end: businessDayWindow(to, outlet.timezone, outlet.businessDayCutover).end,
    label: from === to ? formatIsoDate(to) : `${formatIsoDate(from)} to ${formatIsoDate(to)}`,
    previous: { from: addDays(previousTo, -(days - 1)), to: previousTo },
  };
}

export function rangeOptions(includeTonight: boolean) {
  const clock = reporting.clock();
  return [
    ...(includeTonight && clock.tradingInProgress ? [{ value: 'tonight', label: 'Tonight so far' }] : []),
    { value: '1', label: 'Last night' },
    { value: '7', label: 'Last 7 business days' },
    { value: '28', label: 'Last 28 business days' },
    { value: '56', label: 'Last 56 business days' },
  ];
}
