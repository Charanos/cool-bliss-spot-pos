'use client';

import type { CountKind, CountStatus } from '@bliss/shared/domain';
import { formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';

export interface CountRow {
  id: string;
  businessDate: string;
  location: string;
  kind: CountKind;
  status: CountStatus;
  counted: number;
  total: number;
  variance: Cents | null;
  openedBy: string;
  openedAt: number;
  committedAt: number | null;
}

const KIND = { full: 'Full count', cycle: 'Cycle count', spot: 'Spot check' } as const;

/** Every stock count, newest first. The variance stays hidden until a count reaches review. */
export function CountsTable({ rows, timezone }: { rows: CountRow[]; timezone: string }) {
  const columns: Column<CountRow>[] = [
    { key: 'date', header: 'Business day', width: '140px', fixed: true, sortValue: (r) => r.openedAt, csv: (r) => r.businessDate, cell: (r) => <StackCell primary={formatIsoDate(r.businessDate)} secondary={KIND[r.kind]} /> },
    { key: 'location', header: 'Location', width: 'minmax(120px,1fr)', sortValue: (r) => r.location, csv: (r) => r.location, cell: (r) => <span className="text-ui text-ink">{r.location}</span> },
    { key: 'status', header: 'State', width: '120px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status} /> },
    { key: 'progress', header: 'Counted', width: '100px', align: 'right', sortValue: (r) => r.counted / Math.max(1, r.total), csv: (r) => `${r.counted}/${r.total}`, cell: (r) => <NumCell tone={r.counted < r.total ? 'low' : 'default'}>{r.counted} of {r.total}</NumCell> },
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
    <DataTable
      id="inventory-counts"
      caption="Stock counts"
      noun={['count', 'counts']}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/console/inventory/counts/${r.id}`}
      defaultSort={{ key: 'opened', dir: 'desc' }}
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
    />
  );
}
