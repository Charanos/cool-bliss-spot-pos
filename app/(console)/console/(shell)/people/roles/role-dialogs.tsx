'use client';

import { SelectField, TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createRole, deleteRole, renameRole } from '../../_actions/venue';
import { FormDialog, ReasonDialog } from '../../_components/forms';

type Option = { value: string; label: string };

/** Add a role, based on one that exists, or rename one. */
export function RoleFormDialog({ open, onClose, target, bases }: { open: boolean; onClose: () => void; target: { id: string; name: string } | null; bases: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [base, setBase] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? '');
    setBase(bases[0]?.value ?? '');
  }, [open, target, bases]);
  const editing = Boolean(target);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      width="md"
      title={editing ? `Rename ${target!.name}` : 'Add a role'}
      description={editing ? 'Everyone who holds it sees the new name at their next sign-in.' : 'It starts with the permissions of the role it is based on, and signs in where that role does. Change its permissions after.'}
      submitLabel={editing ? 'Rename' : 'Add the role'}
      onSubmit={async () => (editing ? renameRole({ roleId: target!.id, name }) : createRole({ name, basedOnRoleId: base }))}
      onDone={(result) => {
        if (!editing && 'id' in result) router.push(`/console/people/roles/${String(result.id)}`);
      }}
    >
      <TextField label="Called" value={name} onChange={(e) => setName(e.target.value)} placeholder="Head waiter" required maxLength={30} />
      {editing ? null : <SelectField label="Based on" value={base} onChange={(e) => setBase(e.target.value)} options={bases} helper="Where it signs in and how senior it is come from this role." />}
    </FormDialog>
  );
}

/** Delete a role nobody holds. */
export function RoleDeleteDialog({ open, onClose, role, after }: { open: boolean; onClose: () => void; role: { id: string; name: string } | null; after?: string }) {
  const router = useRouter();
  return (
    <ReasonDialog
      open={open && Boolean(role)}
      onClose={onClose}
      title={`Delete ${role?.name ?? 'the role'}?`}
      description="Nobody holds it. Its history stays in the audit trail."
      confirmLabel="Delete the role"
      quickReasons={['Added by mistake', 'No longer used']}
      run={async (reason) => {
        const result = await deleteRole({ roleId: role!.id, reason });
        if (result.ok && after) router.push(after);
        return result;
      }}
    />
  );
}
