'use client';

import { SelectField, TextField } from '@bliss/ui/components/fields';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { saveRule } from '../../_actions/menu';
import { DaysField, Fieldset, FormDialog } from '../../_components/forms';

export interface RuleDraft {
  id: string;
  name: string;
  priceListId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority: number;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const spans = (r: Pick<RuleDraft, 'startTime' | 'endTime'>): [number, number][] => {
  const s = minutes(r.startTime);
  const e = minutes(r.endTime);
  return e > s ? [[s, e]] : [[s, 1440], [0, e]];
};

/** Add a time rule, or change one. It warns, before saving, when it shares hours with another rule. */
export function RuleDialog({ open, onClose, target, overlays, others }: { open: boolean; onClose: () => void; target: RuleDraft | null; overlays: { value: string; label: string }[]; others: (RuleDraft & { status: string })[] }) {
  const router = useRouter();
  const [f, setF] = useState<Omit<RuleDraft, 'id'>>({ name: '', priceListId: '', daysOfWeek: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '19:00', priority: 10 });
  useEffect(() => {
    if (open) setF(target ? { ...target } : { name: '', priceListId: overlays[0]?.value ?? '', daysOfWeek: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '19:00', priority: 10 });
  }, [open, target, overlays]);
  const clashes = useMemo(() => {
    if (!/^\d{2}:\d{2}$/.test(f.startTime) || !/^\d{2}:\d{2}$/.test(f.endTime) || f.startTime === f.endTime) return [];
    const mine = spans(f);
    return others.filter((r) => r.id !== target?.id && r.status === 'active' && r.daysOfWeek.some((d) => f.daysOfWeek.includes(d)) && spans(r).some(([a, b]) => mine.some(([c, d]) => a < d && c < b)));
  }, [f, others, target]);
  const editing = Boolean(target);
  return (
    <FormDialog<{ id: string }>
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target!.name}` : 'Add a time rule'}
      description="In its hours the floor charges the rule's list. A window past midnight belongs to the day it opens."
      submitLabel={editing ? 'Save changes' : 'Add rule'}
      onSubmit={() => saveRule({ id: target?.id ?? null, ...f })}
      onDone={(r) => {
        if (!editing) router.push(`/console/pricing/rules/${r.id}`);
      }}
    >
      <Fieldset columns={2}>
        <TextField label="Name" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Happy hour" required />
        <SelectField label="Charges" value={f.priceListId} onChange={(e) => setF((x) => ({ ...x, priceListId: e.target.value }))} options={overlays} helper="An overlay list." required />
        <TextField label="From" type="time" value={f.startTime} onChange={(e) => setF((x) => ({ ...x, startTime: e.target.value }))} required />
        <TextField label="Until" type="time" value={f.endTime} onChange={(e) => setF((x) => ({ ...x, endTime: e.target.value }))} required />
        <TextField label="Priority" value={String(f.priority)} onChange={(e) => setF((x) => ({ ...x, priority: Number(e.target.value) || 0 }))} inputMode="numeric" helper="Where two rules share an hour, the higher wins." />
      </Fieldset>
      <DaysField label="Days" value={f.daysOfWeek} onChange={(days) => setF((x) => ({ ...x, daysOfWeek: days }))} />
      {clashes.length > 0 ? (
        <InlineNotice tone="low">
          Shares hours with {clashes.map((c) => c.name).join(' and ')}. The one with the higher priority prices those hours.
        </InlineNotice>
      ) : null}
    </FormDialog>
  );
}
