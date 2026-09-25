'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { plural } from '@bliss/shared/format';
import { type Cents, multiplyByQty, sum } from '@bliss/shared/money';
import { REASON_MIN_LENGTH, checkReason } from '@bliss/shared/reason';
import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { TextArea, TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconCheck, IconPackageImport, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approvePurchaseOrder, cancelPurchaseOrder, receiveAgainstOrder } from '../../../_actions';

interface Line {
  id: string;
  name: string;
  ordered: number;
  received: number;
  unitCost: Cents;
  total: Cents;
}

interface Receipt {
  id: string;
  number: number;
  deliveryNote: string;
  at: string;
  by: string;
  note: string | null;
  lines: { id: string; name: string; received: number; rejected: number; reason: string | null }[];
}

const whole = (value: string) => {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : null;
};

export function OrderDetail({ order, lines, receipts, storeName }: { order: { id: string; number: number; status: PurchaseOrderStatus; total: Cents }; lines: Line[]; receipts: Receipt[]; storeName: string }) {
  const router = useRouter();
  const receivable = order.status === 'sent' || order.status === 'partially_received';
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [approving, startApprove] = useTransition();
  const [approveError, setApproveError] = useState<string | null>(null);

  return (
    <div className="mt-24 flex flex-col gap-40">
      <RevealSection aria-labelledby="order-lines">
        <div className="flex flex-wrap items-center justify-between gap-16 pb-12">
          <h3 id="order-lines" className="text-subtitle text-ink">
            {plural(lines.length, 'line')}
          </h3>
          <div className="flex flex-wrap gap-8">
            {order.status === 'draft' ? (
              <Button
                icon={IconCheck}
                loading={approving}
                onClick={() =>
                  startApprove(async () => {
                    const r = await approvePurchaseOrder({ purchaseOrderId: order.id });
                    if (!r.ok) setApproveError(r.message);
                    else router.refresh();
                  })
                }
              >
                Approve and mark sent
              </Button>
            ) : null}
            {receivable && !receiving ? (
              <ButtonLink href={`/console/purchasing/receipts/new?poId=${order.id}`} icon={IconPackageImport}>
                Receive delivery
              </ButtonLink>
            ) : null}
            {order.status !== 'received' && order.status !== 'cancelled' ? (
              <Button variant="quiet-destructive" icon={IconX} onClick={() => setCancelling(true)}>
                Cancel what is outstanding
              </Button>
            ) : null}
          </div>
        </div>
        {approveError ? (
          <InlineNotice tone="stop" className="mb-12">
            {approveError}
          </InlineNotice>
        ) : null}

        {receiving ? (
          <ReceiveForm orderId={order.id} lines={lines} storeName={storeName} onDone={() => setReceiving(false)} />
        ) : (
          <div role="table" aria-label="Order lines">
            <div role="row" className="grid grid-cols-[minmax(200px,2fr)_100px_100px_110px_120px] gap-16 border-y border-hairline py-8">
              {['Item', 'Ordered', 'Received', 'Unit cost', 'Line total'].map((h, i) => (
                <span key={h} role="columnheader" className={i > 0 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
                  {h}
                </span>
              ))}
            </div>
            {lines.map((l) => (
              <div key={l.id} role="row" className="grid min-h-row grid-cols-[minmax(200px,2fr)_100px_100px_110px_120px] items-center gap-16 border-b border-rule">
                <span role="cell" className="truncate text-body text-ink">
                  {l.name}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink">
                  {l.ordered}
                </span>
                <span role="cell" className={`text-right font-mono tabular text-num ${l.received === 0 ? 'text-ink-subtle' : l.received < l.ordered ? 'text-low' : 'text-poured'}`}>
                  {l.received}
                </span>
                <span role="cell" className="text-right">
                  <Money value={l.unitCost} currency={false} tone="muted" />
                </span>
                <span role="cell" className="text-right">
                  <Money value={l.total} currency={false} />
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-end gap-24 pt-12">
              <span className="text-body text-ink-muted">Order value</span>
              <Money value={order.total} size="num-lg" />
            </div>
          </div>
        )}
      </RevealSection>

      <RevealSection aria-labelledby="order-receipts">
        <h3 id="order-receipts" className="border-b border-hairline pb-8 text-subtitle text-ink">
          Deliveries
        </h3>
        {receipts.length === 0 ? (
          <p className="py-16 text-body text-ink-muted">Nothing received against this order yet.</p>
        ) : (
          <ul>
            {receipts.map((r) => (
              <li key={r.id} className="border-b border-rule py-12">
                <p className="text-body text-ink">
                  GRN <span className="font-mono tabular text-num">{r.number}</span> · delivery note <span className="font-mono tabular text-num">{r.deliveryNote}</span>
                </p>
                <p className="text-body-sm text-ink-muted">
                  Received by {r.by}, <span className="font-mono tabular text-num-sm">{r.at}</span>
                </p>
                <ul className="mt-4 text-body-sm text-ink-muted">
                  {r.lines.map((x) => (
                    <li key={x.id}>
                      {x.name}: <span className="font-mono tabular text-num-sm text-ink">{x.received}</span> in
                      {x.rejected > 0 ? (
                        <>
                          , <span className="font-mono tabular text-num-sm text-stop">{x.rejected}</span> sent back: {x.reason}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {r.note ? <p className="mt-4 text-body-sm text-ink">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </RevealSection>

      <ConsoleOverlay open={cancelling} onClose={() => setCancelling(false)} title={`Cancel PO ${order.number}?`} description="Anything already received stays in stock. The rest will not be expected." width="md">
        {cancelling ? (
          <ReasonForm
            quickReasons={['Supplier out of stock', 'Ordered elsewhere', 'Raised in error']}
            confirmLabel="Cancel the order"
            cancelLabel="Keep the order"
            onCancel={() => setCancelling(false)}
            onConfirm={async ({ reason }) => {
              const r = await cancelPurchaseOrder({ purchaseOrderId: order.id, reason });
              if (!r.ok) throw new Error(r.message);
              setCancelling(false);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>
    </div>
  );
}

function ReceiveForm({ orderId, lines, storeName, onDone }: { orderId: string; lines: Line[]; storeName: string; onDone: () => void }) {
  const router = useRouter();
  const open = lines.filter((l) => l.received < l.ordered);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [received, setReceived] = useState<Record<string, string>>(() => Object.fromEntries(open.map((l) => [l.id, String(l.ordered - l.received)])));
  const [rejected, setRejected] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [varianceNote, setVarianceNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = open.map((l) => {
    const outstanding = l.ordered - l.received;
    const inQty = whole(received[l.id] ?? '');
    const outQty = whole(rejected[l.id] ?? '0') ?? (rejected[l.id] ? null : 0);
    const over = inQty !== null && outQty !== null && inQty + outQty > outstanding;
    const short = inQty !== null && inQty < outstanding;
    const needsReason = (outQty ?? 0) > 0 && !checkReason(reasons[l.id] ?? '').ok;
    return { l, outstanding, inQty, outQty, over, short, needsReason };
  });
  const anyShort = rows.some((r) => r.short);
  const value = sum(rows.map((r) => multiplyByQty(r.l.unitCost, r.inQty ?? 0)));
  const blocked =
    deliveryNote.trim() === '' || rows.some((r) => r.inQty === null || r.outQty === null || r.over || r.needsReason) || (anyShort && !checkReason(varianceNote).ok) || rows.every((r) => (r.inQty ?? 0) + (r.outQty ?? 0) === 0);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await receiveAgainstOrder({
        purchaseOrderId: orderId,
        deliveryNoteRef: deliveryNote,
        varianceNote: anyShort ? varianceNote : null,
        lines: rows.map((x) => ({ purchaseOrderLineId: x.l.id, qtyReceived: x.inQty ?? 0, qtyRejected: x.outQty ?? 0, rejectionReason: reasons[x.l.id] ?? null, batchNumber: null, expiryDate: null })),
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <form
      className="border-t border-hairline pt-16"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) submit();
      }}
    >
      <div className="grid max-w-[640px] grid-cols-1 gap-16 tablet:grid-cols-2">
        <TextField label="Supplier delivery note number" size="md" mono value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} autoFocus />
        <p className="self-end pb-8 text-body-sm text-ink-muted">Accepted units go into {storeName} at the order&rsquo;s cost.</p>
      </div>

      <div role="table" aria-label="Receive lines" className="mt-24">
        <div role="row" className="grid grid-cols-[minmax(180px,1.5fr)_90px_110px_110px_minmax(200px,2fr)] gap-16 border-b border-hairline py-8">
          {['Item', 'Outstanding', 'Accepted', 'Sent back', 'Why it was sent back'].map((h, i) => (
            <span key={h} role="columnheader" className={i > 0 && i < 4 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
              {h}
            </span>
          ))}
        </div>
        {rows.map(({ l, outstanding, over, outQty, needsReason }) => (
          <div key={l.id} role="row" className="grid grid-cols-[minmax(180px,1.5fr)_90px_110px_110px_minmax(200px,2fr)] items-start gap-16 border-b border-rule py-8">
            <span role="cell" className="pt-12 text-body text-ink">
              {l.name}
            </span>
            <span role="cell" className="pt-12 text-right font-mono tabular text-num text-ink-muted">
              {outstanding}
            </span>
            <span role="cell">
              <TextField
                label={`Accepted ${l.name}`}
                hideLabel
                size="md"
                mono
                inputMode="numeric"
                className="text-right"
                value={received[l.id] ?? ''}
                onChange={(e) => setReceived((c) => ({ ...c, [l.id]: e.target.value.replace(/[^\d]/g, '') }))}
                error={over ? `No more than ${outstanding}` : undefined}
              />
            </span>
            <span role="cell">
              <TextField
                label={`Sent back ${l.name}`}
                hideLabel
                size="md"
                mono
                inputMode="numeric"
                className="text-right"
                placeholder="0"
                value={rejected[l.id] ?? ''}
                onChange={(e) => setRejected((c) => ({ ...c, [l.id]: e.target.value.replace(/[^\d]/g, '') }))}
              />
            </span>
            <span role="cell">
              {(outQty ?? 0) > 0 ? (
                <TextField
                  label={`Why ${l.name} was sent back`}
                  hideLabel
                  size="md"
                  placeholder="Broken in the crate, wrong size"
                  value={reasons[l.id] ?? ''}
                  onChange={(e) => setReasons((c) => ({ ...c, [l.id]: e.target.value }))}
                  helper={needsReason ? `At least ${REASON_MIN_LENGTH} characters` : undefined}
                />
              ) : (
                <span className="block pt-12 text-body-sm text-ink-subtle">··</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {anyShort ? (
        <div className="mt-24 max-w-[640px]">
          <TextArea
            label="Part of this order did not arrive. What happens to the rest?"
            value={varianceNote}
            onChange={(e) => setVarianceNote(e.target.value)}
            rows={2}
            helper={`At least ${REASON_MIN_LENGTH} characters. Anything not accepted stays on order until it arrives or you cancel it.`}
          />
        </div>
      ) : null}

      {error ? (
        <InlineNotice tone="stop" className="mt-16">
          {error}
        </InlineNotice>
      ) : null}

      <div className="mt-24 flex flex-wrap items-center justify-end gap-12">
        <span className="mr-auto text-body text-ink-muted">
          Adds <Money value={value} tone="default" /> of stock at cost
        </span>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Keep the order as it is
        </Button>
        <Button type="submit" icon={IconPackageImport} loading={pending} disabled={blocked}>
          Post the delivery
        </Button>
      </div>
    </form>
  );
}
