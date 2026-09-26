'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArchive, IconArrowBackUp, IconPencil, IconPlus } from '@tabler/icons-react';
import { removeSupplierItem, setSupplierStatus } from '../../_actions/purchasing';
import { ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';
import { SupplierDialog, type SupplierDraft, SupplierItemDialog } from '../_parts/supplier-dialogs';
import { useRouter } from 'next/navigation';
import type { Cents } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconShoppingCart } from '@tabler/icons-react';

export function SuppliersCreate({ canEdit }: { canEdit: boolean }) {
  const dialog = useDialog<'new'>();
  useCreateParam(() => dialog.open('new', null), canEdit);
  return <SupplierDialog open={dialog.is('new')} onClose={dialog.close} target={null} />;
}

/** A supplier's own actions: order from them, edit, stop or start using them. */
export function SupplierActions({ supplier, active, canEdit }: { supplier: SupplierDraft; active: boolean; canEdit: boolean }) {
  const dialog = useDialog<'edit' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      {active ? (
        <ButtonLink href={`/console/purchasing/orders/new?supplier=${supplier.id}`} variant="primary" icon={IconShoppingCart}>
          New order
        </ButtonLink>
      ) : null}
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${supplier.name}`}
        items={[
          active
            ? { key: 'archive', label: 'Stop using them', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Use them again', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <SupplierDialog open={dialog.is('edit')} onClose={dialog.close} target={supplier} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={active ? `Stop using ${supplier.name}?` : `Use ${supplier.name} again?`}
        description={active ? 'They leave the order and delivery forms. Their history stays. Open orders must be received or cancelled first.' : 'They come back on the order and delivery forms.'}
        confirmLabel={active ? 'Stop using them' : 'Use them again'}
        destructive={active}
        quickReasons={['Found a better supplier', 'They stopped trading', 'Back on good terms']}
        run={(reason) => setSupplierStatus({ id: supplier.id, status: active ? 'archived' : 'active', reason })}
      />
    </>
  );
}

export interface CarriedItem {
  variantId: string;
  name: string;
  supplierSku: string | null;
  packSize: number;
  costCents: Cents;
}

/** Add, change or drop an item a supplier carries. */
export function CarriedItemControls({ supplierId, target, items, canEdit, mode }: { supplierId: string; target: CarriedItem | null; items: { value: string; label: string }[]; canEdit: boolean; mode: 'add' | 'row' }) {
  const router = useRouter();
  const dialog = useDialog<'edit'>();
  if (!canEdit) return null;
  return (
    <>
      {mode === 'add' ? (
        <Button size="sm" variant="create" icon={IconPlus} onClick={() => dialog.open('edit', null)}>
          Add an item
        </Button>
      ) : (
        <OverflowMenu
          label={`More for ${target?.name ?? 'this item'}`}
          items={[
            { key: 'edit', label: 'Change cost or pack', icon: IconPencil, onSelect: () => dialog.open('edit', null) },
            {
              key: 'remove',
              label: 'No longer from them',
              icon: IconArchive,
              destructive: true,
              onSelect: async () => {
                await removeSupplierItem({ supplierId, variantId: target!.variantId });
                router.refresh();
              },
            },
          ]}
        />
      )}
      <SupplierItemDialog open={dialog.is('edit')} onClose={dialog.close} supplierId={supplierId} target={target} items={items} />
    </>
  );
}
