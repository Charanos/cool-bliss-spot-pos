'use client';

import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconCheck, IconPackageImport, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approvePurchaseOrder, cancelPurchaseOrder } from '../../../_actions/purchasing';

/** What can be done with an order in its state: approve a draft, receive against it, cancel the rest. */
export function OrderActions({ orderId, number, status }: { orderId: string; number: number; status: PurchaseOrderStatus }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [approving, startApprove] = useTransition();
  const [error, setError] = useState('');
  const receivable = status === 'sent' || status === 'partially_received';
  const open = status !== 'received' && status !== 'cancelled';

  return (
    <>
      {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
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
