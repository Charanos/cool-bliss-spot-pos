import { formatIsoDate, formatWeekday } from '@bliss/shared/format';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { PageHeader } from '@bliss/ui/components/console/shell';
import { IconChartBar, IconScale } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { loadOverview } from './_data';
import { AttentionPanel } from './_sections/attention';
import { LiveFloor } from './_sections/floor';
import { OverviewHero } from './_sections/hero';
import { OverviewKpis } from './_sections/kpis';
import { MoneyPanel } from './_sections/money';
import { SalesByHourPanel } from './_sections/sales';
import { CategoriesPanel, MoversPanel } from './_sections/sold';
import { StockPanel } from './_sections/stock';
import { PulsePanel, TeamPanel } from './_sections/team';

export const metadata: Metadata = { title: 'Overview' };

/**
 * The page opened at nine in the morning or in the middle of service. docs/19 section 5.
 *
 *   1. The night in view: its takings against a usual night, and the week behind it.
 *   2. Four figures: average bill, margin, guests, what was taken back.
 *   3. The night by the hour against a usual night, beside what needs a person now.
 *   4. The floor this moment, beside the money: tenders and drawers.
 *   5. The categories, beside the best sellers.
 *   6. Stock, who is on shift, and the app's own health.
 *
 * Every section is its own component under _sections, and every figure opens the page it comes from.
 */
export default async function OverviewPage() {
  const d = await loadOverview();
  const night = d.live ? 'Tonight so far' : 'Last night';

  return (
    <div className="flex flex-col gap-32">
      <PageHeader
        title="Overview"
        description={`${night}, ${formatWeekday(d.date)} ${formatIsoDate(d.date)}, at a glance, and what needs you now.`}
        actions={
          <>
            <ButtonLink href="/console/reports/sales" variant="secondary" icon={IconChartBar}>
              Sales report
            </ButtonLink>
            <ButtonLink href="/console/reports/performance" variant="secondary" icon={IconScale}>
              Performance
            </ButtonLink>
          </>
        }
      />

      <OverviewHero d={d} />
      <OverviewKpis d={d} />

      <div className="grid grid-cols-1 items-stretch gap-24 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SalesByHourPanel d={d} />
        <AttentionPanel d={d} />
      </div>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <LiveFloor d={d} />
        <MoneyPanel d={d} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-24 desktop:grid-cols-2">
        <CategoriesPanel d={d} />
        <MoversPanel d={d} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-24 desktop:grid-cols-3">
        <StockPanel d={d} />
        <TeamPanel d={d} />
        <PulsePanel d={d} />
      </div>
    </div>
  );
}
