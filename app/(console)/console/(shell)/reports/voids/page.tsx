import { ZERO, add, compare } from '@bliss/shared/money';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { ViewHeader } from '../../_components/workspace';
import { businessRange, rangeOptions } from '../../_lib/range';
import { VoidsView } from './voids-view';

export const metadata: Metadata = { title: 'Voids and discounts' };

/** N-08: void and discount rates by staff member, with the reasons they gave, so a pattern is visible. */
export default async function VoidsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const tz = identity.outlet().timezone;
  const rows = reporting.voidsByStaff(range.from, range.to);
  // Reasons as people wrote them, grouped loosely: case and a trailing full stop do not split one.
  const byReason = new Map<string, { label: string; value: typeof ZERO; count: number }>();
  for (const line of trade.voidedBetween(range.from, range.to)) {
    const label = (line.voidReason ?? 'No reason given').trim().replace(/\.$/, '');
    const key = label.toLowerCase();
    const entry = byReason.get(key) ?? { label, value: ZERO, count: 0 };
    entry.value = add(entry.value, line.lineTotalCents);
    entry.count += 1;
    byReason.set(key, entry);
  }
  const reasons = [...byReason.entries()]
    .map(([key, r]) => ({ key, ...r }))
    .sort((a, b) => compare(b.value, a.value))
    .slice(0, 8);
  return (
    <>
      <ViewHeader page="/console/reports/voids" />
      <VoidsView rows={rows} reasons={reasons} rangeKey={range.key} rangeLabel={range.label} rangeOptions={rangeOptions(false)} timezone={tz} exportDate={range.to} />
    </>
  );
}
