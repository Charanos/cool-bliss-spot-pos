'use client';

import { Button } from '@bliss/ui/components/button';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveRecipe } from '../../_actions/menu';
import { Fieldset, FormDialog } from '../../_components/forms';

export interface RecipeDraft {
  id: string | null;
  variantId: string;
  name: string;
  parts: { componentVariantId: string; qty: number; volumeMl: number | null; wastagePct: number }[];
}

type Option = { value: string; label: string };
type Line = { key: string; component: string; qty: string; ml: string; waste: string };
let nextKey = 0;

/** Write the recipe for an item: which stocked items one serve takes, and how much of each. */
export function RecipeDialog({ open, onClose, target, items, stockItems }: { open: boolean; onClose: () => void; target: RecipeDraft | null; items: Option[]; stockItems: Option[] }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState('');
  const [name, setName] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const blank = (): Line => ({ key: `r${(nextKey += 1)}`, component: stockItems[0]?.value ?? '', qty: '', ml: '', waste: '0' });
  useEffect(() => {
    if (!open) return;
    setVariantId(target?.variantId ?? items[0]?.value ?? '');
    setName(target?.name ?? '');
    setLines(target?.parts.length ? target.parts.map((p) => ({ key: `r${(nextKey += 1)}`, component: p.componentVariantId, qty: String(p.qty), ml: p.volumeMl ? String(p.volumeMl) : '', waste: String(p.wastagePct) })) : [blank()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when it opens
  }, [open, target]);
  const set = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const editing = Boolean(target?.id);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit the recipe for ${target!.name}` : 'Add a recipe'}
      description="How one serve comes out of stock. It applies from the next line fired; lines already fired keep what they took."
      submitLabel={editing ? 'Save recipe' : 'Add recipe'}
      onSubmit={() => saveRecipe({ variantId, name, components: lines.filter((l) => l.component && l.qty).map((l) => ({ componentVariantId: l.component, qty: Number(l.qty), volumeMl: l.ml ? Number(l.ml) : null, wastagePct: Number(l.waste || 0) })) })}
      onDone={() => router.refresh()}
    >
      <Fieldset columns={2}>
        <SelectField label="The item it makes" value={variantId} onChange={(e) => setVariantId(e.target.value)} options={items} disabled={editing} />
        <TextField label="Recipe name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Smirnoff and Coke" required />
      </Fieldset>
      <fieldset className="flex flex-col gap-8">
        <legend className="mb-8 label-caps text-ink-subtle">One serve takes</legend>
        {lines.map((l, i) => (
          <div key={l.key} className="grid grid-cols-1 items-end gap-8 desktop:grid-cols-[minmax(0,2fr)_100px_100px_100px_40px]">
            <SelectField label="Stocked item" hideLabel={i > 0} value={l.component} onChange={(e) => set(l.key, { component: e.target.value })} options={stockItems} />
            <TextField label="Of a unit" hideLabel={i > 0} value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} inputMode="decimal" placeholder="0.04" />
            <TextField label="Measure, ml" hideLabel={i > 0} value={l.ml} onChange={(e) => set(l.key, { ml: e.target.value })} inputMode="numeric" placeholder="30" />
            <TextField label="Wastage, %" hideLabel={i > 0} value={l.waste} onChange={(e) => set(l.key, { waste: e.target.value })} inputMode="decimal" />
            <Button type="button" variant="ghost" iconOnly icon={IconTrash} aria-label="Remove this part" onClick={() => setLines((all) => (all.length > 1 ? all.filter((x) => x.key !== l.key) : all))} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" icon={IconPlus} className="w-fit" onClick={() => setLines((all) => [...all, blank()])}>
          Add a part
        </Button>
      </fieldset>
    </FormDialog>
  );
}
