'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { plural } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconCheck, IconPackageImport, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approvePurchaseOrder, cancelPurchaseOrder } from '../../../_actions/purchasing';

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

export function OrderDetail({ order, lines, receipts }: { order: { id: string; number: number; status: PurchaseOrderStatus; total: Cents }; lines: Line[]; receipts: Receipt[] }) {
  const router = useRouter();
  const receivable = order.status === 'sent' || order.status === 'partially_received';
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
            {receivable ? (
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

        {
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
        }
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
