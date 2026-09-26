'use client';

import { formatDecimal } from '@bliss/shared/money';
import type { Cents } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { SearchInput } from '@bliss/ui/components/console/toolbar';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { cx } from '@bliss/ui/lib/cx';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { saveModifierGroup, setModifierGroupItems } from '../../_actions/menu';
import { Fieldset, FormDialog } from '../../_components/forms';

export interface ModifierGroupDraft {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id: string; name: string; priceDeltaCents: Cents; linkedVariantId: string | null }[];
}

type Option = { value: string; label: string };
type Line = { key: string; id: string | null; name: string; price: string; linked: string };

let nextKey = 0;
const line = (o?: ModifierGroupDraft['options'][number]): Line => ({ key: `o${(nextKey += 1)}`, id: o?.id ?? null, name: o?.name ?? '', price: o ? formatDecimal(o.priceDeltaCents) : '0', linked: o?.linkedVariantId ?? '' });

/** Add a modifier group with its options, or change one. An option can take stock of an item, such as Coke as a mixer. */
export function ModifierGroupDialog({ open, onClose, target, stockItems }: { open: boolean; onClose: () => void; target: ModifierGroupDraft | null; stockItems: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [min, setMin] = useState('0');
  const [max, setMax] = useState('1');
  const [lines, setLines] = useState<Line[]>([line()]);
  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? '');
    setMin(String(target?.minSelect ?? 0));
    setMax(String(target?.maxSelect ?? 1));
    setLines(target?.options.length ? target.options.map((o) => line(o)) : [line()]);
  }, [open, target]);
  const editing = Boolean(target);
  const set = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <FormDialog<{ id: string }>
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target!.name}` : 'Add a modifier group'}
      description="Options a waiter picks on a line. An option taken off the list stays on lines already fired."
      submitLabel={editing ? 'Save changes' : 'Add group'}
      onSubmit={() =>
        saveModifierGroup({
          id: target?.id ?? null,
          name,
          minSelect: Number(min),
          maxSelect: Number(max),
          options: lines.filter((l) => l.name.trim()).map((l) => ({ id: l.id, name: l.name, priceDelta: l.price || '0', linkedVariantId: l.linked || null })),
        })
      }
      onDone={(r) => {
        if (!editing) router.push(`/console/catalogue/modifiers/${r.id}`);
      }}
    >
      <Fieldset columns={3}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mixer" required />
        <TextField label="Fewest to choose" value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" helper="0 makes it optional." />
        <TextField label="Most to choose" value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" />
      </Fieldset>
      <fieldset className="flex flex-col gap-8">
        <legend className="mb-8 label-caps text-ink-subtle">Options</legend>
        {lines.map((l, i) => (
          <div key={l.key} className="grid grid-cols-1 items-end gap-8 desktop:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.4fr)_40px]">
            <TextField label="Option" hideLabel={i > 0} value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} placeholder="Coke" />
            <TextField label="Adds, KES" hideLabel={i > 0} value={l.price} onChange={(e) => set(l.key, { price: e.target.value })} inputMode="decimal" />
            <SelectField label="Takes stock of" hideLabel={i > 0} value={l.linked} onChange={(e) => set(l.key, { linked: e.target.value })} options={[{ value: '', label: 'Nothing' }, ...stockItems]} />
            <Button type="button" variant="ghost" iconOnly icon={IconTrash} aria-label={`Remove ${l.name || 'this option'}`} onClick={() => setLines((all) => (all.length > 1 ? all.filter((x) => x.key !== l.key) : all))} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" icon={IconPlus} className="w-fit" onClick={() => setLines((all) => [...all, line()])}>
          Add an option
        </Button>
      </fieldset>
    </FormDialog>
  );
}

/** Choose which items offer a modifier group: search, tick, save. */
export function ModifierItemsDialog({ open, onClose, groupId, groupName, items, selected }: { open: boolean; onClose: () => void; groupId: string; groupName: string; items: { id: string; name: string; category: string }[]; selected: readonly string[] }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) {
      setChosen(new Set(selected));
      setQ('');
    }
  }, [open, selected]);
  const shown = useMemo(() => items.filter((i) => !q || `${i.name} ${i.category}`.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const toggle = (id: string) =>
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <FormDialog open={open} onClose={onClose} title={`Items that offer ${groupName}`} description={`${chosen.size} chosen. The floor offers the group on these at the next sync.`} submitLabel="Save items" onSubmit={() => setModifierGroupItems({ groupId, variantIds: [...chosen] })}>
      <SearchInput value={q} onChange={setQ} placeholder="Search items" className="w-full" />
      <ul className="flex max-h-lightbox flex-col overflow-y-auto rounded-card border border-edge" data-lenis-prevent="">
        {shown.map((i) => (
          <li key={i.id} className="border-b border-rule last:border-b-0">
            <label className={cx('flex cursor-pointer items-center gap-12 px-16 py-8 transition-hover hover:bg-band', chosen.has(i.id) && 'bg-accent-wash')}>
              <input type="checkbox" checked={chosen.has(i.id)} onChange={() => toggle(i.id)} className="size-16 accent-accent" />
              <span className="min-w-0 flex-1 truncate text-ui text-ink">{i.name}</span>
              <span className="text-body-sm text-ink-subtle">{i.category}</span>
            </label>
          </li>
        ))}
      </ul>
    </FormDialog>
  );
}
