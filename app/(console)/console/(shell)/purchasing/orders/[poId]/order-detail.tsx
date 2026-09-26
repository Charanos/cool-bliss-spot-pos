'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconCheck, IconPackageImport, IconPencil, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approvePurchaseOrder, cancelPurchaseOrder, updatePurchaseOrder } from '../../../_actions/purchasing';
import { type OrderDraftLine, OrderForm, type OrderStockItem, type OrderSupplier } from '../../_parts/order-form';

/** What can be done with an order in its state: approve a draft, receive against it, cancel the rest. */
export function OrderActions({
  orderId,
  number,
  status,
  editable,
}: {
  orderId: string;
  number: number;
  status: PurchaseOrderStatus;
  /** Present while nothing has arrived: what the edit form starts from. */
  editable: { suppliers: OrderSupplier[]; stock: OrderStockItem[]; initial: { supplierId: string; lines: OrderDraftLine[]; expectedAt: string | null; notes: string | null } } | null;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approving, startApprove] = useTransition();
  const [error, setError] = useState('');
  const receivable = status === 'sent' || status === 'partially_received';
  const open = status !== 'received' && status !== 'cancelled';

  return (
    <>
      {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
      {editable ? (
        <Button variant="outline" icon={IconPencil} onClick={() => setEditing(true)}>
          Change the order
        </Button>
      ) : null}
      {open ? (
        <Button variant="quiet-destructive" size="sm" icon={IconX} onClick={() => setCancelling(true)}>
          {status === 'partially_received' ? 'Cancel the rest' : 'Cancel the order'}
        </Button>
      ) : null}
      {status === 'draft' ? (
        <Button
          variant="primary"
          size="sm"
          icon={IconCheck}
          loading={approving}
          onClick={() =>
            startApprove(async () => {
              setError('');
              const r = await approvePurchaseOrder({ purchaseOrderId: orderId });
              if (!r.ok) setError(r.message);
              else router.refresh();
            })
          }
        >
          Approve and mark sent
        </Button>
      ) : null}
      {receivable ? (
        <ButtonLink href={`/console/purchasing/receipts/new?poId=${orderId}`} variant="primary" icon={IconPackageImport}>
          Receive a delivery
        </ButtonLink>
      ) : null}

      {editable ? (
        <ConsoleOverlay open={editing} onClose={() => setEditing(false)} title={`Change order ${number}`} description="Nothing has arrived against it yet, so its lines, costs and date can still change." width="lg">
          {editing ? (
            <OrderForm
              suppliers={editable.suppliers}
              stock={editable.stock}
              initial={editable.initial}
              lockSupplier
              submitLabel="Save the order"
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                const result = await updatePurchaseOrder({ id: orderId, lines: v.lines, expectedAt: v.expectedAt, notes: v.notes });
                if (result.ok) {
                  setEditing(false);
                  router.refresh();
                }
                return result;
              }}
            />
          ) : null}
        </ConsoleOverlay>
      ) : null}

      <ConsoleOverlay open={cancelling} onClose={() => setCancelling(false)} title={`Cancel order ${number}?`} description="Anything already received stays in stock. The rest is no longer expected." width="md">
        {cancelling ? (
          <ReasonForm
            quickReasons={['Supplier out of stock', 'Ordered elsewhere', 'Raised in error']}
            confirmLabel="Cancel the order"
            cancelLabel="Keep the order"
            onCancel={() => setCancelling(false)}
            onConfirm={async ({ reason }) => {
              const r = await cancelPurchaseOrder({ purchaseOrderId: orderId, reason });
              if (!r.ok) throw new Error(r.message);
              setCancelling(false);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>
    </>
  );
}
