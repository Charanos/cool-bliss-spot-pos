'use client';

import { FloorDialog } from '@bliss/ui/components/floor/sheet';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { voidLine } from '@/lib/pos/mutations';
import { requestApproval } from '@/lib/pos/session';

export interface VoidTarget {
  lineId: string;
  title: string;
  poured: boolean;
  ranOut: boolean;
}

/**
 * Void a line from the counter, docs/06 section 6.7. A line that ran out while a tablet was offline
 * arrives with its reason written; a poured line needs a supervisor's own PIN inside the dialog.
 */
export function VoidLineDialog({ target, onClose }: { target: VoidTarget | null; onClose: () => void }) {
  return (
    <FloorDialog open={Boolean(target)} onClose={onClose} title={target ? `Void ${target.title}?` : ''} description="It comes off the tab and its stock goes back on the shelf. It cannot be undone." width="md">
      {target ? (
        <ReasonForm
          key={target.lineId}
          focus="chip"
          quickReasons={['Ran out', 'Wrong item', 'Customer changed mind']}
          initialReason={target.ranOut ? 'Ran out while the tablet was offline' : ''}
          confirmLabel="Void the line"
          approval={target.poured ? { label: 'Approve with your PIN' } : null}
          onCancel={onClose}
          onConfirm={async ({ reason, approverPin }) => {
            let token: string | null = null;
            if (target.poured) {
              const approval = await requestApproval(approverPin ?? '', 'void.approve');
              if (!approval.ok) throw new Error(approval.message);
              token = approval.token;
            }
            await voidLine({ lineId: target.lineId, reason, approvalToken: token });
            onClose();
          }}
        />
      ) : null}
    </FloorDialog>
  );
}
