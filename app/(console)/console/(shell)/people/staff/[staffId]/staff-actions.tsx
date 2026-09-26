'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconPencil } from '@tabler/icons-react';
import type { StaffRow } from '../staff-table';
import { useStaffManager } from '../staff-manager';

/** The person's own actions, beside their name: the same as the list's row menu. */
export function StaffActions({ row, roles, canManage }: { row: StaffRow; roles: { value: string; label: string }[]; canManage: boolean }) {
  const manager = useStaffManager({ roles, canManage });
  if (!canManage || row.status === 'left') return null;
  const items = manager.actions(row).filter((a) => a.key !== 'edit');
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => manager.edit(row)}>
        Edit details and PIN
      </Button>
      {items.length > 0 ? <OverflowMenu label={`More for ${row.displayName}`} items={items} /> : null}
      {manager.dialogs}
    </>
  );
}
