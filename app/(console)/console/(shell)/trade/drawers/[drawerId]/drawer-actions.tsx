'use client';

import { Button } from '@bliss/ui/components/button';
import { IconChecks } from '@tabler/icons-react';
import { acknowledgeDrawer } from '../../../_actions/trade';
import { ReasonDialog, useDialog } from '../../../_components/forms';

/** Review a closed drawer: say it has been looked into and what was done. */
export function DrawerActions({ sessionId, reviewable, title }: { sessionId: string; reviewable: boolean; title: string }) {
  const dialog = useDialog<'review'>();
  if (!reviewable) return null;
  return (
    <>
      <Button variant="primary" icon={IconChecks} onClick={() => dialog.open('review', null)}>
        Mark reviewed
      </Button>
      <ReasonDialog
        open={dialog.is('review')}
        onClose={dialog.close}
        title={`Review ${title}`}
        description="Say what you found and what was done. The note stays with the drawer."
        confirmLabel="Mark reviewed"
        destructive={false}
        quickReasons={['Checked with the cashier', 'Found in the safe count', 'Change given wrongly']}
        run={(note) => acknowledgeDrawer({ sessionId, note })}
      />
    </>
  );
}
