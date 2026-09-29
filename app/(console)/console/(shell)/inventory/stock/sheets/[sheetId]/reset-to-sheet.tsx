'use client';

import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { TextField } from '@bliss/ui/components/fields';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconRestore } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resetToStockSheet } from '../../../../_actions/inventory';

/**
 * Start the outlet again from this sheet, owners only: says exactly what goes and what stays, and asks
 * for RESET and a reason before it runs.
 */
export function ResetToSheet({ sheetId, title, counts }: { sheetId: string; title: string; counts: { bills: number; tabs: number; shifts: number; stockMovements: number; counts: number; deliveries: number; purchaseOrders: number } }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Card aria-labelledby="reset-to-sheet" tone="stop">
      <CardHeader band level="h2" titleId="reset-to-sheet" icon={IconRestore} title="Start again from this sheet" subtitle="When stock or sales from before the sheet sit on top of it" />
      <div className="flex flex-col gap-16 px-20 py-20">
        <p className="measure text-body text-ink-muted">
          Takes away every sale and every stock record ({counts.bills} bills, {counts.tabs} tabs, {counts.shifts} shifts, {counts.stockMovements} stock movements, {counts.counts} counts, {counts.deliveries} deliveries and {counts.purchaseOrders} purchase orders now), including placeholders and trial stock,
          then books the {title.toLowerCase()} on the clean record: its counts become the only stock, and its night the first the reports show. Staff and PINs, devices, zones and tables, the menu with its prices, suppliers and the audit trail stay exactly as they are. Every
          station starts clean at its next sync. It cannot be undone.
        </p>
        {!open ? (
          <Button variant="destructive" icon={IconRestore} onClick={() => setOpen(true)} className="self-start">
            Start again from this sheet
          </Button>
        ) : (
          <div className="flex max-w-[560px] flex-col gap-16">
            <TextField label="Type RESET to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" mono />
            {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
            <ReasonForm
              quickReasons={['Placeholder and trial stock sat on top of the stock take', 'Starting from the first full stock take']}
              confirmLabel="Start again now"
              cancelLabel="Keep everything"
              onCancel={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              onConfirm={async ({ reason }) => {
                setError(null);
                const result = await resetToStockSheet({ sheetId, confirm, reason });
                if (!result.ok) {
                  setError(result.message);
                  throw new Error(result.message);
                }
                notify({ title: 'Started again from the sheet', body: result.summary });
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
