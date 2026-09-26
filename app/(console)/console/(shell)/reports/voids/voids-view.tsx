'use client';

import { formatBps, formatDateTime } from '@bliss/shared/format';
import { type Cents, add, formatDecimal, formatKes, isPositive, shareBps, sum } from '@bliss/shared/money';
import { ShareBars } from '@bliss/ui/components/console/bar-chart';
import { Card, CardGroup } from '@bliss/ui/components/console/card';
import { ChartCaption } from '@bliss/ui/components/console/chart-caption';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { IconBan, IconDiscount2, IconMessage, IconPercentage, IconUsers } from '@tabler/icons-react';
import { EntityLink } from '../../_components/entity-link';
import { UrlSelect } from '../../_components/url-select';

interface VoidRow {
  staffId: string;
  name: string;
  lines: number;
  voids: number;
  voidValue: Cents;
  sales: Cents;
  voidRateBps: number;
  discounts: Cents;
  reasons: { reason: string; at: number; tabId: string }[];
}

/** Above two per cent of value is worth a conversation; it is a prompt to look, not a verdict. */
const RATE_ATTENTION_BPS = 200;

/** Void and discount rates by person, with the reasons they gave, so a pattern is visible. */
export function VoidsView({
  rows,
  reasons,
  rangeKey,
  rangeLabel,
  rangeOptions,
  timezone,
  exportDate,
}: {
  rows: VoidRow[];
  reasons: { key: string; label: string; value: Cents; count: number }[];
  rangeKey: string;
  rangeLabel: string;
  rangeOptions: { value: string; label: string }[];
  timezone: string;
  exportDate: string;
}) {
  const columns: Column<VoidRow>[] = [
    {
      key: 'name',
      header: 'Person',
      width: '140px',
      fixed: true,
      sortValue: (r) => r.name,
      csv: (r) => r.name,
      cell: (r) => <StackCell primary={r.name} secondary={`${r.lines.toLocaleString('en-KE')} lines`} />,
    },
    {
      key: 'sales',
      header: 'Sold',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.sales,
      csv: (r) => formatDecimal(r.sales),
      cell: (r) => <Money value={r.sales} currency={false} size="num-md" decimals="whole" tone="muted" />,
    },
    {
      key: 'voids',
      header: 'Voided',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.voidValue,
      csv: (r) => formatDecimal(r.voidValue),
      cell: (r) => (
        <span className="flex flex-col items-end">
          <Money value={r.voidValue} currency={false} size="num-md" decimals="whole" tone={isPositive(r.voidValue) ? 'default' : 'subtle'} />
          <span className="text-body-sm text-ink-subtle">{r.voids === 1 ? '1 line' : `${r.voids} lines`}</span>
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Void rate',
      width: '100px',
      align: 'right',
      sortValue: (r) => r.voidRateBps,
      csv: (r) => (r.voidRateBps / 100).toFixed(2),
      cell: (r) => <NumCell tone={r.voidRateBps > RATE_ATTENTION_BPS ? 'low' : 'default'}>{formatBps(r.voidRateBps)}</NumCell>,
    },
    {
      key: 'discounts',
      header: 'Discounted',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.discounts,
      csv: (r) => formatDecimal(r.discounts),
      cell: (r) => (isPositive(r.discounts) ? <Money value={r.discounts} currency={false} size="num-md" decimals="whole" /> : <NumCell tone="muted">None</NumCell>),
    },
    {
      key: 'reasons',
      header: 'Reasons given, most recent',
      width: 'minmax(260px,3fr)',
      wrap: true,
      csv: (r) => r.reasons.map((x) => x.reason).join('; '),
      cell: (r) =>
        r.reasons.length === 0 ? (
          <span className="text-body-sm text-ink-subtle">No voids</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {r.reasons.map((x, i) => (
              <li key={i} className="text-body-sm text-ink-muted">
                <EntityLink kind="tab" id={x.tabId} muted className="font-mono tabular text-num-sm">
                  {formatDateTime(x.at, timezone)}
                </EntityLink>{' '}
                {x.reason}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const voided = sum(rows.map((r) => r.voidValue));
  const sold = sum(rows.map((r) => r.sales));
  const lines = rows.reduce((n, r) => n + r.voids, 0);
  const discounts = sum(rows.map((r) => r.discounts));
  const rate = shareBps(voided, add(sold, voided));
  const above = rows.filter((r) => r.voidRateBps > RATE_ATTENTION_BPS).length;
  const top = reasons[0];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric
          label="Voided"
          icon={IconBan}
          tone={isPositive(voided) ? 'stop' : 'default'}
          value={<Money value={voided} size="num-kpi" decimals="whole" />}
          detail={`${lines} lines, ${rangeLabel}`}
        />
        <Metric label="Void rate" icon={IconPercentage} tone={rate > RATE_ATTENTION_BPS ? 'attention' : 'default'} value={formatBps(rate)} detail="Of everything rung up" />
        <Metric
          label="Above 2%"
          icon={IconUsers}
          tone={above > 0 ? 'attention' : 'poured'}
          value={<CountUp value={above} delayMs={120} />}
          detail={above > 0 ? 'Worth a conversation, not a verdict' : 'Everyone under the line'}
        />
        <Metric label="Discounted" icon={IconDiscount2} value={<Money value={discounts} size="num-kpi" decimals="whole" />} detail="Given off the price on shifts" />
      </MetricGrid>

      {reasons.length > 0 ? (
        <CardGroup title="Why lines were voided" description="By value, as the reasons were written" icon={IconMessage}>
          <Card className="px-20 py-16">
            {top ? (
              <ChartCaption
                className="mb-12"
                label={
                  <>
                    Most given: <span className="font-regular text-ink-muted">{top.label}</span>
                  </>
                }
                figures={[formatKes(top.value, { decimals: 'whole' })]}
                note={`${top.count} ${top.count === 1 ? 'line' : 'lines'}`}
              />
            ) : null}
            <ShareBars rows={reasons.map((r) => ({ key: r.key, label: r.label, value: r.value, detail: `${r.count}×` }))} />
          </Card>
        </CardGroup>
      ) : null}

      <DataTable
        id="report-voids"
        caption="Voids and discounts by person"
        noun={['person', 'people']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.staffId}
        rowHref={(r) => `/console/people/staff/${r.staffId}`}
        defaultSort={{ key: 'rate', dir: 'desc' }}
        leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
        filters={[{ kind: 'toggle', key: 'high', label: 'Above 2% only', test: (r) => r.voidRateBps > RATE_ATTENTION_BPS }]}
        rowTone={(r) => (r.voidRateBps > RATE_ATTENTION_BPS ? 'attention' : 'default')}
        exportName="voids-by-person"
        exportDate={exportDate}
        empty={{ title: 'Nobody worked a shift in this range', body: 'Choose a longer range.' }}
        emptyFiltered={{ title: 'Nobody is above 2%', body: 'Turn off the toggle to see everyone.' }}
      />
    </div>
  );
}
