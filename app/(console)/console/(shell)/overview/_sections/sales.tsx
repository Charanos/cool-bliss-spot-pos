'use client';

import { formatIsoDate, formatWeekday } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { BarChart } from '@bliss/ui/components/console/bar-chart';
import { ChartCaption } from '@bliss/ui/components/console/chart-caption';
import { Money } from '@bliss/ui/components/money';
import { IconCalendarStats, IconClock, IconFlame, IconTrophy } from '@tabler/icons-react';
import type { OverviewData } from '../_data';
import { Panel, PanelEmpty } from './panel';

/** The night by the hour each line was fired, with the busiest hour named above the bars. */
export function SalesByHourPanel({ d }: { d: OverviewData }) {
  const data = d.hours.map((h) => ({ key: h.hour, label: h.hour.slice(0, 2), value: h.value }));
  const total = sum(data.map((x) => x.value));
  const peak = data.reduce((max, x) => (x.value > max.value ? x : max), data[0]!);
  return (
    <Panel id="overview-hours" icon={IconClock} title="Sales by hour" subtitle={`${d.live ? 'Tonight so far' : 'Last night'}, by the hour each line was fired`} href="/console/reports/sales?range=1" hrefLabel="Sales report">
      {total === 0n ? (
        <PanelEmpty icon={IconFlame} title="No sales by the hour yet" body="Each hour's takings show here as the night trades, with the busiest named above them." />
      ) : (
        <div className="flex flex-col gap-20 px-20 py-16">
          <ChartCaption
            icon={<IconFlame size={16} stroke={1.5} />}
            label="Busiest hour"
            figures={[`${peak.label}:00`, <Money key="peak" value={peak.value} size="num-md" decimals="whole" />]}
            note={
              <>
                <Money value={total} size="num-sm" decimals="whole" tone="subtle" /> fired
              </>
            }
          />
          <BarChart data={data} highlightKey={peak.key} caption="Sales by hour" height={220} tooltipLabel={(x) => `${x.label}:00 to ${x.label}:59`} />
        </div>
      )}
    </Panel>
  );
}

/** The last seven nights as bars, the best of them named, so tonight reads against the week. */
export function WeekPanel({ d }: { d: OverviewData }) {
  const data = d.week.map((w) => ({ key: w.date, label: formatWeekday(w.date).slice(0, 3), value: w.value }));
  const total = sum(data.map((x) => x.value));
  const best = d.week.reduce((max, w) => (w.value > max.value ? w : max), d.week[0]!);
  const traded = d.week.filter((w) => w.value > 0n).length;
  return (
    <Panel id="overview-week" icon={IconCalendarStats} title="The last seven nights" subtitle="Net sales, night by night" href="/console/reports/sales?range=7" hrefLabel="Sales for the week">
      {total === 0n ? (
        <PanelEmpty icon={IconCalendarStats} title="No nights traded yet" body="Each night's takings line up here once it has been traded." />
      ) : (
        <div className="flex flex-col gap-20 px-20 py-16">
          <ChartCaption
            icon={<IconTrophy size={16} stroke={1.5} />}
            label="Best night"
            figures={[`${formatWeekday(best.date)} ${formatIsoDate(best.date)}`, <Money key="best" value={best.value} size="num-md" decimals="whole" />]}
            note={
              <>
                <Money value={total} size="num-sm" decimals="whole" tone="subtle" /> over {traded}
              </>
            }
          />
          <BarChart data={data} highlightKey={d.date} caption="Net sales over the last seven nights" height={180} tooltipLabel={(x) => `${x.label} ${formatIsoDate(x.key)}`} />
        </div>
      )}
    </Panel>
  );
}
