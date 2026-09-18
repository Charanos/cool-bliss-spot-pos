'use client';

import type { MovementType } from '@bliss/shared/domain';
import { formatDateTime, formatQty } from '@bliss/shared/format';
import { type Cents, formatDecimal, multiplyByQuantity } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { IconX } from '@tabler/icons-react';
import { UrlSelect } from '../../_components/url-select';

interface MovementRow {
  id: string;
  at: number;
  variantId: string;
  variant: string;
  location: string;
  locationId: string;
  type: MovementType;
  qty: number;
  unitCost: Cents;
  source: string;
  by: string;
  reason: string | null;
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receipt: 'Receipt',
  sale: 'Sale',
  sale_reversal: 'Sale reversal',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  write_off_breakage: 'Write-off, breakage',
  write_off_spillage: 'Write-off, spillage',
  write_off_expiry: 'Write-off, expiry',
  staff_drink: 'Staff drink',
  comp: 'Comp',
  count_adjustment: 'Count adjustment',
  return_to_supplier: 'Return to supplier',
  opening_balance: 'Opening balance',
};

export function MovementsTable({ rows, timezone, locations, variantName }: { rows: MovementRow[]; timezone: string; locations: { value: string; label: string }[]; variantName: string | null }) {
  const columns: Column<MovementRow>[] = [
    { key: 'at', header: 'When', width: '150px', fixed: true, sortValue: (r) => r.at, csv: (r) => new Date(r.at).toISOString(), cell: (r) => <NumCell tone="muted">{formatDateTime(r.at, timezone)}</NumCell> },
    { key: 'variant', header: 'Product', width: 'minmax(160px,1.4fr)', sortValue: (r) => r.variant, csv: (r) => r.variant, cell: (r) => <StackCell primary={r.variant} secondary={r.location} /> },
    { key: 'type', header: 'Type', width: '150px', sortValue: (r) => r.type, csv: (r) => MOVEMENT_LABEL[r.type], cell: (r) => <span className="text-body text-ink">{MOVEMENT_LABEL[r.type]}</span> },
    { key: 'qty', header: 'Quantity', width: '96px', align: 'right', sortValue: (r) => r.qty, csv: (r) => r.qty, cell: (r) => <NumCell tone={r.qty < 0 ? 'default' : 'poured'}>{r.qty > 0 ? '+' : ''}{formatQty(r.qty, 3)}</NumCell> },
    { key: 'cost', header: 'Unit cost', width: '0px', exportOnly: true, align: 'right', csv: (r) => formatDecimal(r.unitCost), cell: (r) => <Money value={r.unitCost} currency={false} tone="muted" /> },
    { key: 'value', header: 'Value', width: '100px', align: 'right', sortValue: (r) => multiplyByQuantity(r.unitCost, r.qty), csv: (r) => formatDecimal(multiplyByQuantity(r.unitCost, r.qty)), cell: (r) => <Money value={multiplyByQuantity(r.unitCost, r.qty)} currency={false} decimals="whole" /> },
    { key: 'by', header: 'By', width: '100px', sortValue: (r) => r.by, csv: (r) => r.by, cell: (r) => <span className="text-body text-ink-muted">{r.by}</span> },
    { key: 'reason', header: 'Reason', width: 'minmax(160px,1.4fr)', csv: (r) => r.reason ?? '', cell: (r) => <span className="text-body text-ink-muted" title={r.reason ?? undefined}>{r.reason ?? ''}</span> },
  ];

  const types = (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => ({ value: t, label: MOVEMENT_LABEL[t] }));

  return (
    <DataTable
      leading={
        <>
          <UrlSelect
            param="range"
            label="Range"
            allLabel={null}
            options={[
              { value: '3', label: 'Last 3 business days' },
              { value: '1', label: 'This business day' },
              { value: '7', label: 'Last 7 business days' },
              { value: '28', label: 'Last 28 business days' },
            ]}
          />
          {variantName ? (
            <ButtonLink href="/console/inventory/movements" variant="secondary" icon={IconX}>
              {variantName} only
            </ButtonLink>
          ) : null}
        </>
      }
      id="inventory-movements"
      caption="Stock movements"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'at', dir: 'desc' }}
      search={{ placeholder: 'Search products', test: (r, q) => r.variant.toLowerCase().includes(q) }}
      filters={[
        { kind: 'select', key: 'type', label: 'Type', options: types, test: (r, v) => r.type === v },
        { kind: 'select', key: 'location', label: 'Location', options: locations, test: (r, v) => r.locationId === v },
      ]}
      exportName="movements"
      empty={{ title: 'No movements in this range', body: 'Widen the date range to see earlier movements.' }}
    />
  );
}
