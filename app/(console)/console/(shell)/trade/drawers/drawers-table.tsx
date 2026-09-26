'use client';

import { formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { type Cents, abs, compare, formatDecimal, formatFigure, formatKes, isNegative, isPositive, isZero, sum } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Card, CardBand, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAlertTriangle, IconCash, IconClock, IconScale } from '@tabler/icons-react';
import { UrlSelect } from '../../_components/url-select';

export interface DrawerRow {
  id: string;
  businessDate: string;
  device: string;
  openedBy: string;
  openedAt: number;
  float: Cents;
  closedBy: string | null;
  closedAt: number | null;
  counted: Cents | null;
  expected: Cents | null;
  variance: Cents | null;
  reason: string | null;
  stage: 'blind' | 'closed';
  status: 'open' | 'counting' | 'closed';
  reviewed: boolean;
  bills: number;
}

/**
 * Drawer sessions: the float in, the count out, and the variance between what was counted and what
 * was expected. The expected figure stays withheld until the count is committed. docs/01 R7.
 */
export function DrawersTable({
  rows,
  timezone,
  threshold,
  rangeOptions,
  rangeKey,
  rangeLabel,
  exportDate,
}: {
  rows: DrawerRow[];
  timezone: string;
  threshold: Cents;
  rangeOptions?: { value: string; label: string }[];
  rangeKey?: string;
  rangeLabel?: string;
  exportDate?: string;
}) {
  const outside = (r: DrawerRow) => r.variance !== null && compare(abs(r.variance), threshold) > 0;
  const activeDrawers = rows.filter((r) => r.status !== 'closed').length;
  const closedDrawers = rows.filter((r) => r.status === 'closed').length;
  const flaggedCount = rows.filter(outside).length;
  const recordedVariances = rows.filter((r): r is DrawerRow & { variance: Cents } => r.variance !== null).map((r) => r.variance);
  const netVariance = sum(recordedVariances);
  const outsideTotal = compare(abs(netVariance), threshold) > 0;

  const columns: Column<DrawerRow>[] = [
    {
      key: 'date',
      header: 'Business date',
      width: '140px',
      fixed: true,
      sortValue: (r) => r.businessDate,
      csv: (r) => r.businessDate,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num-md">{formatIsoDate(r.businessDate)}</span>} secondary={r.device} />,
    },
    {
      key: 'opened',
      header: 'Opened',
      width: '104px',
      sortValue: (r) => r.openedAt,
      csv: (r) => `${r.openedBy} ${new Date(r.openedAt).toISOString()}`,
      cell: (r) => <StackCell primary={r.openedBy} secondary={<span className="font-mono tabular">{formatTime(r.openedAt, timezone)}</span>} />,
    },
    { key: 'float', header: 'Float', width: '96px', align: 'right', sortValue: (r) => r.float, csv: (r) => formatDecimal(r.float), cell: (r) => <Money value={r.float} currency={false} size="num-md" tone="muted" decimals="whole" /> },
    {
      key: 'closed',
      header: 'Closed',
      width: '104px',
      sortValue: (r) => r.closedAt,
      csv: (r) => (r.closedAt ? `${r.closedBy} ${new Date(r.closedAt).toISOString()}` : ''),
      cell: (r) => (r.closedAt ? <StackCell primary={r.closedBy} secondary={<span className="font-mono tabular">{formatTime(r.closedAt, timezone)}</span>} /> : <StatusChip status={r.status === 'counting' ? 'counting' : 'open'} />),
    },
    {
      key: 'counted',
      header: 'Counted',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.counted,
      csv: (r) => (r.counted === null ? '' : formatDecimal(r.counted)),
      cell: (r) => (r.counted === null ? <NumCell tone="muted">Not counted</NumCell> : <Money value={r.counted} currency={false} size="num-md" />),
    },
    {
      key: 'expected',
      header: 'Expected',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.expected,
      csv: (r) => (r.expected === null ? 'withheld' : formatDecimal(r.expected)),
      cell: (r) =>
        r.stage === 'blind' ? (
          <span className="text-body-sm text-ink-subtle" title="Expected cash stays hidden until the counted figure is committed">
            Withheld
          </span>
        ) : r.expected === null ? (
          <NumCell tone="muted">None</NumCell>
        ) : (
          <Money value={r.expected} currency={false} size="num-md" tone="muted" />
        ),
    },
    {
      key: 'variance',
      header: 'Variance',
      width: '110px',
      align: 'right',
      sortValue: (r) => (r.variance === null ? null : abs(r.variance)),
      csv: (r) => (r.variance === null ? '' : formatDecimal(r.variance)),
      cell: (r) =>
        r.variance === null ? (
          <NumCell tone="muted">None</NumCell>
        ) : isZero(r.variance) ? (
          <NumCell tone="poured">Balanced</NumCell>
        ) : (
          <NumCell tone={outside(r) ? 'stop' : 'muted'}>
            {isNegative(r.variance) ? '−' : '+'}
            {formatFigure(abs(r.variance))}
          </NumCell>
        ),
    },
    { key: 'reason', header: 'Reason given', width: 'minmax(160px,2fr)', wrap: true, csv: (r) => r.reason ?? '', cell: (r) => <span className="text-body-sm text-ink-muted">{r.reason ?? ''}</span> },
  ];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Drawer sessions" icon={IconCash} value={<CountUp value={rows.length} />} detail={rangeLabel ? `${closedDrawers} closed, ${rangeLabel}` : `${closedDrawers} closed`} />
        <Metric
          label="Open now"
          icon={IconClock}
          tone={activeDrawers > 0 ? 'info' : 'default'}
          value={<CountUp value={activeDrawers} delayMs={60} />}
          detail={activeDrawers > 0 ? 'A float is in the drawer' : 'Every drawer is counted and closed'}
        />
        <Metric
          label="Net variance"
          icon={IconScale}
          tone={outsideTotal ? 'attention' : 'default'}
          value={
            <>
              {isPositive(netVariance) ? '+' : null}
              <Money value={netVariance} size="num-kpi" decimals="whole" />
            </>
          }
          detail={recordedVariances.length > 0 ? `Across ${plural(recordedVariances.length, 'closed drawer')}` : 'No drawer has been closed'}
        />
        <Metric
          label="Over the threshold"
          icon={IconAlertTriangle}
          tone={flaggedCount > 0 ? 'stop' : 'default'}
          value={<CountUp value={flaggedCount} delayMs={120} />}
          detail={`More than ${formatKes(threshold, { decimals: 'whole' })} out either way`}
        />
      </MetricGrid>

      <DataTable
        id="trade-drawers"
        caption="Drawer sessions"
        noun={['drawer session', 'drawer sessions']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'date', dir: 'desc' }}
        filters={[{ kind: 'toggle', key: 'outside', label: `Over ${formatKes(threshold, { decimals: 'whole' })} out`, test: outside }]}
        leading={rangeOptions && rangeKey ? <UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} /> : undefined}
        rowTone={(r) => (outside(r) && !r.reviewed ? 'attention' : 'default')}
        rowHref={(r) => `/console/trade/drawers/${r.id}`}
        renderGridCard={(r) => (
          <Card as="article" interactive className="group h-full" tone={outside(r) && !r.reviewed ? 'stop' : undefined}>
            <CardBand
              eyebrow={formatIsoDate(r.businessDate)}
              status={r.status !== 'closed' ? <StatusChip status={r.status === 'counting' ? 'counting' : 'open'} /> : r.reviewed ? <StatusChip status="resolved" label="Reviewed" /> : outside(r) ? <StatusChip status="unresolved" label="To review" /> : <StatusChip status="settled" label="Closed" />}
              title={r.device}
              subtitle={`Opened by ${r.openedBy} at ${formatTime(r.openedAt, timezone)}`}
              href={`/console/trade/drawers/${r.id}`}
            />
            <KeyRows>
              <KeyRow label="Float">
                <Money value={r.float} currency={false} size="num-md" decimals="whole" />
              </KeyRow>
              <KeyRow label="Counted">{r.counted === null ? 'Not yet' : <Money value={r.counted} currency={false} size="num-md" decimals="whole" />}</KeyRow>
              <KeyRow label="Variance" tone={outside(r) ? 'stop' : undefined}>
                {r.variance === null ? (r.stage === 'blind' ? 'Withheld' : 'None') : isZero(r.variance) ? 'Balanced' : `${isNegative(r.variance) ? '−' : '+'}${formatFigure(abs(r.variance))}`}
              </KeyRow>
              <KeyRow label="Bills">{r.bills}</KeyRow>
            </KeyRows>
          </Card>
        )}
        exportName="drawers"
        exportDate={exportDate}
        empty={{ title: 'No drawer sessions in this range', body: 'A session starts when a cashier counts the float into the drawer at the counter.' }}
        emptyFiltered={{ title: 'No drawer was over the threshold', body: 'Every closed drawer in this range counted within the threshold.' }}
      />
    </div>
  );
}
