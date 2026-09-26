import { formatBps, plural } from '@bliss/shared/format';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as reporting from '@/modules/reporting/service';
import { businessRange, rangeOptions } from '../../_lib/range';
import { UrlSelect } from '../../_components/url-select';
import { TabIntro } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Seats' };

/**
 * N-14: sales by seat position, to understand table composition. The attribution rate says how far
 * to trust it: a floor that leaves most lines on Shared makes the seat figures thin.
 */
export default async function SeatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const data = reporting.seatComposition(range.from, range.to);

  const head = 'px-12 py-12 text-label text-ink-subtle';
  return (
    <div className="flex flex-col gap-32">
      <TabIntro action={<UrlSelect param="range" label="Range" options={rangeOptions(false)} allLabel={null} fallback={range.key} />}>
        {range.label}. Seat 1 is whoever the waiter took first: positions describe the order people ordered in, not where they sat.
      </TabIntro>

      <MetricGrid columns={3}>
        <Metric label="Lines on a seat" value={formatBps(data.attributionBps)} detail="At tables of two or more. The rest were left shared." />
        <Metric label="Shared" value={<Money value={data.shared} size="num-kpi" decimals="whole" />} detail={`${formatBps(data.sharedShareBps)} of seated sales`} />
        <Metric label="All seated sales" value={<Money value={data.total} size="num-kpi" decimals="whole" />} detail="Every line on a tab at a table" />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="seats-position">
          <CardHeader band level="h2" titleId="seats-position" title="By seat position" />
          <CardBody className="pt-12">
            <ShareBars rows={data.seats.map((s) => ({ key: s.seat, label: `Seat ${s.seat}`, value: s.total, detail: `${formatBps(s.shareBps)}, ${plural(s.lines, 'line')}` }))} />
          </CardBody>
        </Card>
        <Card aria-labelledby="seats-party">
          <CardHeader band level="h2" titleId="seats-party" title="By party size" />
          <table className="w-full border-collapse">
            <caption className="sr-only">Sales by party size</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`${head} pl-20 text-left`}>
                  Party
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Tabs
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Sales
                </th>
                <th scope="col" className={`${head} pr-20 text-right`}>
                  A guest
                </th>
              </tr>
            </thead>
            <tbody>
              {data.guests.map((g) => (
                <tr key={g.guestCount} className="border-b border-rule last:border-b-0">
                  <td className="py-12 pl-20 pr-12 text-ui text-ink">{g.guestCount === 1 ? 'On their own' : `${g.guestCount} guests`}</td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{g.tabs}</td>
                  <td className="px-12 py-12 text-right">
                    <Money value={g.total} currency={false} size="num-md" decimals="whole" />
                  </td>
                  <td className="py-12 pl-12 pr-20 text-right">
                    <Money value={g.perSeat} currency={false} size="num-md" decimals="whole" tone="muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
