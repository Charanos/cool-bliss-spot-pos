'use client';

import type { CategoryColourToken, RoutingTarget } from '@bliss/shared/domain';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveCategory } from '../../_actions/menu';
import { Fieldset, FormDialog } from '../../_components/forms';

export interface CategoryDraft {
  id: string;
  name: string;
  colour: CategoryColourToken;
  routingTarget: RoutingTarget;
  trackStock: boolean;
}

const COLOURS: { value: CategoryColourToken; label: string }[] = [
  { value: 'glacier', label: 'Glacier' },
  { value: 'ember', label: 'Ember' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'iris', label: 'Iris' },
  { value: 'rose', label: 'Rose' },
  { value: 'steel', label: 'Steel' },
  { value: 'brass', label: 'Brass' },
  { value: 'jade', label: 'Jade' },
];

/** Add a category, or change one: its name on the floor's tab, its colour, where its lines print. */
export function CategoryDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: CategoryDraft | null }) {
  const router = useRouter();
  const [f, setF] = useState<Omit<CategoryDraft, 'id'>>({ name: '', colour: 'glacier', routingTarget: 'bar', trackStock: true });
  useEffect(() => {
    if (open) setF({ name: target?.name ?? '', colour: target?.colour ?? 'glacier', routingTarget: target?.routingTarget ?? 'bar', trackStock: target?.trackStock ?? true });
  }, [open, target]);
  const editing = Boolean(target);
  return (
    <FormDialog<{ id: string }>
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? `Edit ${target!.name}` : 'Add a category'}
      description={editing ? 'The floor shows the change at its next sync.' : 'It becomes a tab on the floor, at the end of the row.'}
      submitLabel={editing ? 'Save changes' : 'Add category'}
      onSubmit={() => saveCategory({ id: target?.id ?? null, name: f.name, colourToken: f.colour, routingTarget: f.routingTarget, trackStock: f.trackStock })}
      onDone={(r) => {
        if (!editing) router.push(`/console/catalogue/categories/${r.id}`);
      }}
    >
      <Fieldset columns={2}>
        <TextField label="Name" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Cocktails" required autoComplete="off" />
        <SelectField
          label="Fired lines print at"
          value={f.routingTarget}
          onChange={(e) => setF((x) => ({ ...x, routingTarget: e.target.value as RoutingTarget }))}
          options={[
            { value: 'bar', label: 'The bar' },
            { value: 'kitchen', label: 'The kitchen' },
            { value: 'none', label: 'Nowhere' },
          ]}
        />
      </Fieldset>
      <div className="flex flex-col gap-8" role="radiogroup" aria-label="Colour">
        <span className="text-label text-ink-muted">Colour, the edge of every tile in it</span>
        <div className="flex flex-wrap gap-8">
          {COLOURS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={f.colour === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => setF((x) => ({ ...x, colour: c.value }))}
              className={cx('size-control-md rounded-control ring-offset-2 ring-offset-card transition-hover', categoryEdgeClass(c.value), f.colour === c.value ? 'ring-2 ring-ink' : 'ring-0 hover:ring-2 hover:ring-hairline')}
            />
          ))}
        </div>
      </div>
      <label className="flex items-start gap-8 text-body-sm text-ink">
        <input type="checkbox" checked={f.trackStock} onChange={(e) => setF((x) => ({ ...x, trackStock: e.target.checked }))} className="mt-2 size-16 accent-accent" />
        <span>
          Keep count of its stock
          <span className="block text-ink-muted">Counted, depleted by sales, and shown as low or finished on the floor. Off for plates and anything made to order.</span>
        </span>
      </label>
    </FormDialog>
  );
}
