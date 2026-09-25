'use client';

import { formatBps, formatDateTime } from '@bliss/shared/format';
import { type Cents, formatDecimal, isPositive } from '@bliss/shared/money';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
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
  reasons: { reason: string; at: number }[];
}

/** Above two per cent of value is worth a conversation; it is a prompt to look, not a verdict. */
const RATE_ATTENTION_BPS = 200;

export function VoidsView({ rows, rangeKey, rangeOptions, timezone, exportDate }: { rows: VoidRow[]; rangeKey: string; rangeOptions: { value: string; label: string }[]; timezone: string; exportDate: string }) {
  const columns: Column<VoidRow>[] = [
    { key: 'name', header: 'Person', width: '140px', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={r.name} secondary={`${r.lines.toLocaleString('en-KE')} lines`} /> },
    { key: 'sales', header: 'Sold', width: '120px', align: 'right', sortValue: (r) => r.sales, csv: (r) => formatDecimal(r.sales), cell: (r) => <Money value={r.sales} currency={false} decimals="whole" tone="muted" /> },
    {
      key: 'voids',
      header: 'Voided',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.voidValue,
      csv: (r) => formatDecimal(r.voidValue),
      cell: (r) => (
        <span className="flex flex-col items-end ">
          <Money value={r.voidValue} currency={false} decimals="whole" tone={isPositive(r.voidValue) ? 'default' : 'subtle'} />
          <span className="text-body-sm text-ink-subtle">{r.voids} lines</span>
        </span>
      ),
    },
    { key: 'rate', header: 'Void rate', width: '100px', align: 'right', sortValue: (r) => r.voidRateBps, csv: (r) => (r.voidRateBps / 100).toFixed(2), cell: (r) => <NumCell tone={r.voidRateBps > RATE_ATTENTION_BPS ? 'low' : 'default'}>{formatBps(r.voidRateBps)}</NumCell> },
    { key: 'discounts', header: 'Discounted', width: '110px', align: 'right', sortValue: (r) => r.discounts, csv: (r) => formatDecimal(r.discounts), cell: (r) => (isPositive(r.discounts) ? <Money value={r.discounts} currency={false} decimals="whole" /> : <NumCell tone="muted">··</NumCell>) },
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
                <span className="font-mono tabular text-num-sm text-ink-subtle">{formatDateTime(x.at, timezone)}</span> {x.reason}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <DataTable
      id="report-voids"
      caption="Voids and discounts by person"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.staffId}
      defaultSort={{ key: 'rate', dir: 'desc' }}
      leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
      filters={[{ kind: 'toggle', key: 'high', label: 'Above 2% only', test: (r) => r.voidRateBps > RATE_ATTENTION_BPS }]}
      rowTone={(r) => (r.voidRateBps > RATE_ATTENTION_BPS ? 'attention' : 'default')}
      exportName="voids-by-person"
      exportDate={exportDate}
      empty={{ title: 'Nobody worked a shift in this range', body: 'Choose a longer range.' }}
    />
  );
}
