'use client';

import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { TextField } from '@bliss/ui/components/fields';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconEraser } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearTradeAction } from '../../_actions/settings';

/**
 * Clear trade, owners only: for the end of a trial run with the staff, before the first real night.
 * Says exactly what goes and what stays, and asks for CLEAR and a reason before it runs.
 */
export function ClearTrade({ counts }: { counts: { tabs: number; bills: number; shifts: number; drawers: number } }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Card aria-labelledby="clear-trade" tone="stop">
      <CardHeader band level="h2" titleId="clear-trade" icon={IconEraser} title="Clear trade" subtitle="After a trial run with the staff, before the first real night" />
      <div className="flex flex-col gap-16 px-20 py-20">
        <p className="measure text-body text-ink-muted">
          Takes away every tab, order, bill, shift and drawer ({counts.tabs} tabs, {counts.bills} bills, {counts.shifts} shifts and {counts.drawers} drawers now), and puts back the stock those sales took. Tables, zones, staff and PINs,
          devices, the menu and its prices, suppliers, deliveries and counts stay exactly as they are. Every station starts clean at its next sync. It cannot be undone; the audit trail keeps who did it and why.
        </p>
        {!open ? (
          <Button variant="destructive" icon={IconEraser} onClick={() => setOpen(true)} className="self-start">
            Clear trade
          </Button>
        ) : (
          <div className="flex max-w-[560px] flex-col gap-16">
            <TextField label="Type CLEAR to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" mono />
            {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
            <ReasonForm
              quickReasons={['Trial run with the staff is over', 'Clearing test orders before opening']}
              confirmLabel="Clear trade now"
              cancelLabel="Keep everything"
              onCancel={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              onConfirm={async ({ reason }) => {
                setError(null);
                const result = await clearTradeAction({ confirm, reason });
                if (!result.ok) {
                  setError(result.message);
                  throw new Error(result.message);
                }
                notify({ title: 'Trade cleared', body: result.summary });
                setOpen(false);
                setConfirm('');
                router.refresh();
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
