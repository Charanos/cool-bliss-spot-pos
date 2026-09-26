'use client';

import { Button } from '@bliss/ui/components/button';
import { TextField } from '@bliss/ui/components/fields';
import { IconClockStop } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { closeShift } from '../../../_actions/trade';
import { ReasonDialog, useDialog } from '../../../_components/forms';

/** End a shift somebody forgot to end, at the time it really ended. */
export function ShiftActions({ shiftId, name, startedAt, suggestedEnd }: { shiftId: string; name: string; startedAt: string; suggestedEnd: string }) {
  const dialog = useDialog<'close'>();
  const [endedAt, setEndedAt] = useState(suggestedEnd);
  useEffect(() => {
    if (dialog.is('close')) setEndedAt(suggestedEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [dialog.is('close')]);
  return (
    <>
      <Button variant="secondary" icon={IconClockStop} onClick={() => dialog.open('close', null)}>
        End the shift
      </Button>
      <ReasonDialog
        open={dialog.is('close')}
        onClose={dialog.close}
        title={`End ${name}'s shift?`}
        description="For a shift left open after they went home. Their hours end at the time you set; their tabs stay as they are."
        confirmLabel="End the shift"
        destructive={false}
        quickReasons={['Forgot to sign out', 'Tablet went flat', 'Left early']}
        run={(reason) => closeShift({ shiftId, endedAt, reason })}
      >
        <div className="pb-16">
          <TextField label="Ended at" type="datetime-local" value={endedAt} min={startedAt} onChange={(e) => setEndedAt(e.target.value)} required helper="In the venue's time." />
        </div>
      </ReasonDialog>
    </>
  );
}
