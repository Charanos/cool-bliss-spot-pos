'use client';

import type { Cents } from '@bliss/shared/money';
import { formatQty } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Money } from '@bliss/ui/components/money';
import { StatusChip, type StatusKey } from '@bliss/ui/components/status';
import { IconArchive, IconArrowBackUp, IconPencil, IconPlus, IconStar } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { saveVariant, setProductStatus, setVariantStatus } from '../../_actions/menu';
import { Fieldset, FormDialog, ReasonDialog, useDialog } from '../../_components/forms';
import { hrefFor } from '../../_lib/nav';
import { ProductDialog, type ProductDraft } from './product-dialog';

type Option = { value: string; label: string };

/** The product's own actions, beside its title: edit, take off sale or put back. */
export function ProductActions({
  product,
  status,
  categories,
  suppliers,
  canEdit,
}: {
  product: ProductDraft;
  status: 'active' | 'archived';
  categories: Option[];
  suppliers: Option[];
  canEdit: boolean;
}) {
  const dialog = useDialog<'edit' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${product.name}`}
        items={[
          status === 'active'
            ? { key: 'archive', label: 'Take off sale', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Put back on sale', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <ProductDialog open={dialog.is('edit')} onClose={dialog.close} target={product} categories={categories} suppliers={suppliers} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={status === 'active' ? `Take ${product.name} off sale?` : `Put ${product.name} back on sale?`}
        description={status === 'active' ? 'The floor stops offering it at the next sync. Its history stays.' : 'The floor offers it again at the next sync.'}
        confirmLabel={status === 'active' ? 'Take off sale' : 'Put back on sale'}
        destructive={status === 'active'}
        quickReasons={status === 'active' ? ['No longer stocked', 'Replaced by a new line'] : ['Back in stock']}
        run={(reason) => setProductStatus({ id: product.id, status: status === 'active' ? 'archived' : 'active', reason })}
      />
    </>
  );
}

export interface VariantRow {
  id: string;
  name: string;
  kind: 'sealed' | 'serve';
  serveVolumeMl: number | null;
  depletionFactor: number;
  barcode: string | null;
  isDefault: boolean;
  status: 'active' | 'archived';
  state: StatusKey | null;
  /** Price on each list, in list order; null where the list does not price it. */
  prices: (Cents | null)[];
}

/** How the product is sold: each way, its pour and share of the bottle, and its price on every list. */
export function VariantsCard({
  productId,
  productName,
  variants,
  lists,
  canEdit,
}: {
  productId: string;
  productName: string;
  variants: VariantRow[];
  lists: { id: string; name: string; kind: 'base' | 'overlay' }[];
  canEdit: boolean;
}) {
  const dialog = useDialog<'edit' | 'status', VariantRow | null>();
  const target = dialog.target;
  const head = 'px-12 py-12 text-label text-ink-subtle';
  return (
    <>
      <Card aria-labelledby="product-serves">
        <CardHeader
          band
          level="h2"
          titleId="product-serves"
          title="Sold as"
          subtitle="Each serve takes its share of the bottle; prices include VAT."
          actions={
            canEdit ? (
              <Button size="sm" variant="create" icon={IconPlus} onClick={() => dialog.open('edit', null)}>
                Add a way to sell it
              </Button>
            ) : null
          }
        />
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <caption className="sr-only">Ways {productName} is sold, and their prices</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`${head} pl-20 text-left`}>
                  Sold as
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Pour
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Of a bottle
                </th>
                <th scope="col" className={`${head} text-left`}>
                  State
                </th>
                {lists.map((l) => (
                  <th key={l.id} scope="col" className={`${head} text-right`}>
                    <Link href={hrefFor('priceList', l.id)} className="rounded-sm transition-hover hover:text-ink">
                      {l.name}
                    </Link>
                  </th>
                ))}
                <th scope="col" className={`${head} pr-20`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className={v.status === 'archived' ? 'border-b border-rule text-ink-subtle last:border-b-0' : 'border-b border-rule last:border-b-0'}>
                  <td className="py-12 pl-20 pr-12">
                    <span className="flex items-center gap-6 text-ui text-ink">
                      {v.name}
                      {v.isDefault ? <IconStar size={14} stroke={1.5} aria-label="The one the floor offers first" className="text-attention" /> : null}
                    </span>
                    <span className="block text-body-sm text-ink-subtle">{v.kind === 'sealed' ? 'Sealed' : 'By the serve'}</span>
                  </td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{v.serveVolumeMl ? `${v.serveVolumeMl}ml` : 'Whole'}</td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(v.depletionFactor, 4)}</td>
                  <td className="px-12 py-12">
                    {v.status === 'archived' ? (
                      <StatusChip status="retired" label="Archived" />
                    ) : v.state ? (
                      <StatusChip status={v.state} />
                    ) : (
                      <span className="text-body-sm text-ink-subtle">Available</span>
                    )}
                  </td>
                  {v.prices.map((p, i) => (
                    <td key={lists[i]!.id} className="px-12 py-12 text-right">
                      {p !== null ? (
                        <Money value={p} currency={false} size="num-md" decimals="whole" tone={lists[i]!.kind === 'base' ? 'default' : 'accent'} />
                      ) : (
                        <span className="text-body-sm text-ink-subtle">Not listed</span>
                      )}
                    </td>
                  ))}
                  <td className="py-8 pl-12 pr-20 text-right">
                    {canEdit ? (
                      <OverflowMenu
                        label={`More for ${v.name}`}
                        items={[
                          { key: 'edit', label: 'Edit', icon: IconPencil, onSelect: () => dialog.open('edit', v) },
                          v.status === 'active'
                            ? { key: 'archive', label: 'Stop selling it this way', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', v) }
                            : { key: 'restore', label: 'Sell it this way again', icon: IconArrowBackUp, onSelect: () => dialog.open('status', v) },
                        ]}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <VariantDialog open={dialog.is('edit')} onClose={dialog.close} productId={productId} target={target} />
      <ReasonDialog
        open={dialog.is('status') && Boolean(target)}
        onClose={dialog.close}
        title={target?.status === 'active' ? `Stop selling ${target?.name}?` : `Sell ${target?.name} again?`}
        description={target?.status === 'active' ? 'The floor stops offering it this way at the next sync.' : 'The floor offers it this way again at the next sync.'}
        confirmLabel={target?.status === 'active' ? 'Stop selling' : 'Sell again'}
        destructive={target?.status === 'active'}
        quickReasons={['Not asked for', 'Replaced by a new size']}
        run={(reason) => setVariantStatus({ id: target!.id, status: target!.status === 'active' ? 'archived' : 'active', reason })}
      />
    </>
  );
}

function VariantDialog({ open, onClose, productId, target }: { open: boolean; onClose: () => void; productId: string; target: VariantRow | null }) {
  const [f, setF] = useState({ name: '', kind: 'serve' as 'sealed' | 'serve', serve: '', share: '', barcode: '', isDefault: false, price: '' });
  useEffect(() => {
    if (!open) return;
    setF({
      name: target?.name ?? '',
      kind: target?.kind ?? 'serve',
      serve: target?.serveVolumeMl ? String(target.serveVolumeMl) : '',
      share: target && target.kind === 'serve' ? String(target.depletionFactor) : '',
      barcode: target?.barcode ?? '',
      isDefault: target?.isDefault ?? false,
      price: '',
    });
  }, [open, target]);
  const editing = Boolean(target);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? `Edit ${target!.name}` : 'Add a way to sell it'}
      description={editing ? 'Its name, pour and share of the bottle. Its prices are set on each price list.' : 'A tot, a double, a glass or the bottle. It goes on sale at the next sync.'}
      submitLabel={editing ? 'Save changes' : 'Add'}
      onSubmit={() =>
        saveVariant({
          id: target?.id ?? null,
          productId,
          name: f.name,
          kind: f.kind,
          serveVolumeMl: f.kind === 'serve' && f.serve ? Number(f.serve) : null,
          depletionFactor: f.kind === 'serve' ? Number(f.share || 0) : 1,
          barcode: f.barcode || null,
          isDefault: f.isDefault,
          price: editing ? null : f.price,
        })
      }
    >
      <Fieldset columns={2}>
        <TextField label="Called" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Double" required />
        <SelectField
          label="Sold"
          value={f.kind}
          onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as 'sealed' | 'serve' }))}
          options={[
            { value: 'serve', label: 'By the serve' },
            { value: 'sealed', label: 'Sealed, whole' },
          ]}
          disabled={editing}
        />
        {f.kind === 'serve' ? (
          <>
            <TextField label="Pour, ml" value={f.serve} onChange={(e) => setF((x) => ({ ...x, serve: e.target.value }))} inputMode="numeric" placeholder="50" required />
            <TextField
              label="Share of a bottle"
              value={f.share}
              onChange={(e) => setF((x) => ({ ...x, share: e.target.value }))}
              inputMode="decimal"
              placeholder="Worked out from the pour"
              helper="Leave empty to work it out from the pour and the bottle."
            />
          </>
        ) : null}
        {editing ? null : (
          <TextField label="Price, KES" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: e.target.value }))} inputMode="decimal" placeholder="350" helper="On the base list." required />
        )}
        <TextField label="Barcode" value={f.barcode} onChange={(e) => setF((x) => ({ ...x, barcode: e.target.value }))} inputMode="numeric" />
      </Fieldset>
      <label className="flex items-center gap-8 text-body-sm text-ink">
        <input type="checkbox" checked={f.isDefault} onChange={(e) => setF((x) => ({ ...x, isDefault: e.target.checked }))} className="size-16 accent-accent" />
        The way the floor offers it first
      </label>
    </FormDialog>
  );
}
