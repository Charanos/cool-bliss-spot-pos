'use client';

import { Button } from '@bliss/ui/components/button';
import { TextField } from '@bliss/ui/components/fields';
import { IconFlask } from '@tabler/icons-react';
import { useState } from 'react';
import { setTrialStock } from '../../_actions/inventory';
import { ReasonDialog } from '../../_components/forms';

/**
 * A trial run before handover: every stock-kept drink counted to one figure at the bar, so the floor
 * sells it down, shows it low and finished, and the counts and alerts behave as on a real night.
 */
export function TrialStock() {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('10');
  return (
    <>
      <Button variant="outline" icon={IconFlask} onClick={() => setOpen(true)}>
        Trial stock
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Set every drink for a trial run"
        description="Each stock-kept drink is counted to this figure at the bar, recorded as a count with your reason. Shisha and food are left alone. A real count or delivery later replaces it."
        confirmLabel={`Set every drink to ${qty || 0}`}
        destructive={false}
        quickReasons={['Trial run with the staff before handover', 'Testing sales and stock alerts']}
        run={(reason) => setTrialStock({ qty: Number(qty || 0), reason })}
        toast={(r) => ({ title: 'Trial stock set', body: `${(r as { moved?: number }).moved ?? 0} drinks now read ${qty} on hand.` })}
      >
        <TextField label="On hand, each" value={qty} mono inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} helper="Whole units: bottles, cans, packets." />
      </ReasonDialog>
    </>
  );
}
