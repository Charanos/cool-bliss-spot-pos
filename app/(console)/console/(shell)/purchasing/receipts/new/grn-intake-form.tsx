'use client';

import { createUuidV7 } from '@bliss/shared/id';
import { plural } from '@bliss/shared/format';
import { type Cents, cents, formatDecimal } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextArea, TextField } from '@bliss/ui/components/fields';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { recordGoodsReceipt } from '../../../_actions/purchasing';
import { type IntakeLine, IntakeLineEditor, whole } from './intake-line';
import { IntakePhotos } from './intake-photos';

export interface IntakeItem {
  id: string;
  name: string;
  supplierIds: string[];
  /** The running average cost, as a starting figure for a delivery with no order. */
  unitCostCents: Cents;
}

export interface IntakeOrder {
  id: string;
  poNumber: number;
  supplierId: string;
  lines: { purchaseOrderLineId: string; variantId: string; qtyExpected: number }[];
}

const newId = createUuidV7();

/**
 * Receive a delivery, against an order or by hand. One write: the delivery, its lines, its photos
 * and its stock movements go in together or not at all. A request id made when the page opens means
 * a double click, or a retry after a dropped connection, records the delivery once.
 */
export function GrnIntakeForm({ suppliers, items, order }: { suppliers: { value: string; label: string }[]; items: IntakeItem[]; order: IntakeOrder | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [requestId] = useState(() => newId());
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? '');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [varianceNote, setVarianceNote] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [lines, setLines] = useState<IntakeLine[]>(() =>
    (order?.lines ?? []).map((l) => ({
      key: l.purchaseOrderLineId,
      purchaseOrderLineId: l.purchaseOrderLineId,
      variantId: l.variantId,
      qtyExpected: l.qtyExpected,
      qtyReceived: String(l.qtyExpected),
      qtyRejected: '',
      rejectionReason: '',
      batchNumber: '',
      expiryDate: '',
      unitCost: '',
    })),
  );

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemOptions = useMemo(() => {
    const fromSupplier = items.filter((i) => supplierId && i.supplierIds.includes(supplierId));
    return (fromSupplier.length > 0 ? fromSupplier : items).map((i) => ({ value: i.id, label: i.name }));
  }, [items, supplierId]);

  const accepted = lines.reduce((n, l) => n + whole(l.qtyReceived), 0);
  const rejected = lines.reduce((n, l) => n + whole(l.qtyRejected), 0);
  const short = lines.filter((l) => l.qtyExpected !== null && whole(l.qtyReceived) < l.qtyExpected).length;

  const patch = (key: string, change: Partial<IntakeLine>) =>
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...change };
        // A different item starts from its own cost, not the last one's.
        if (change.variantId && change.variantId !== l.variantId) next.unitCost = formatDecimal(itemById.get(change.variantId)?.unitCostCents ?? cents(0));
        return next;
      }),
    );

  const addLine = () => {
    const first = itemOptions[0]?.value ?? '';
    setLines((current) => [
      ...current,
      {
        key: newId(),
        purchaseOrderLineId: null,
        variantId: first,
        qtyExpected: null,
        qtyReceived: '1',
        qtyRejected: '',
        rejectionReason: '',
        batchNumber: '',
        expiryDate: '',
        unitCost: formatDecimal(itemById.get(first)?.unitCostCents ?? cents(0)),
      },
    ]);
  };

  function problem(): string | null {
    if (!supplierId) return 'Choose the supplier.';
    if (!deliveryNoteRef.trim()) return "Enter the number on the supplier's delivery note.";
    if (lines.length === 0) return 'Add at least one line.';
    if (accepted + rejected === 0) return 'Nothing was accepted or rejected. Enter what came.';
    for (const [i, l] of lines.entries()) {
      if (!l.variantId) return `Choose the item on line ${i + 1}.`;
      if (whole(l.qtyRejected) > 0 && l.rejectionReason.trim().length < 3) return `Say why units on line ${i + 1} were rejected.`;
      if (!order && !/^\d+(\.\d{1,2})?$/.test(l.unitCost)) return `Enter the cost each on line ${i + 1}, in shillings.`;
    }
    if (short > 0 && varianceNote.trim().length < 10) return 'Part of this delivery is short. Say what happens to the rest in the variance note.';
    return null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = problem();
    setError(found ?? '');
    if (found) return;
    start(async () => {
      const result = await recordGoodsReceipt({
        purchaseOrderId: order?.id ?? null,
        supplierId,
        deliveryNoteRef: deliveryNoteRef.trim(),
        invoiceNumber: invoiceNumber.trim() || null,
        varianceNote: varianceNote.trim() || null,
        mediaUrls,
        requestId,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          qtyExpected: l.qtyExpected,
          qtyReceived: whole(l.qtyReceived),
          qtyRejected: whole(l.qtyRejected),
          rejectionReason: l.rejectionReason.trim() || null,
          batchNumber: l.batchNumber.trim() || null,
          expiryDate: l.expiryDate || null,
          // Against an order the order's cost is the cost; a delivery with no order states its own.
          unitCost: order ? null : l.unitCost,
        })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/console/purchasing/receipts/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-24">
      <Card aria-labelledby="intake-delivery">
        <CardHeader band level="h2" titleId="intake-delivery" title="The delivery" subtitle="As written on the supplier's delivery note." />
        <CardBody className="grid grid-cols-1 gap-20 pt-20 desktop:grid-cols-3">
          <SelectField label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={[{ value: '', label: 'Choose the supplier' }, ...suppliers]} disabled={Boolean(order)} required />
          <TextField label="Delivery note number" size="md" value={deliveryNoteRef} onChange={(e) => setDeliveryNoteRef(e.target.value)} placeholder="DN-1042" autoComplete="off" required />
          <TextField label="Invoice number" size="md" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Optional" autoComplete="off" />
        </CardBody>
      </Card>

      <Card aria-labelledby="intake-photos">
        <CardHeader band level="h2" titleId="intake-photos" title="Photos and scans" subtitle="The signed delivery note, the invoice, anything damaged." />
        <CardBody className="pt-16">
          <IntakePhotos urls={mediaUrls} onChange={setMediaUrls} />
        </CardBody>
      </Card>

      <Card aria-labelledby="intake-lines">
        <CardHeader
          band
          level="h2"
          titleId="intake-lines"
          title="Lines"
          subtitle={order ? `Against order ${order.poNumber}. Enter what was accepted and what was sent back.` : 'Each item that came, with its cost.'}
          actions={
            order ? null : (
              <Button type="button" size="sm" variant="secondary" icon={IconPlus} onClick={addLine} disabled={items.length === 0}>
                Add a line
              </Button>
            )
          }
        />
        {lines.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-12 py-40 text-center">
            <p className="text-ui text-ink">No lines yet</p>
            <p className="measure text-body-sm text-ink-muted">Add each item on the delivery note. To receive against an order, open the order and choose Receive.</p>
            <Button type="button" size="sm" variant="primary" icon={IconPlus} onClick={addLine} disabled={items.length === 0}>
              Add the first line
            </Button>
          </CardBody>
        ) : (
          <ul className="flex flex-col">
            {lines.map((line, i) => (
              <IntakeLineEditor
                key={line.key}
                line={line}
                index={i}
                againstOrder={Boolean(order)}
                itemName={itemById.get(line.variantId)?.name ?? 'Item no longer stocked'}
                itemOptions={itemOptions}
                onChange={(change) => patch(line.key, change)}
                onRemove={order ? undefined : () => setLines((current) => current.filter((l) => l.key !== line.key))}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="intake-variance" tone={short > 0 ? 'low' : undefined}>
        <CardHeader
          band
          level="h2"
          titleId="intake-variance"
          title="Variance note"
          subtitle={short > 0 ? `${plural(short, 'line')} short. Say what happens to the rest: a later delivery, a credit note, or nothing.` : 'Optional. Anything worth knowing about this delivery.'}
        />
        <CardBody className="pt-16">
          <TextArea aria-label="Variance note" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} rows={3} placeholder="Supplier out of Tusker 500ml; the rest comes Tuesday." />
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-sticky -mx-4 flex flex-wrap items-center justify-between gap-16 rounded-card px-20 py-12 card-surface shadow-popover">
        <p className="flex items-center gap-8 text-body-sm text-ink-muted" aria-live="polite">
          <span aria-hidden="true" className={cx('size-dot rounded-dot', lines.length > 0 ? 'bg-accent' : 'bg-hairline')} />
          {lines.length === 0 ? 'No lines yet' : `${plural(lines.length, 'line')}, ${accepted} accepted${rejected > 0 ? `, ${rejected} rejected` : ''}${short > 0 ? `, ${short} short` : ''}`}
        </p>
        <div className="flex items-center gap-12">
          {error ? (
            <InlineNotice tone="stop" className="max-w-totals">
              {error}
            </InlineNotice>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => router.push(order ? `/console/purchasing/orders/${order.id}` : '/console/purchasing/receipts')} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={IconCheck} loading={pending} disabled={lines.length === 0}>
            {lines.length > 0 ? `Receive ${plural(lines.length, 'line')}` : 'Receive'}
          </Button>
        </div>
      </div>
    </form>
  );
}
