'use client';

import { Button } from '@bliss/ui/components/button';
import { IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { cancelCount } from '../../../_actions/inventory';
import { ReasonDialog, useDialog } from '../../../_components/forms';

/** Abandon a count that has not been committed. Nothing it recorded touches the ledger. */
export function CountActions({ countId, label, cancellable }: { countId: string; label: string; cancellable: boolean }) {
  const router = useRouter();
  const dialog = useDialog<'cancel'>();
  if (!cancellable) return null;
  return (
    <>
      <Button variant="quiet-destructive" icon={IconX} onClick={() => dialog.open('cancel', null)}>
        Cancel the count
      </Button>
      <ReasonDialog
        open={dialog.is('cancel')}
        onClose={dialog.close}
        title={`Cancel this ${label.toLowerCase()}?`}
        description="What has been counted is kept on the count for the record, and stock stays as the ledger has it. The location is free for a new count."
        confirmLabel="Cancel the count"
        quickReasons={['Started by mistake', 'Interrupted by service', 'Counting again tomorrow']}
        run={async (reason) => {
          const result = await cancelCount({ countId, reason });
          if (result.ok) router.push('/console/inventory/counts');
          return result;
        }}
      />
    </>
  );
}
