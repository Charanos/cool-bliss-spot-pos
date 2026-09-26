import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { VoidsView } from './voids-view';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Voids and discounts' };

/** N-08: void and discount rates by staff member, with the reasons they gave, so a pattern is visible. */
export default async function VoidsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const tz = identity.outlet().timezone;
  const rows = reporting.voidsByStaff(range.from, range.to).map((r) => ({ ...r, reasons: r.reasons.map((x) => ({ ...x, at: x.at })) }));
  return (
    <>
      <ViewHeader page="/console/reports/voids" />
      <VoidsView rows={rows} rangeKey={range.key} rangeOptions={rangeOptions(false)} timezone={tz} exportDate={range.to} />
    </>
  );
}
