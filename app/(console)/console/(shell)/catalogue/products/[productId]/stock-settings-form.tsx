'use client';

import { Button } from '@bliss/ui/components/button';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateStockSettings } from '../../../_actions/catalogue';

interface Settings {
  lowStockThreshold: number | null;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
}

const toText = (n: number | null) => (n === null ? '' : String(n));
const digits = (s: string) => s.replace(/[^\d]/g, '');

/**
 * N-04. The low threshold is what turns a floor tile amber, so the form says so. Leaving it empty
 * falls back to the outlet default rather than to zero.
 */
export function StockSettingsForm({ productId, initial, outletDefault, unit }: { productId: string; initial: Settings; outletDefault: number; unit: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ low: toText(initial.lowStockThreshold), point: toText(initial.reorderPoint), qty: toText(initial.reorderQty), lead: toText(initial.leadTimeDays) });
  const [message, setMessage] = useState<{ tone: 'stop' | 'poured'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const next: Settings = {
    lowStockThreshold: values.low === '' ? null : Number(values.low),
    reorderPoint: Number(values.point || '0'),
    reorderQty: Number(values.qty || '0'),
    leadTimeDays: Number(values.lead || '0'),
  };
  const changed = JSON.stringify(next) !== JSON.stringify(initial);
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setValues((v) => ({ ...v, [key]: digits(e.target.value) }));
  };

  return (
    <form
      className="mt-12 flex flex-col gap-20"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateStockSettings({ productId, ...next });
          if (!r.ok) setMessage({ tone: 'stop', text: r.message });
          else {
            setMessage({ tone: 'poured', text: 'Saved. The floor picks this up with its next snapshot.' });
            router.refresh();
          }
        });
      }}
    >
      <TextField
        label={`Low at (${unit})`}
        size="md"
        mono
        inputMode="numeric"
        placeholder={String(outletDefault)}
        value={values.low}
        onChange={set('low')}
        helper={values.low === '' ? `Empty uses the outlet default of ${outletDefault}.` : `The floor shows this item as low at ${values.low} or fewer.`}
      />
      <div className="grid grid-cols-2 gap-16">
        <TextField label="Reorder point" size="md" mono inputMode="numeric" value={values.point} onChange={set('point')} helper="Suggest an order at this level" />
        <TextField label="Reorder quantity" size="md" mono inputMode="numeric" value={values.qty} onChange={set('qty')} helper="At least this much" />
      </div>
      <TextField label="Supplier lead time (days)" size="md" mono inputMode="numeric" value={values.lead} onChange={set('lead')} />
      {message ? <InlineNotice tone={message.tone}>{message.text}</InlineNotice> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!changed}>
          Save stock settings
        </Button>
      </div>
    </form>
  );
}
