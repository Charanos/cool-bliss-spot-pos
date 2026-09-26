'use client';

import { SelectField, TextField } from '@bliss/ui/components/fields';
import { createUuidV7 } from '@bliss/shared/id';
import { useRouter } from 'next/navigation';
import { assetUrl } from '@/lib/assets';
import { useEffect, useMemo, useState } from 'react';
import { createProduct, updateProduct } from '../../_actions/menu';
import { Fieldset, FormDialog, PhotoField } from '../../_components/forms';

export interface ProductDraft {
  id: string;
  categoryId: string;
  name: string;
  brand: string | null;
  sku: string;
  barcode: string | null;
  containerVolumeMl: number | null;
  abv: number | null;
  defaultSupplierId: string | null;
  imageKey: string | null;
}

type Option = { value: string; label: string };

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * Add a product, or change one. A new product comes with the first way it is sold and its base
 * price, so it can be sold at the next sync. The photograph goes on the floor tile too.
 */
export function ProductDialog({ open, onClose, target, categories, suppliers }: { open: boolean; onClose: () => void; target: ProductDraft | null; categories: Option[]; suppliers: Option[] }) {
  const router = useRouter();
  const editing = Boolean(target);
  const requestId = useMemo(() => (open ? createUuidV7()() : ''), [open]);
  const [f, setF] = useState({ name: '', brand: '', categoryId: '', sku: '', barcode: '', bottle: '', abv: '', supplierId: '', imageKey: null as string | null });
  const [first, setFirst] = useState({ kind: 'sealed' as 'sealed' | 'serve', name: '', serve: '', price: '' });

  useEffect(() => {
    if (!open) return;
    setF({
      name: target?.name ?? '',
      brand: target?.brand ?? '',
      categoryId: target?.categoryId ?? categories[0]?.value ?? '',
      sku: target?.sku ?? '',
      barcode: target?.barcode ?? '',
      bottle: target?.containerVolumeMl ? String(target.containerVolumeMl) : '',
      abv: target?.abv !== null && target?.abv !== undefined ? String(target.abv) : '',
      supplierId: target?.defaultSupplierId ?? '',
      imageKey: target?.imageKey ?? null,
    });
    setFirst({ kind: 'sealed', name: '', serve: '', price: '' });
  }, [open, target, categories]);

  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [key]: e.target.value }));
  const fields = {
    categoryId: f.categoryId,
    name: f.name,
    brand: f.brand || null,
    sku: f.sku,
    barcode: f.barcode || null,
    containerVolumeMl: num(f.bottle),
    abv: num(f.abv),
    defaultSupplierId: f.supplierId || null,
    imageKey: f.imageKey,
  };

  return (
    <FormDialog<{ id?: string }>
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target!.name}` : 'Add a product'}
      description={editing ? 'Its name, codes, bottle and supplier. How it is sold and its prices are on its page.' : 'It goes on sale at the next sync, at the price you set.'}
      submitLabel={editing ? 'Save changes' : 'Add product'}
      onSubmit={() =>
        editing
          ? updateProduct({ id: target!.id, ...fields })
          : createProduct({
              ...fields,
              firstVariant: {
                name: first.name || (first.kind === 'sealed' ? (f.bottle ? `${f.name} ${f.bottle}ml` : f.name) : 'Tot'),
                kind: first.kind,
                serveVolumeMl: first.kind === 'serve' ? num(first.serve) : null,
                depletionFactor: 0,
              },
              basePrice: first.price,
              requestId,
            })
      }
      onDone={(result) => {
        if (!editing && 'id' in result && result.id) router.push(`/console/catalogue/products/${result.id}`);
      }}
    >
      <PhotoField value={assetUrl(f.imageKey, 128, 128)} name={f.name} onChange={(url) => setF((x) => ({ ...x, imageKey: url }))} />
      <Fieldset legend="The product">
        <TextField label="Name" value={f.name} onChange={set('name')} placeholder="Gilbeys gin" required autoComplete="off" />
        <TextField label="Brand" value={f.brand} onChange={set('brand')} placeholder="Gilbeys" autoComplete="off" />
        <SelectField label="Category" value={f.categoryId} onChange={set('categoryId')} options={categories} required />
        <SelectField label="Usual supplier" value={f.supplierId} onChange={set('supplierId')} options={[{ value: '', label: 'None yet' }, ...suppliers]} />
      </Fieldset>
      <Fieldset legend="Codes and bottle" columns={2}>
        <TextField label="SKU" value={f.sku} onChange={(e) => setF((x) => ({ ...x, sku: e.target.value.toUpperCase() }))} placeholder="SPR-GLB-750" helper="Letters, numbers and dashes." required autoComplete="off" />
        <TextField label="Barcode" value={f.barcode} onChange={set('barcode')} inputMode="numeric" placeholder="6161101600125" autoComplete="off" />
        <TextField label="Bottle size, ml" value={f.bottle} onChange={set('bottle')} inputMode="numeric" placeholder="750" helper="Leave empty for food and anything not poured." />
        <TextField label="Alcohol, %" value={f.abv} onChange={set('abv')} inputMode="decimal" placeholder="40" />
      </Fieldset>
      {editing ? null : (
        <Fieldset legend="How it is first sold" columns={2}>
          <SelectField
            label="Sold as"
            value={first.kind}
            onChange={(e) => setFirst((x) => ({ ...x, kind: e.target.value as 'sealed' | 'serve' }))}
            options={[
              { value: 'sealed', label: 'A sealed bottle, can or plate' },
              { value: 'serve', label: 'A serve poured from a bottle' },
            ]}
          />
          <TextField label="Called" value={first.name} onChange={(e) => setFirst((x) => ({ ...x, name: e.target.value }))} placeholder={first.kind === 'sealed' ? 'Gilbeys 750ml' : 'Tot'} helper="What the floor tile says." />
          {first.kind === 'serve' ? <TextField label="Serve, ml" value={first.serve} onChange={(e) => setFirst((x) => ({ ...x, serve: e.target.value }))} inputMode="numeric" placeholder="25" required /> : null}
          <TextField label="Price, KES" value={first.price} onChange={(e) => setFirst((x) => ({ ...x, price: e.target.value }))} inputMode="decimal" placeholder="1,480" helper="On the base list. VAT is included." required />
        </Fieldset>
      )}
    </FormDialog>
  );
}
