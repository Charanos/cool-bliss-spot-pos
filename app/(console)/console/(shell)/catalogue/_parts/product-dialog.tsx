'use client';

import { SelectField, TextField } from '@bliss/ui/components/fields';
import { ProductTile, type TileGlyph } from '@bliss/ui/components/floor/product-tile';
import { shillings } from '@bliss/shared/money';
import { IconBottle, IconGlassFull } from '@tabler/icons-react';
import { createUuidV7 } from '@bliss/shared/id';
import { useRouter } from 'next/navigation';
import { assetUrl } from '@/lib/assets';
import { useEffect, useMemo, useState } from 'react';
import { createProduct, updateProduct } from '../../_actions/menu';
import { ChoiceCards, FactList, Fieldset, FormDialog, PhotoField, useOpenStamp } from '../../_components/forms';

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
  /** What one bottle or can costs to buy, in shillings as typed ("180.00"); empty when never set. */
  unitCost?: string;
  /** How many the house owns of something handed back, such as shisha pots. */
  unitsInHouse?: number | null;
}

type Option = { value: string; label: string };

const num = (v: string) => (v.trim() === '' ? null : Number(v));

const GLYPH: Record<string, TileGlyph> = { Beer: 'beer', Spirits: 'spirit', Wine: 'wine', 'Soft drinks': 'soft', Food: 'food' };

/**
 * Add a product, or change one. A new product comes with the first way it is sold and its base
 * price, so it can be sold at the next sync. The photograph goes on the floor tile too.
 */
export function ProductDialog({ open, onClose, target, categories, suppliers }: { open: boolean; onClose: () => void; target: ProductDraft | null; categories: Option[]; suppliers: Option[] }) {
  const router = useRouter();
  const editing = Boolean(target);
  const requestId = useMemo(() => (open ? createUuidV7()() : ''), [open]);
  const [f, setF] = useState({ name: '', brand: '', categoryId: '', sku: '', barcode: '', bottle: '', abv: '', supplierId: '', imageKey: null as string | null, cost: '', inHouse: '' });
  const [first, setFirst] = useState({ kind: 'sealed' as 'sealed' | 'serve', name: '', serve: '', price: '' });
  const [uploading, setUploading] = useState(false);

  const stamp = useOpenStamp(open, target?.id);
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
      cost: target?.unitCost ?? '',
      inHouse: target?.unitsInHouse ? String(target.unitsInHouse) : '',
    });
    setFirst({ kind: 'sealed', name: '', serve: '', price: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets when it opens, never on a refresh underneath
  }, [stamp]);

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
    // Blank leaves the cost as it is; a figure sets it until the next delivery brings its own.
    unitCost: f.cost.trim() === '' ? null : f.cost,
    unitsInHouse: num(f.inHouse),
  };

  const categoryName = categories.find((c) => c.value === f.categoryId)?.label ?? '';
  const glyph: TileGlyph = GLYPH[categoryName] ?? (first.kind === 'sealed' ? 'bottle' : 'spirit');
  const priceShs = Number(first.price.replace(/,/g, ''));
  const tileName = editing ? f.name : first.name || (first.kind === 'sealed' ? (f.bottle ? `${f.name} ${f.bottle}ml` : f.name) : f.name ? `${f.name} tot` : '');

  const categoryLabel = categoryName || 'Choose one';
  const priceShown = Number.isFinite(priceShs) && priceShs > 0 ? `KES ${priceShs.toLocaleString('en-KE')}` : null;
  const summary = f.name.trim()
    ? [tileName || f.name.trim(), editing ? categoryName : first.kind === 'sealed' ? 'sold sealed' : `poured${first.serve ? `, ${first.serve} ml` : ''}`, editing ? null : (priceShown ?? 'no price yet')].filter(Boolean).join(' · ')
    : 'Start with its name.';

  return (
    <FormDialog<{ id?: string }>
      icon={IconBottle}
      disabled={uploading}
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target!.name}` : 'Add a product'}
      description={editing ? 'Its name, codes, bottle and supplier. How it is sold and its prices are on its page.' : 'It goes on sale at the next sync, at the price you set.'}
      submitLabel={editing ? 'Save changes' : 'Add product'}
      summary={summary}
      aside={
        <>
          {/* What a waiter will tap, as they will see it, while it is being typed. */}
          <figure className="flex flex-col gap-12">
            <figcaption className="label-caps text-ink-subtle">On the floor</figcaption>
            <div data-theme="dark" className="pointer-events-none mx-auto w-tile-preview rounded-card bg-page p-8 shadow-lift" aria-hidden="true">
              <ProductTile
                variantId="preview"
                name={tileName || 'New product'}
                price={Number.isFinite(priceShs) && priceShs > 0 ? shillings(priceShs) : null}
                state="available"
                reason={null}
                qtyAvailable={0}
                category="glacier"
                glyph={glyph}
                imageUrl={assetUrl(f.imageKey, 256, 256)}
                onAdd={() => undefined}
                onLongPress={() => undefined}
              />
            </div>
          </figure>
          <PhotoField layout="panel" value={assetUrl(f.imageKey, 128, 128)} name={f.name} helper="Optional. Shown on the floor tile and in the Console." onChange={(url) => setF((x) => ({ ...x, imageKey: url }))} onUploading={setUploading} />
          <FactList
            facts={[
              { label: 'Category', value: categoryLabel, muted: !categoryName },
              ...(editing ? [] : [{ label: 'Sold as', value: first.kind === 'sealed' ? 'Sealed' : 'Poured serve' }, { label: 'Price', value: priceShown ?? 'Not set', muted: !priceShown }]),
              { label: 'SKU', value: f.sku.trim() || 'Made from the name', muted: !f.sku.trim() },
            ]}
          />
        </>
      }
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
      <Fieldset step={1} legend="What it is" hint="Its name on the menu, and where it sits.">
        <TextField label="Name" value={f.name} onChange={set('name')} placeholder="Tusker lager" required autoComplete="off" className="tablet:col-span-2" />
        <SelectField label="Category" value={f.categoryId} onChange={set('categoryId')} options={categories} required helper={categories.length === 0 ? 'Add a category first, in Catalogue, Categories.' : undefined} />
        <TextField label="Brand" value={f.brand} onChange={set('brand')} placeholder="EABL" autoComplete="off" helper="Optional." />
      </Fieldset>

      {editing ? null : (
        <Fieldset step={2} legend="How it is first sold" hint="A tot and a double, or a bottle and a glass, are added on its page after." columns={2}>
          <ChoiceCards
            label="Sold as"
            value={first.kind}
            onChange={(kind) => setFirst((x) => ({ ...x, kind }))}
            options={[
              { value: 'sealed', title: 'Sealed', detail: 'A bottle, can or plate, sold whole.', icon: IconBottle },
              { value: 'serve', title: 'Poured', detail: 'A measure poured from a bottle.', icon: IconGlassFull },
            ]}
          />
          <TextField label="Price, KES" value={first.price} onChange={(e) => setFirst((x) => ({ ...x, price: e.target.value }))} inputMode="decimal" placeholder="300" helper="On the Standard list. VAT included." required />
          {first.kind === 'serve' ? (
            <TextField label="Serve, ml" value={first.serve} onChange={(e) => setFirst((x) => ({ ...x, serve: e.target.value }))} inputMode="numeric" placeholder="25" required />
          ) : (
            <TextField label="On the tile as" value={first.name} onChange={(e) => setFirst((x) => ({ ...x, name: e.target.value }))} placeholder={f.name ? (f.bottle ? `${f.name} ${f.bottle}ml` : f.name) : 'Tusker lager 500ml'} helper="Optional. The name and size by default." />
          )}
        </Fieldset>
      )}

      <Fieldset step={editing ? 2 : 3} legend="Cost, bottle and codes" hint="For stock value, margins and pour variance. All optional." columns={2}>
        <TextField label="Unit cost, KES" value={f.cost} onChange={set('cost')} inputMode="decimal" placeholder="180" helper="What one bottle or can costs to buy. Deliveries update it." className="tablet:col-span-2" />
        <TextField label="Bottle size, ml" value={f.bottle} onChange={set('bottle')} inputMode="numeric" placeholder="500" helper="Empty for food and anything not poured." />
        <TextField label="Alcohol, %" value={f.abv} onChange={set('abv')} inputMode="decimal" placeholder="4.2" />
        <TextField label="SKU" value={f.sku} onChange={(e) => setF((x) => ({ ...x, sku: e.target.value.toUpperCase() }))} placeholder="Made from the name" helper="Left empty, one is made for it." autoComplete="off" />
        <TextField label="Barcode" value={f.barcode} onChange={set('barcode')} inputMode="numeric" placeholder="6161101600125" autoComplete="off" />
        <TextField label="How many you own" value={f.inHouse} onChange={set('inHouse')} inputMode="numeric" placeholder="4" helper="Only for what is served and handed back, like shisha pots. The floor stops selling it while all are out on tables." />
        <SelectField label="Usual supplier" value={f.supplierId} onChange={set('supplierId')} options={[{ value: '', label: 'None yet' }, ...suppliers]} className="tablet:col-span-2" />
      </Fieldset>
    </FormDialog>
  );
}
