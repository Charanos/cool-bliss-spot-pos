'use client';

import { formatIsoDate, formatTime } from '@bliss/shared/format';
import { type Cents, abs, compare, formatDecimal, formatKes, isNegative, isZero } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';

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
}

export function DrawersTable({ rows, timezone, threshold }: { rows: DrawerRow[]; timezone: string; threshold: Cents }) {
  const outside = (r: DrawerRow) => r.variance !== null && compare(abs(r.variance), threshold) > 0;

  const columns: Column<DrawerRow>[] = [
    {
      key: 'date',
      header: 'Business date',
      width: '140px',
      fixed: true,
      sortValue: (r) => r.businessDate,
      csv: (r) => r.businessDate,
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num">{formatIsoDate(r.businessDate)}</span>} secondary={r.device} />,
    },
    {
      key: 'opened',
      header: 'Opened',
      width: '120px',
      sortValue: (r) => r.openedAt,
      csv: (r) => `${r.openedBy} ${new Date(r.openedAt).toISOString()}`,
      cell: (r) => <StackCell primary={r.openedBy} secondary={<span className="font-mono tabular">{formatTime(r.openedAt, timezone)}</span>} />,
    },
    { key: 'float', header: 'Float', width: '96px', align: 'right', sortValue: (r) => r.float, csv: (r) => formatDecimal(r.float), cell: (r) => <Money value={r.float} currency={false} tone="muted" decimals="whole" /> },
    {
      key: 'closed',
      header: 'Closed',
      width: '120px',
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
      cell: (r) => (r.counted === null ? <NumCell tone="muted">··</NumCell> : <Money value={r.counted} currency={false} />),
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
          <NumCell tone="muted">··</NumCell>
        ) : (
          <Money value={r.expected} currency={false} tone="muted" />
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
          <NumCell tone="muted">··</NumCell>
        ) : isZero(r.variance) ? (
          <NumCell tone="poured">0.00</NumCell>
        ) : (
          <NumCell tone={outside(r) ? 'stop' : 'muted'}>
            {isNegative(r.variance) ? '' : '+'}
            {formatDecimal(r.variance)}
          </NumCell>
        ),
    },
    { key: 'reason', header: 'Reason given', width: 'minmax(200px,2fr)', wrap: true, csv: (r) => r.reason ?? '', cell: (r) => <span className="text-body text-ink-muted">{r.reason ?? ''}</span> },
  ];

  return (
    <DataTable
      id="trade-drawers"
      caption="Drawer sessions"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'date', dir: 'desc' }}
      filters={[{ kind: 'toggle', key: 'outside', label: `Over ${formatKes(threshold, { decimals: 'whole' })} out`, test: outside }]}
      rowTone={(r) => (outside(r) ? 'attention' : 'default')}
      exportName="drawers"
      empty={{ title: 'No drawer sessions yet', body: 'A session starts when a cashier counts the float into the drawer at the counter.' }}
    />
  );
}
