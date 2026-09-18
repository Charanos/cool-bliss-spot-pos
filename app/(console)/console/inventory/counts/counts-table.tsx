'use client';

import type { CountKind, CountStatus } from '@bliss/shared/domain';
import { formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { type Cents, formatDecimal } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconClipboardList } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { TabIntro } from '../../_components/workspace';

interface CountRow {
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

const KIND = { full: 'Full', cycle: 'Cycle', spot: 'Spot' } as const;

export function CountsTable({ rows, timezone }: { rows: CountRow[]; timezone: string }) {
  const router = useRouter();
  const columns: Column<CountRow>[] = [
    { key: 'date', header: 'Business date', width: '140px', fixed: true, sortValue: (r) => r.openedAt, csv: (r) => r.businessDate, cell: (r) => <StackCell primary={formatIsoDate(r.businessDate)} secondary={KIND[r.kind]} /> },
    { key: 'location', header: 'Location', width: 'minmax(120px,1fr)', sortValue: (r) => r.location, csv: (r) => r.location, cell: (r) => <span className="text-body text-ink">{r.location}</span> },
    { key: 'status', header: 'Status', width: '120px', sortValue: (r) => r.status, csv: (r) => r.status, cell: (r) => <StatusChip status={r.status} /> },
    { key: 'progress', header: 'Counted', width: '100px', align: 'right', sortValue: (r) => r.counted / Math.max(1, r.total), csv: (r) => `${r.counted}/${r.total}`, cell: (r) => <NumCell tone={r.counted < r.total ? 'low' : 'default'}>{r.counted} of {r.total}</NumCell> },
    {
      key: 'variance',
      header: 'Variance at cost',
      width: '140px',
      align: 'right',
      sortValue: (r) => r.variance,
      csv: (r) => (r.variance === null ? '' : formatDecimal(r.variance)),
      cell: (r) => (r.variance === null ? <span className="text-body-sm text-ink-subtle">Hidden until review</span> : <Money value={r.variance} currency={false} decimals="whole" />),
    },
    { key: 'opened', header: 'Opened', width: '180px', sortValue: (r) => r.openedAt, csv: (r) => formatDateTime(r.openedAt, timezone), cell: (r) => <StackCell primary={r.openedBy} secondary={formatDateTime(r.openedAt, timezone)} /> },
  ];
  return (
    <>
      <TabIntro
        action={
          <ButtonLink href="/console/inventory/counts/new" variant="primary" icon={IconClipboardList}>
            Start blind count
          </ButtonLink>
        }
      >
        A blind count compares what you have against what the ledger says you should have.
      </TabIntro>
      <DataTable
        id="inventory-counts"
        caption="Stock counts"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/inventory/counts/${r.id}`}
        filters={[
          {
            kind: 'chips',
            key: 'status',
            label: 'Status',
            options: [
              { value: 'counting', label: 'Counting' },
              { value: 'review', label: 'Review' },
              { value: 'committed', label: 'Committed' },
            ],
            test: (r, v) => r.status === v,
          },
        ]}
        exportName="counts"
        empty={{
          title: 'No counts yet',
          body: 'A blind count compares what you have against what the ledger says you should have.',
          action: <ButtonLink href="/console/inventory/counts/new">Start blind count</ButtonLink>,
        }}
      />
    </>
  );
}
