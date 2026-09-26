'use client';

import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, compare, formatDecimal, multiplyByQty, parseKes, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextArea, TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { type FormEvent, useMemo, useState, useTransition } from 'react';
import type { ActionResult } from '../../_lib/action-result';

export interface OrderSupplier {
  id: string;
  name: string;
  minOrderCents: Cents;
  leadTimeDays: number;
  items: { variantId: string; packSize: number; costCents: Cents }[];
}

export interface OrderStockItem {
  id: string;
  name: string;
  avgCostCents: Cents;
}

export interface OrderDraftLine {
  variantId: string;
  qty: number;
  unitCostCents: Cents;
}

export interface OrderFormValue {
  supplierId: string;
  lines: { variantId: string; qty: number; unitCost: string }[];
  expectedAt: string | null;
  notes: string | null;
  requestId: string;
}

type Line = { key: string; variantId: string; qty: string; cost: string };
let nextKey = 0;
const key = () => `l${(nextKey += 1)}`;

const parse = (value: string): Cents | null => {
  try {
    return value.trim() ? parseKes(value) : null;
  } catch {
    return null;
  }
};

/**
 * An order to a supplier: who, what, how many, at what cost, when it is due, and a note. The
 * supplier's own items come first with their pack and last cost filled in; anything else stocked can
 * be added at its average cost. The total, and whether it meets the supplier's minimum, update as
 * lines change. Used to raise a new order and to change one before anything arrives.
 */
export function OrderForm({
  suppliers,
  stock,
  initial,
  lockSupplier,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  suppliers: OrderSupplier[];
  stock: OrderStockItem[];
  initial: { supplierId: string; lines: OrderDraftLine[]; expectedAt: string | null; notes: string | null };
  lockSupplier?: boolean;
  submitLabel: string;
  onSubmit: (value: OrderFormValue) => Promise<ActionResult<object>>;
  onCancel?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [lines, setLines] = useState<Line[]>(() => (initial.lines.length > 0 ? initial.lines.map((l) => ({ key: key(), variantId: l.variantId, qty: String(l.qty), cost: formatDecimal(l.unitCostCents) })) : []));
  const [expectedAt, setExpectedAt] = useState(initial.expectedAt ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const requestId = useMemo(() => createUuidV7()(), []);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const byId = new Map(stock.map((s) => [s.id, s]));

  const options = useMemo(() => {
    const theirs = new Set(supplier?.items.map((i) => i.variantId) ?? []);
    const mine = stock.filter((s) => theirs.has(s.id)).map((s) => ({ value: s.id, label: s.name }));
    const others = stock.filter((s) => !theirs.has(s.id)).map((s) => ({ value: s.id, label: `${s.name}, not from them yet` }));
    return [...mine, ...others];
  }, [supplier, stock]);

  const costFor = (variantId: string) => supplier?.items.find((i) => i.variantId === variantId)?.costCents ?? byId.get(variantId)?.avgCostCents ?? null;
  const packFor = (variantId: string) => supplier?.items.find((i) => i.variantId === variantId)?.packSize ?? 1;

  const add = () => {
    const taken = new Set(lines.map((l) => l.variantId));
    const next = options.find((o) => !taken.has(o.value));
    if (!next) return;
    const cost = costFor(next.value);
    setLines((all) => [...all, { key: key(), variantId: next.value, qty: String(packFor(next.value)), cost: cost ? formatDecimal(cost) : '' }]);
  };
  const set = (k: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  const totals = lines.map((l) => {
    const cost = parse(l.cost);
    const qty = Number(l.qty);
    return cost && Number.isInteger(qty) && qty > 0 ? multiplyByQty(cost, qty) : null;
  });
  const total = sum(totals.filter((t): t is Cents => t !== null));
  const belowMinimum = Boolean(supplier) && compare(total, supplier!.minOrderCents) < 0 && lines.length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    start(async () => {
      const result = await onSubmit({ supplierId, lines: lines.map((l) => ({ variantId: l.variantId, qty: Number(l.qty), unitCost: l.cost })), expectedAt: expectedAt || null, notes: notes || null, requestId });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-24">
      {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
      <div className="grid grid-cols-1 gap-16 desktop:grid-cols-3">
        <SelectField
          label="Supplier"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setLines([]);
          }}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          disabled={lockSupplier}
          helper={supplier ? `Delivers in ${supplier.leadTimeDays} ${supplier.leadTimeDays === 1 ? 'day' : 'days'}` : undefined}
        />
        <TextField type="date" label="Expected" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} helper="When it should arrive." />
      </div>

      <fieldset className="flex flex-col gap-8">
        <legend className="mb-8 label-caps text-ink-subtle">Lines</legend>
        {lines.length === 0 ? <p className="text-body-sm text-ink-muted">No lines yet. Add what to order.</p> : null}
        {lines.map((l, i) => (
          <div key={l.key} className="grid grid-cols-1 items-end gap-8 desktop:grid-cols-[minmax(0,2fr)_100px_140px_140px_40px]">
            <SelectField
              label="Item"
              hideLabel={i > 0}
              value={l.variantId}
              onChange={(e) => {
                const cost = costFor(e.target.value);
                set(l.key, { variantId: e.target.value, cost: cost ? formatDecimal(cost) : l.cost, qty: String(packFor(e.target.value)) });
              }}
              options={options}
            />
            <TextField label="Units" hideLabel={i > 0} value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} inputMode="numeric" helper={i === lines.length - 1 && packFor(l.variantId) > 1 ? `Packs of ${packFor(l.variantId)}` : undefined} />
            <TextField label="Each, KES" hideLabel={i > 0} value={l.cost} onChange={(e) => set(l.key, { cost: e.target.value })} inputMode="decimal" />
            <span className="flex h-control-md items-center justify-end">{totals[i] ? <Money value={totals[i]!} size="num-md" /> : <span className="text-body-sm text-ink-subtle">None</span>}</span>
            <Button type="button" variant="ghost" iconOnly icon={IconTrash} aria-label="Remove this line" onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" icon={IconPlus} className="w-fit" onClick={add} disabled={!supplier}>
          Add a line
        </Button>
      </fieldset>

      <TextArea label="Note for the supplier" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Deliver to the back door before 16:00." />

      <div className="sticky bottom-0 z-sticky flex flex-wrap items-center justify-between gap-16 rounded-card px-20 py-12 card-surface shadow-popover">
        <span className="flex flex-col">
          <span className="label-caps text-ink-subtle">Order total</span>
          <Money value={total} size="num-lg" />
          {belowMinimum ? <span className="text-body-sm text-attention">Below their minimum of <Money value={supplier!.minOrderCents} size="num-sm" tone="attention" decimals="whole" /></span> : null}
        </span>
        <span className="flex gap-12">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={pending} disabled={lines.length === 0}>
            {submitLabel}
          </Button>
        </span>
      </div>
    </form>
  );
}
