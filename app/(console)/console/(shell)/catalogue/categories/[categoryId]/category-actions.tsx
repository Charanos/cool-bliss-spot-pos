'use client';

import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArchive, IconArrowBackUp, IconPencil, IconPlus } from '@tabler/icons-react';
import { setCategoryStatus } from '../../../_actions/menu';
import { ReasonDialog, useDialog } from '../../../_components/forms';
import { CategoryDialog, type CategoryDraft } from '../../_parts/category-dialog';

export function CategoryActions({ category, active, canEdit }: { category: CategoryDraft; active: boolean; canEdit: boolean }) {
  const dialog = useDialog<'edit' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      <ButtonLink href="/console/catalogue/products?new=1" variant="ghost" icon={IconPlus}>
        Add a product
      </ButtonLink>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${category.name}`}
        items={[
          active
            ? { key: 'archive', label: 'Archive', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Put back on the floor', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <CategoryDialog open={dialog.is('edit')} onClose={dialog.close} target={category} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={active ? `Archive ${category.name}?` : `Put ${category.name} back on the floor?`}
        description={active ? 'Its tab leaves the floor at the next sync. It must have no products on sale.' : 'Its tab comes back at the next sync.'}
        confirmLabel={active ? 'Archive' : 'Put back'}
        destructive={active}
        quickReasons={active ? ['Merged into another tab', 'No longer served'] : ['Serving it again']}
        run={(reason) => setCategoryStatus({ id: category.id, status: active ? 'archived' : 'active', reason })}
      />
    </>
  );
}
