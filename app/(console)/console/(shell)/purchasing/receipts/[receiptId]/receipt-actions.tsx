'use client';

import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconArrowBackUp, IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveReceiptVariance, reverseGoodsReceipt } from '../../../_actions/purchasing';

/** Accept a short delivery's difference, or reverse the delivery. Each asks for a reason and is audited. */
export function ReceiptActions({ receiptId, title, canApprove, canReverse }: { receiptId: string; title: string; canApprove: boolean; canReverse: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<'approve' | 'reverse' | null>(null);
  if (!canApprove && !canReverse) return null;
  return (
    <>
      {canReverse ? (
        <Button variant="quiet-destructive" size="sm" icon={IconArrowBackUp} onClick={() => setOpen('reverse')}>
          Reverse
        </Button>
      ) : null}
      {canApprove ? (
        <Button variant="primary" size="sm" icon={IconCheck} onClick={() => setOpen('approve')}>
          Accept the difference
        </Button>
      ) : null}

      <ConsoleOverlay open={open === 'approve'} onClose={() => setOpen(null)} title={`Accept the difference on ${title.toLowerCase()}?`} description="The short lines stay open on the order until they come or are cancelled." width="md">
        {open === 'approve' ? (
          <ReasonForm
            destructive={false}
            quickReasons={['Rest comes next delivery', 'Credit note agreed', 'Supplier out of stock']}
            confirmLabel="Accept the difference"
            onCancel={() => setOpen(null)}
            onConfirm={async ({ reason }) => {
              const r = await approveReceiptVariance({ receiptId, note: reason });
              if (!r.ok) throw new Error(r.message);
              setOpen(null);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>

      <ConsoleOverlay open={open === 'reverse'} onClose={() => setOpen(null)} title={`Reverse ${title.toLowerCase()}?`} description="Its stock comes back out of the store and the order is reopened. Only possible while none of it has been used." width="md">
        {open === 'reverse' ? (
          <ReasonForm
            destructive
            quickReasons={['Recorded twice', 'Wrong supplier', 'Delivery sent back whole']}
            confirmLabel={`Reverse ${title.toLowerCase()}`}
            onCancel={() => setOpen(null)}
            onConfirm={async ({ reason }) => {
              const r = await reverseGoodsReceipt({ receiptId, reason });
              if (!r.ok) throw new Error(r.message);
              setOpen(null);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>
    </>
  );
}
