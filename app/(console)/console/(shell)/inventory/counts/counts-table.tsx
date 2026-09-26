'use client';

import type { CountKind, CountStatus } from '@bliss/shared/domain';
import { formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconChecklist, IconClipboardCheck, IconEye, IconScale } from '@tabler/icons-react';

export interface CountRow {
  id: string;
  businessDate: string;
  location: string;
  kind: CountKind;
  status: CountStatus;
  counted: number;
  total: number;
  variance: Cents | null;
  outside: number | null;
  openedBy: string;
  openedAt: number;
  committedAt: number | null;
}

const KIND = { full: 'Full count', cycle: 'Cycle count', spot: 'Spot check' } as const;

/** Every stock count, newest first. The variance stays hidden until a count reaches review. */
export function CountsTable({ rows, timezone, lastCommitted }: { rows: CountRow[]; timezone: string; lastCommitted: { variance: Cents; outside: number; at: number } | null }) {
  const running = rows.filter((r) => r.status === 'counting' || r.status === 'open');
  const review = rows.filter((r) => r.status === 'review');
  const committed = rows.filter((r) => r.status === 'committed');
  const columns: Column<CountRow>[] = [
    { key: 'date', header: 'Business day', width: '140px', fixed: true, sortValue: (r) => r.openedAt, csv: (r) => r.businessDate, cell: (r) => <StackCell primary={formatIsoDate(r.businessDate)} secondary={KIND[r.kind]} /> },
    { key: 'location', header: 'Location', width: 'minmax(120px,1fr)', sortValue: (r) => r.location, csv: (r) => r.location, cell: (r) => <span className="text-ui text-ink">{r.location}</span> },
    { key: 'status', header: 'State', width: '120px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status} /> },
    {
      key: 'progress',
      header: 'Counted',
      width: '150px',
      align: 'right',
      sortValue: (r) => r.counted / Math.max(1, r.total),
      csv: (r) => `${r.counted}/${r.total}`,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-8">
          <InlineBar value={r.total > 0 ? r.counted / r.total : 0} tone={r.counted < r.total ? 'attention' : 'accent'} />
          <NumCell tone={r.counted < r.total ? 'low' : 'default'}>
            {r.counted} of {r.total}
          </NumCell>
        </span>
      ),
    },
    {
      key: 'variance',
      header: 'Variance at cost',
      width: '140px',
      align: 'right',
      sortValue: (r) => r.variance,
      csv: (r) => (r.variance === null ? '' : formatDecimal(r.variance)),
      cell: (r) => (r.variance === null ? <span className="text-body-sm text-ink-subtle">Hidden until review</span> : <Money value={r.variance} currency={false} size="num-md" decimals="whole" />),
    },
    { key: 'opened', header: 'Opened', width: '180px', sortValue: (r) => r.openedAt, csv: (r) => formatDateTime(r.openedAt, timezone), cell: (r) => <StackCell primary={r.openedBy} secondary={formatDateTime(r.openedAt, timezone)} /> },
  ];
  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Counting now" icon={IconChecklist} tone={running.length > 0 ? 'info' : 'default'} value={<CountUp value={running.length} />} detail={running.length > 0 ? running.map((r) => r.location).join(', ') : 'No count running'} />
        <Metric label="In review" icon={IconEye} tone={review.length > 0 ? 'attention' : 'default'} value={<CountUp value={review.length} delayMs={60} />} detail={review.length > 0 ? 'Waiting for a manager to commit' : 'Nothing waiting'} />
        <Metric label="Committed" icon={IconClipboardCheck} value={<CountUp value={committed.length} delayMs={120} />} detail="In the stock ledger" />
        <Metric
          label="Last variance"
          icon={IconScale}
          tone={lastCommitted && lastCommitted.outside > 0 ? 'stop' : 'default'}
          value={lastCommitted ? <Money value={lastCommitted.variance} size="num-kpi" decimals="whole" /> : 'None'}
          detail={lastCommitted ? `${lastCommitted.outside} lines outside tolerance, ${formatDateTime(lastCommitted.at, timezone)}` : 'No count committed yet'}
          href="/console/reports/pour-variance"
        />
      </MetricGrid>
      <DataTable
        id="inventory-counts"
        caption="Stock counts"
        noun={['count', 'counts']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/inventory/counts/${r.id}`}
        defaultSort={{ key: 'opened', dir: 'desc' }}
        defaultView="grid"
        rowTone={(r) => (r.status === 'cancelled' ? 'muted' : r.status === 'review' ? 'attention' : 'default')}
        filters={[
          {
            kind: 'chips',
            key: 'status',
            label: 'State',
            options: [
              { value: 'counting', label: 'Counting' },
              { value: 'review', label: 'In review' },
              { value: 'committed', label: 'Committed' },
            ],
            test: (r, v) => r.status === v,
          },
        ]}
        exportName="counts"
        empty={{
          title: 'No counts yet',
          body: 'Count the bar or the store to see how what is there compares with what the ledger expects.',
          action: <ButtonLink href="/console/inventory/counts/new">Start a count</ButtonLink>,
        }}
        emptyFiltered={{ title: 'No counts in that state', body: 'Choose another state to see those counts.' }}
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full" tone={r.status === 'review' ? 'low' : r.status === 'counting' ? 'accent' : undefined}>
            <CardHeader band title={`${KIND[r.kind]}, ${r.location}`} subtitle={formatIsoDate(r.businessDate)} href={`/console/inventory/counts/${r.id}`} meta={<StatusChip status={r.status} />} />
            <CardStats columns={2}>
              <Stat label="Counted">
                {r.counted} of {r.total}
              </Stat>
              <Stat label="Variance" tone={r.outside ? 'stop' : undefined}>
                {r.variance === null ? 'Hidden' : <Money value={r.variance} currency={false} size="num-md" decimals="whole" />}
              </Stat>
            </CardStats>
            <CardFooter>
              <span className="inline-flex items-center gap-8 text-body-sm text-ink-muted">
                <InlineBar value={r.total > 0 ? r.counted / r.total : 0} tone={r.counted < r.total ? 'attention' : 'accent'} />
                {r.total > 0 ? Math.round((r.counted / r.total) * 100) : 0}% counted
              </span>
              <span className="text-body-sm text-ink-subtle">{r.openedBy}</span>
            </CardFooter>
          </Card>
        )}
      />
    </div>
  );
}
