'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useDialog } from '../../../_components/forms';
import { RoleDeleteDialog, RoleFormDialog } from '../role-dialogs';

/** Rename the role, or delete it once nobody holds it. */
export function RoleActions({ role, deletable, deleteBlocked }: { role: { id: string; name: string }; deletable: boolean; deleteBlocked: string | null }) {
  const dialog = useDialog<'rename' | 'delete'>();
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('rename', null)}>
        Rename
      </Button>
      {deletable || deleteBlocked ? (
        <OverflowMenu
          label={`More for ${role.name}`}
          items={[{ key: 'delete', label: deleteBlocked ?? 'Delete the role', icon: IconTrash, destructive: true, disabled: !deletable, onSelect: () => dialog.open('delete', null) }]}
        />
      ) : null}
      <RoleFormDialog open={dialog.is('rename')} onClose={dialog.close} target={role} bases={[]} />
      <RoleDeleteDialog open={dialog.is('delete')} onClose={dialog.close} role={role} after="/console/people/roles" />
    </>
  );
}
