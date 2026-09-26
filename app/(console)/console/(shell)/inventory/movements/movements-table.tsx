'use client';

import type { MovementType } from '@bliss/shared/domain';
import { formatDateTime, formatQty } from '@bliss/shared/format';
import { type Cents, formatDecimal, multiplyByQuantity, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Money } from '@bliss/ui/components/money';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { IconArrowBackUp, IconBan, IconClipboardCheck, IconReceipt, IconTruckDelivery, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { reverseWriteOff } from '../../_actions/inventory';
import { EntityLink } from '../../_components/entity-link';
import { ReasonDialog, useDialog } from '../../_components/forms';
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
  source: { label: string; href: string | null };
  productId: string | null;
  writeOffGroup: string | null;
  by: string;
  reason: string | null;
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receipt: 'Delivery',
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

/** The stock ledger, newest first: every delivery, sale, write-off and adjustment, with who and why. */
export function MovementsTable({ rows, timezone, locations, variantName }: { rows: MovementRow[]; timezone: string; locations: { value: string; label: string }[]; variantName: string | null }) {
  const dialog = useDialog<'reverse', MovementRow | null>();
  const inValue = sum(rows.filter((r) => r.type === 'receipt').map((r) => multiplyByQuantity(r.unitCost, r.qty)));
  const soldValue = sum(rows.filter((r) => r.type === 'sale').map((r) => multiplyByQuantity(r.unitCost, -r.qty)));
  const writtenOff = rows.filter((r) => r.type.startsWith('write_off') || r.type === 'staff_drink' || r.type === 'comp');
  const writtenOffValue = sum(writtenOff.map((r) => multiplyByQuantity(r.unitCost, -r.qty)));
  const adjustments = rows.filter((r) => r.type === 'count_adjustment');
  const columns: Column<MovementRow>[] = [
    {
      key: 'at',
      header: 'When',
      width: '136px',
      fixed: true,
      sortValue: (r) => r.at,
      csv: (r) => new Date(r.at).toISOString(),
      cell: (r) => <NumCell tone="muted">{formatDateTime(r.at, timezone)}</NumCell>,
    },
    {
      key: 'variant',
      header: 'Product',
      width: 'minmax(150px,1.4fr)',
      sortValue: (r) => r.variant,
      csv: (r) => r.variant,
      cell: (r) => (
        <StackCell
          primary={
            <EntityLink kind="product" id={r.productId}>
              {r.variant}
            </EntityLink>
          }
          secondary={r.location}
        />
      ),
    },
    { key: 'type', header: 'Type', width: '120px', sortValue: (r) => r.type, csv: (r) => MOVEMENT_LABEL[r.type], cell: (r) => <span className="text-ui text-ink">{MOVEMENT_LABEL[r.type]}</span> },
    {
      key: 'qty',
      header: 'Quantity',
      width: '96px',
      align: 'right',
      sortValue: (r) => r.qty,
      csv: (r) => r.qty,
      cell: (r) => (
        <NumCell tone={r.qty < 0 ? 'default' : 'poured'}>
          {r.qty > 0 ? '+' : ''}
          {formatQty(r.qty, 3)}
        </NumCell>
      ),
    },
    {
      key: 'cost',
      header: 'Unit cost',
      width: '0px',
      exportOnly: true,
      align: 'right',
      csv: (r) => formatDecimal(r.unitCost),
      cell: (r) => <Money value={r.unitCost} currency={false} tone="muted" />,
    },
    {
      key: 'value',
      header: 'Value',
      width: '92px',
      align: 'right',
      sortValue: (r) => multiplyByQuantity(r.unitCost, r.qty),
      csv: (r) => formatDecimal(multiplyByQuantity(r.unitCost, r.qty)),
      cell: (r) => <Money value={multiplyByQuantity(r.unitCost, r.qty)} currency={false} size="num-md" decimals="whole" />,
    },
    {
      key: 'source',
      header: 'From',
      width: 'minmax(110px,1fr)',
      sortValue: (r) => r.source.label,
      csv: (r) => r.source.label,
      cell: (r) =>
        r.source.href ? (
          <Link href={r.source.href} className="relative z-raised truncate rounded-sm text-ui text-accent-text transition-hover hover:text-ink">
            {r.source.label}
          </Link>
        ) : (
          <span className="truncate text-ui text-ink-muted">{r.source.label}</span>
        ),
    },
    { key: 'by', header: 'By', width: '88px', sortValue: (r) => r.by, csv: (r) => r.by, cell: (r) => <span className="text-ui text-ink-muted">{r.by}</span> },
    {
      key: 'reason',
      header: 'Reason',
      width: 'minmax(120px,1.2fr)',
      csv: (r) => r.reason ?? '',
      cell: (r) => (
        <span className="truncate text-body-sm text-ink-muted" title={r.reason ?? undefined}>
          {r.reason ?? ''}
        </span>
      ),
    },
  ];

  const types = (Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => ({ value: t, label: MOVEMENT_LABEL[t] }));

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric
          label="Delivered"
          icon={IconTruckDelivery}
          tone="poured"
          value={<Money value={inValue} size="num-kpi" decimals="whole" />}
          detail="At cost, in this range"
          href="/console/purchasing/receipts"
        />
        <Metric label="Sold" icon={IconReceipt} value={<Money value={soldValue} size="num-kpi" decimals="whole" />} detail="At cost, what the sales took" />
        <Metric
          label="Written off"
          icon={IconBan}
          tone={writtenOff.length > 0 ? 'stop' : 'default'}
          value={<Money value={writtenOffValue} size="num-kpi" decimals="whole" />}
          detail={`${writtenOff.length} write-offs, staff drinks and comps`}
        />
        <Metric label="Count adjustments" icon={IconClipboardCheck} value={<CountUp value={adjustments.length} />} detail="From counts committed" href="/console/inventory/counts" />
      </MetricGrid>
      <DataTable
        leading={
          <>
            <UrlSelect
              param="range"
              label="Range"
              allLabel={null}
              fallback="3"
              options={[
                { value: '1', label: 'This business day' },
                { value: '3', label: 'Last 3 business days' },
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
        noun={['movement', 'movements']}
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
        empty={{ title: 'No movements in this range', body: 'Choose a longer range to see earlier movements.' }}
        emptyFiltered={{ title: 'No movements match', body: 'Clear the type, location or search to see every movement in the range.' }}
        rowActions={(r) => (r.writeOffGroup ? [{ key: 'reverse', label: 'Take this write-off back', icon: IconArrowBackUp, onSelect: () => dialog.open('reverse', r) }] : [])}
      />
      <ReasonDialog
        open={dialog.is('reverse') && Boolean(dialog.target)}
        onClose={dialog.close}
        title={`Take back the write-off of ${dialog.target?.variant ?? ''}?`}
        description="The units go back on the shelf, on the lots they came from. Only today's write-offs can be taken back."
        confirmLabel="Take it back"
        destructive={false}
        quickReasons={['Wrong item written off', 'Wrong quantity', 'The bottle was fine']}
        run={(reason) => reverseWriteOff({ groupId: dialog.target!.writeOffGroup!, reason })}
      />
    </div>
  );
}
