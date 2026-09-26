import { formatBps, formatDateTime, formatQty, plural } from '@bliss/shared/format';
import { isNegative, isPositive } from '@bliss/shared/money';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { Card, CardBody, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, Section, Totals } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { IconCash, IconClock, IconPercentage, IconReceipt, IconReceiptTax, IconScale } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import { type ItemPerformance, performance } from '@/modules/reporting/performance';
import * as reporting from '@/modules/reporting/service';
import { ViewHeader } from '../../_components/workspace';
import { UrlSelect } from '../../_components/url-select';
import { TENDER_LABEL } from '../../_lib/labels';
import { businessRange, rangeOptions } from '../../_lib/range';
import { CategoryTable } from './category-table';

export const metadata: Metadata = { title: 'Performance' };

function ItemCard({ title, item, label, figure }: { title: string; item: ItemPerformance | null; label: string; figure: (i: ItemPerformance) => React.ReactNode }) {
  return (
    <Card as="article" className="h-full">
      <CardHeader band title={title} subtitle={item ? item.category : undefined} />
      {item ? (
        <CardStats>
          <Stat label="Item" className="col-span-2">
            {item.name}
          </Stat>
          <Stat label="Sold">{item.units}</Stat>
          <Stat label={label}>{figure(item)}</Stat>
        </CardStats>
      ) : (
        <CardBody className="pt-16">
          <p className="text-body-sm text-ink-muted">Nothing to show in this range.</p>
        </CardBody>
      )}
    </Card>
  );
}

/**
 * Performance, docs/10 N-12: what came in, what it cost, and what it left, for a range of business
 * days, from what Bliss records and nothing else. Needs report.margin: cost and margin are sensitive.
 */
export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await identity.currentConsoleActor();
  if (!identity.can(actor.staffId, 'report.margin')) {
    return <EmptyState title="Performance is for margin reports" body="Your role does not see cost or margin. A manager can give it the right to see margin reports under People, Roles." />;
  }
  const params = await searchParams;
  const range = businessRange(params.range, reporting.clock().tradingInProgress ? 'tonight' : '1');
  const r = performance(range.from, range.to, range.previous);
  const tz = identity.outlet().timezone;
  const lost = [r.sales.voids, r.sales.discounts, r.sales.comps];

  return (
    <div className="flex flex-col gap-32">
      <ViewHeader page="/console/reports/performance" badge={<span className="text-body-sm text-ink-muted">{range.label}</span>} actions={<UrlSelect param="range" label="Range" options={rangeOptions(true)} allLabel={null} fallback={range.key} />} />

      <MetricGrid>
        <Metric label="Settled" icon={IconReceipt} value={<Money value={r.sales.settled} size="num-kpi" decimals="whole" />} delta={r.sales.deltaBps === null ? null : { bps: r.sales.deltaBps, against: 'the days before' }} detail={r.sales.deltaBps === null ? plural(r.sales.bills, 'bill') : undefined} />
        <Metric label="Gross profit" icon={IconScale} tone={isPositive(r.margin.grossProfit) ? 'poured' : 'stop'} value={<Money value={r.margin.grossProfit} size="num-kpi" decimals="whole" />} detail={`${formatBps(r.margin.marginBps)} of sales after VAT`} />
        <Metric label="VAT collected" icon={IconReceiptTax} value={<Money value={r.sales.vat} size="num-kpi" decimals="whole" />} detail="Included in settled bills" />
        <Metric label="Average bill" icon={IconCash} value={<Money value={r.sales.averageBill} size="num-kpi" decimals="whole" />} detail={plural(r.sales.bills, 'bill')} />
      </MetricGrid>

      {isPositive(r.margin.uncosted) ? (
        <Callout tone="info" title="Some sales have no recorded cost" aside={<Money value={r.margin.uncosted} size="num-lg" decimals="whole" />}>
          Food, and anything in a category that does not track stock, sells without a cost. Its margin is not known, so gross profit here is higher than it really is by that cost.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="perf-sales">
          <CardHeader band level="h2" titleId="perf-sales" title="From rung up to settled" subtitle="What was sold, what was given back, and what the bills came to" />
          <CardBody className="pt-16">
            <Totals
              items={[
                { label: 'Rung up, VAT included', value: <Money value={r.sales.rungUp} size="num-md" decimals="whole" /> },
                { label: `Voided, ${plural(r.sales.voidLines, 'line')}`, value: <Money value={r.sales.voids} size="num-md" decimals="whole" tone={isPositive(r.sales.voids) ? 'attention' : 'muted'} /> },
                { label: 'Discounts', value: <Money value={r.sales.discounts} size="num-md" decimals="whole" tone={isPositive(r.sales.discounts) ? 'attention' : 'muted'} /> },
                { label: 'Comps', value: <Money value={r.sales.comps} size="num-md" decimals="whole" tone={isPositive(r.sales.comps) ? 'attention' : 'muted'} /> },
              ]}
              total={{ label: 'Settled', value: <Money value={r.sales.settled} size="num-lg" decimals="whole" /> }}
            />
            {lost.some(isPositive) ? null : <p className="mt-12 text-body-sm text-ink-muted">Nothing was voided, discounted or comped.</p>}
          </CardBody>
        </Card>

        <Card aria-labelledby="perf-margin">
          <CardHeader band level="h2" titleId="perf-margin" title="Margin" subtitle="Sales after VAT, less the cost on each sale" />
          <CardBody className="pt-16">
            <Totals
              items={[
                { label: 'Sales after VAT', value: <Money value={r.margin.revenueExVat} size="num-md" decimals="whole" /> },
                { label: 'Cost of what was sold', value: <Money value={r.margin.cost} size="num-md" decimals="whole" tone="muted" /> },
              ]}
              total={{ label: 'Gross profit', value: <Money value={r.margin.grossProfit} size="num-lg" decimals="whole" /> }}
            />
          </CardBody>
        </Card>
      </div>

      <Section id="perf-categories" title="By category" description="Cost of sales is the cost as a share of sales after VAT, on the sales that carry a cost. For drinks it is the pour cost.">
        <CategoryTable rows={r.categories} />
      </Section>

      <Section id="perf-items" title="Items" description="Contribution is sales after VAT less cost, for items whose every sale carries a cost.">
        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-4">
          <ItemCard title="Sold the most" label="Sales" item={r.items.bestSeller} figure={(i) => <Money value={i.sales} size="num-md" decimals="whole" />} />
          <ItemCard title="Made the most" label="Contribution" item={r.items.mostProfit} figure={(i) => (i.contribution ? <Money value={i.contribution} size="num-md" decimals="whole" /> : 'Not costed')} />
          <ItemCard title="Sold the least" label="Sales" item={r.items.slowest} figure={(i) => <Money value={i.sales} size="num-md" decimals="whole" />} />
          <ItemCard title="Lowest margin" label="Margin" item={r.items.lowestMargin} figure={(i) => (i.marginBps === null ? 'Not costed' : formatBps(i.marginBps))} />
        </div>
      </Section>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="perf-tenders">
          <CardHeader band level="h2" titleId="perf-tenders" icon={IconPercentage} title="How guests paid" subtitle="As the cashier recorded it" />
          <CardBody className="pt-12">
            {r.tenders.length > 0 ? (
              <ShareBars rows={r.tenders.map((t) => ({ key: t.kind, label: TENDER_LABEL[t.kind as keyof typeof TENDER_LABEL] ?? t.kind, value: t.amount, detail: plural(t.count, 'tender') }))} />
            ) : (
              <p className="text-body-sm text-ink-muted">No bill was settled in this range.</p>
            )}
          </CardBody>
        </Card>

        <Card aria-labelledby="perf-staff">
          <CardHeader band level="h2" titleId="perf-staff" icon={IconClock} title="Hours on shift" subtitle="From sign in to sign out. Bliss holds no wage rates." />
          <CardStats>
            <Stat label="Shifts">{r.labour.shifts}</Stat>
            <Stat label="People">{r.labour.people}</Stat>
            <Stat label="Hours">{formatQty(r.labour.hours, 1)}</Stat>
            <Stat label="Settled an hour">{r.labour.salesPerHour ? <Money value={r.labour.salesPerHour} size="num-md" decimals="whole" /> : 'None'}</Stat>
          </CardStats>
        </Card>

        <Card aria-labelledby="perf-variance">
          <CardHeader
            band
            level="h2"
            titleId="perf-variance"
            title="Stock counted short or over"
            subtitle={r.variance ? `${plural(r.variance.counts, 'count')} committed in this range` : 'No count was committed in this range'}
            actions={r.variance ? <Money value={r.variance.total} size="num-md" decimals="whole" tone={isNegative(r.variance.total) ? 'default' : 'muted'} /> : undefined}
          />
          {r.variance && r.variance.lines.length > 0 ? (
            <ul className="flex flex-col">
              {r.variance.lines.map((l) => (
                <li key={l.name} className="flex items-baseline justify-between gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                  <span className="text-ui text-ink">{l.name}</span>
                  <span className="flex items-baseline gap-16">
                    <span className="font-mono tabular text-num-md text-ink-muted">
                      {l.qty > 0 ? '+' : ''}
                      {formatQty(l.qty, 2)}
                    </span>
                    <Money value={l.value} size="num-md" decimals="whole" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="pt-16">
              <p className="text-body-sm text-ink-muted">{r.variance ? 'Every line counted as expected.' : 'Commit a stock count to see what went missing, by name.'}</p>
            </CardBody>
          )}
        </Card>

        <Card aria-labelledby="perf-payouts">
          <CardHeader band level="h2" titleId="perf-payouts" title="Paid out of the drawer" subtitle="Cash taken from the drawer, with its reason" actions={<Money value={r.payouts.total} size="num-md" decimals="whole" />} />
          {r.payouts.rows.length > 0 ? (
            <ul className="flex flex-col">
              {r.payouts.rows.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                  <span className="min-w-0 text-body-sm text-ink-muted">
                    <span className="text-ink">{p.reason ?? 'No reason given'}</span>, {p.by}, <span className="font-mono tabular">{formatDateTime(p.at, tz)}</span>
                  </span>
                  <Money value={p.amount} size="num-md" decimals="whole" />
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="pt-16">
              <p className="text-body-sm text-ink-muted">Nothing was paid out of the drawer in this range.</p>
            </CardBody>
          )}
        </Card>
      </div>

      {r.openNow.tabs > 0 ? (
        <Callout tone={r.openNow.fromEarlierDays > 0 ? 'stop' : 'info'} title={`${plural(r.openNow.tabs, 'tab')} open now`} aside={<Money value={r.openNow.value} size="num-lg" decimals="whole" />}>
          {r.openNow.fromEarlierDays > 0 ? `${r.openNow.fromEarlierDays} of them ${r.openNow.fromEarlierDays === 1 ? 'is' : 'are'} from an earlier business day. ` : ''}An open tab is not a sale until it is settled, so it is not in the figures above.
        </Callout>
      ) : null}
    </div>
  );
}

