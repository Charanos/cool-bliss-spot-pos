'use client';

import { SelectField, TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { copyPrices, savePriceList } from '../../_actions/menu';
import { Fieldset, FormDialog, ReasonDialog } from '../../_components/forms';

export interface ListDraft {
  id: string;
  name: string;
  kind: 'base' | 'overlay';
  priority: number;
}

/** Add a price list, or rename one and change its priority. Its kind is fixed once made. */
export function PriceListDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: ListDraft | null }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', kind: 'overlay' as 'base' | 'overlay', priority: '10' });
  useEffect(() => {
    if (open) setF({ name: target?.name ?? '', kind: target?.kind ?? 'overlay', priority: String(target?.priority ?? 10) });
  }, [open, target]);
  const editing = Boolean(target);
  return (
    <FormDialog<{ id: string }>
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? `Edit ${target!.name}` : 'Add a price list'}
      description={editing ? 'A higher priority wins where two lists apply at once.' : 'A base list prices everything all day; an overlay, such as happy hour, applies in the hours a time rule gives it.'}
      submitLabel={editing ? 'Save changes' : 'Add list'}
      onSubmit={() => savePriceList({ id: target?.id ?? null, name: f.name, kind: f.kind, priority: Number(f.priority) })}
      onDone={(r) => {
        if (!editing) router.push(`/console/pricing/lists/${r.id}`);
      }}
    >
      <Fieldset columns={editing ? 2 : 3}>
        <TextField label="Name" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Late night" required />
        {editing ? null : (
          <SelectField
            label="Kind"
            value={f.kind}
            onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as 'base' | 'overlay' }))}
            options={[
              { value: 'overlay', label: 'Overlay, in its hours' },
              { value: 'base', label: 'Base, all day' },
            ]}
          />
        )}
        <TextField label="Priority" value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: e.target.value }))} inputMode="numeric" helper="Higher wins." />
      </Fieldset>
    </FormDialog>
  );
}

/** Copy every price one list has onto another, all of them or only the ones it is missing. */
export function CopyPricesDialog({ open, onClose, to, lists }: { open: boolean; onClose: () => void; to: { id: string; name: string }; lists: { value: string; label: string }[] }) {
  const others = lists.filter((l) => l.value !== to.id);
  const [from, setFrom] = useState(others[0]?.value ?? '');
  const [onlyMissing, setOnlyMissing] = useState(true);
  useEffect(() => {
    if (open) {
      setFrom(others[0]?.value ?? '');
      setOnlyMissing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open]);
  return (
    <ReasonDialog
      open={open}
      onClose={onClose}
      title={`Copy prices onto ${to.name}`}
      description="Each price copied is recorded as a price change, so the old one stays readable."
      confirmLabel="Copy prices"
      destructive={false}
      quickReasons={['Starting a new list', 'Matching the base list']}
      run={(reason) => copyPrices({ fromId: from, toId: to.id, onlyMissing, reason })}
    >
      <div className="flex flex-col gap-16 pb-16">
        <SelectField label="Copy from" value={from} onChange={(e) => setFrom(e.target.value)} options={others} />
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="size-16 accent-accent" />
          Only items {to.name} does not price yet
        </label>
      </div>
    </ReasonDialog>
  );
}
