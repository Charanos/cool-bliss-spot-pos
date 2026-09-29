import { formatWeekday } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { ChartCaption } from '@bliss/ui/components/console/chart-caption';
import { HourCompare } from '@bliss/ui/components/console/hour-compare';
import { Money } from '@bliss/ui/components/money';
import { IconClock, IconFlame, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import type { OverviewData } from '../_data';
import { Panel, PanelEmpty } from './panel';

/**
 * The night by the hour each line was fired, set against a usual night of the same weekday, with
 * the busiest hour and how far ahead or behind the night is running named above the chart.
 */
export function SalesByHourPanel({ d }: { d: OverviewData }) {
  const day = formatWeekday(d.date);
  const hours = d.hours.map((h, i) => ({ hour: h.hour, tonight: Math.round(Number(h.value) / 100), usual: d.usualHours ? Math.round(d.usualHours[i]!.value / 100) : null }));
  const total = sum(d.hours.map((h) => h.value));
  const peak = hours.reduce((m, h) => (h.tonight > m.tonight ? h : m), hours[0]!);
  // Compare only the hours tonight has reached: the last hour with a sale and everything before it.
  const reached = hours.reduce((last, h, i) => (h.tonight > 0 ? i : last), -1);
  const usualSoFar = d.usualHours ? hours.slice(0, reached + 1).reduce((a, h) => a + (h.usual ?? 0), 0) : 0;
  const tonightSoFar = hours.slice(0, reached + 1).reduce((a, h) => a + h.tonight, 0);
  const pace = usualSoFar > 0 ? Math.round(((tonightSoFar - usualSoFar) / usualSoFar) * 100) : null;

  return (
    <Panel
      id="overview-hours"
      icon={IconClock}
      title="Sales by hour"
      subtitle={d.usualHours ? `${d.live ? 'Tonight so far' : 'Last night'}, against a usual ${day}` : `${d.live ? 'Tonight so far' : 'Last night'}, by the hour each line was fired`}
      href="/console/reports/sales?range=1"
      hrefLabel="Sales report"
    >
      {total === 0n ? (
        <PanelEmpty icon={IconFlame} title="No sales by the hour yet" body={`Each hour's takings show here as the night trades, against a usual ${day}.`} />
      ) : (
        <div className="flex flex-col gap-16 px-20 py-16">
          <ChartCaption
            icon={pace === null ? <IconFlame size={16} stroke={1.5} /> : pace >= 0 ? <IconTrendingUp size={16} stroke={1.5} /> : <IconTrendingDown size={16} stroke={1.5} />}
            label={pace === null ? 'Busiest hour' : pace >= 0 ? `Running ${pace}% ahead` : `Running ${Math.abs(pace)}% behind`}
            figures={[`${peak.hour} busiest`, <Money key="peak" value={d.hours.find((h) => h.hour === peak.hour)!.value} size="num-md" decimals="round" />]}
            note={
              <>
                <Money value={total} size="num-sm" decimals="round" tone="subtle" /> fired
              </>
            }
          />
          <HourCompare hours={hours} usualLabel={`Usual ${day}`} caption={`Sales by hour against a usual ${day}`} />
        </div>
      )}
    </Panel>
  );
}
