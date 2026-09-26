'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArchive, IconArrowBackUp, IconLink, IconPencil } from '@tabler/icons-react';
import { setModifierGroupStatus } from '../../../_actions/menu';
import { ReasonDialog, useDialog } from '../../../_components/forms';
import { ModifierGroupDialog, type ModifierGroupDraft, ModifierItemsDialog } from '../../_parts/modifier-dialogs';

export function ModifierActions({
  group,
  active,
  stockItems,
  items,
  selected,
  canEdit,
}: {
  group: ModifierGroupDraft;
  active: boolean;
  stockItems: { value: string; label: string }[];
  items: { id: string; name: string; category: string }[];
  selected: string[];
  canEdit: boolean;
}) {
  const dialog = useDialog<'edit' | 'items' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      <Button variant="ghost" icon={IconLink} onClick={() => dialog.open('items', null)}>
        Choose items
      </Button>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${group.name}`}
        items={[
          active
            ? { key: 'archive', label: 'Archive', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Put back on the floor', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <ModifierGroupDialog open={dialog.is('edit')} onClose={dialog.close} target={group} stockItems={stockItems} />
      <ModifierItemsDialog open={dialog.is('items')} onClose={dialog.close} groupId={group.id} groupName={group.name} items={items} selected={selected} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={active ? `Archive ${group.name}?` : `Put ${group.name} back on the floor?`}
        description={active ? 'The floor stops asking for it at the next sync. Lines already fired keep their options.' : 'The floor asks for it again at the next sync.'}
        confirmLabel={active ? 'Archive' : 'Put back'}
        destructive={active}
        quickReasons={['No longer offered', 'Replaced by another group']}
        run={(reason) => setModifierGroupStatus({ id: group.id, status: active ? 'archived' : 'active', reason })}
      />
    </>
  );
}
