'use client';

import { Button, IconButton } from '@bliss/ui/components/button';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { cx } from '@bliss/ui/lib/cx';
import { IconX } from '@tabler/icons-react';

export interface IntakeLine {
  key: string;
  purchaseOrderLineId: string | null;
  variantId: string;
  /** What the order still expects; null for a line added by hand. */
  qtyExpected: number | null;
  qtyReceived: string;
  qtyRejected: string;
  rejectionReason: string;
  batchNumber: string;
  expiryDate: string;
  /** Shillings, as typed. Only a delivery with no order states its own cost. */
  unitCost: string;
}

const REJECTION_REASONS = ['Damaged in transit', 'Expired or short dated', 'Broken seal', 'Wrong item'];

export const whole = (value: string) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * One line of a delivery: what came, how many were accepted and rejected, and the batch and expiry
 * that FEFO draws on. Against an order the item and cost are the order's; by hand, both are chosen.
 */
export function IntakeLineEditor({
  line,
  index,
  againstOrder,
  itemName,
  itemOptions,
  onChange,
  onRemove,
}: {
  line: IntakeLine;
  index: number;
  againstOrder: boolean;
  itemName: string;
  itemOptions: { value: string; label: string }[];
  onChange: (patch: Partial<IntakeLine>) => void;
  onRemove?: () => void;
}) {
  const received = whole(line.qtyReceived);
  const rejected = whole(line.qtyRejected);
  const short = line.qtyExpected !== null && received < line.qtyExpected;
  const id = `line-${line.key}`;

  return (
    <li className="flex flex-col gap-16 border-b border-rule px-20 py-20 last:border-b-0" aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="label-caps text-ink-subtle" id={`${id}-title`}>
            Line {index + 1}
            {againstOrder ? `, ${itemName}` : ''}
          </span>
          {againstOrder ? (
            <p className="flex flex-wrap items-baseline gap-x-12 text-ui text-ink">
              <span className="font-medium">{itemName}</span>
              <span className={cx('text-body-sm', short ? 'text-low' : 'text-ink-muted')}>
                {line.qtyExpected} still expected on the order{short ? `, ${line.qtyExpected! - received} short` : ''}
              </span>
            </p>
          ) : (
            <SelectField label="Item" hideLabel value={line.variantId} onChange={(e) => onChange({ variantId: e.target.value })} options={itemOptions} required />
          )}
        </div>
        {onRemove ? <IconButton icon={IconX} label={`Remove line ${index + 1}`} variant="ghost" size="sm" onClick={onRemove} /> : null}
      </div>

      <div className={cx('grid grid-cols-2 gap-16', againstOrder ? 'desktop:grid-cols-4' : 'desktop:grid-cols-5')}>
        <TextField id={`${id}-received`} label="Accepted" size="md" type="number" inputMode="numeric" min={0} value={line.qtyReceived} onChange={(e) => onChange({ qtyReceived: e.target.value })} placeholder="0" />
        <TextField id={`${id}-rejected`} label="Rejected" size="md" type="number" inputMode="numeric" min={0} value={line.qtyRejected} onChange={(e) => onChange({ qtyRejected: e.target.value })} placeholder="0" />
        {againstOrder ? null : (
          <TextField
            id={`${id}-cost`}
            label="Cost each, KES"
            size="md"
            inputMode="decimal"
            value={line.unitCost}
            onChange={(e) => onChange({ unitCost: e.target.value.replace(/[^\d.]/g, '') })}
            placeholder="0.00"
            required
          />
        )}
        <TextField id={`${id}-batch`} label="Batch" size="md" value={line.batchNumber} onChange={(e) => onChange({ batchNumber: e.target.value })} placeholder="Optional" autoComplete="off" />
        <TextField id={`${id}-expiry`} label="Expires" size="md" type="date" value={line.expiryDate} onChange={(e) => onChange({ expiryDate: e.target.value })} />
      </div>

      {rejected > 0 ? (
        <div className="flex flex-col gap-8 rounded-md bg-stop-wash px-16 py-12">
          <TextField
            id={`${id}-reason`}
            label={`Why ${rejected === 1 ? 'the unit was' : `the ${rejected} units were`} rejected`}
            size="md"
            value={line.rejectionReason}
            onChange={(e) => onChange({ rejectionReason: e.target.value })}
            placeholder="Two bottles broken in the crate"
            required
          />
          <div className="flex flex-wrap items-center gap-6">
            {REJECTION_REASONS.map((r) => (
              <Button key={r} type="button" size="xs" variant="outline" onClick={() => onChange({ rejectionReason: r })}>
                {r}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
