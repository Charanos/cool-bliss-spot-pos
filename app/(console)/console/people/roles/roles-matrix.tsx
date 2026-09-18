'use client';

import type { PermissionKey, RoleKey } from '@bliss/shared/domain';
import { plural } from '@bliss/shared/format';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconLock, IconMinus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setRolePermission } from '../../_actions';

interface RoleColumn {
  id: string;
  key: RoleKey;
  name: string;
  permissions: PermissionKey[];
  people: number;
  locked: boolean;
  lockedReason: string | null;
}

/**
 * N-09: the permission matrix. Each cell is a toggle button with aria-pressed; changing one asks for
 * a reason, because a permission change is audited as sensitive like a void.
 */
export function RolesMatrix({ roles, permissions, canManage }: { roles: RoleColumn[]; permissions: { key: PermissionKey; label: string; detail: string }[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ role: RoleColumn; permission: { key: PermissionKey; label: string }; granted: boolean } | null>(null);

  return (
    <RevealSection>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="w-[260px] py-12 pr-16 text-left text-label text-ink-subtle">
                Permission
              </th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-8 py-12 text-center align-bottom">
                  <span className="flex flex-col items-center gap-2">
                    <span className="flex items-center gap-4 text-body text-ink">
                      {r.locked ? <IconLock size={14} stroke={1.5} aria-label={r.lockedReason ?? 'Locked'} className="text-ink-subtle" /> : null}
                      {r.name}
                    </span>
                    <span className="text-body-sm text-ink-subtle">{plural(r.people, 'person', 'people')}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.key} className="border-b border-rule">
                <th scope="row" className="py-8 pr-16 text-left font-normal">
                  <span className="block text-body text-ink">{p.label}</span>
                  <span className="block text-body-sm text-ink-subtle">{p.detail}</span>
                </th>
                {roles.map((r) => {
                  const granted = r.permissions.includes(p.key);
                  const editable = canManage && !r.locked;
                  return (
                    <td key={r.id} className="px-8 py-8 text-center">
                      <button
                        type="button"
                        aria-pressed={granted}
                        aria-disabled={!editable || undefined}
                        aria-label={`${r.name}: ${p.label}`}
                        title={!editable ? (r.lockedReason ?? 'You cannot change permissions') : undefined}
                        onClick={() => (editable ? setPending({ role: r, permission: p, granted: !granted }) : undefined)}
                        className={cx(
                          'inline-flex size-control-sm items-center justify-center rounded-sm press-feedback',
                          granted ? 'bg-accent-subtle text-accent-text' : 'text-ink-disabled',
                          editable ? (granted ? 'hover:bg-control-hover' : 'hover:bg-control hover:text-ink-muted') : 'cursor-default',
                        )}
                      >
                        {granted ? <IconCheck size={18} stroke={2} aria-hidden="true" /> : <IconMinus size={16} stroke={1.5} aria-hidden="true" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConsoleOverlay
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? `${pending.granted ? 'Give' : 'Take'} ${pending.role.name.toLowerCase()}s ${pending.granted ? 'the right to' : 'away the right to'} ${pending.permission.label.toLowerCase()}?` : ''}
        description={pending ? `This changes it for ${plural(pending.role.people, 'person', 'people')} from their next action.` : undefined}
        width="md"
      >
        {pending ? (
          <ReasonForm
            key={`${pending.role.id}-${pending.permission.key}`}
            destructive={!pending.granted}
            quickReasons={pending.granted ? ['Covering busy nights', 'New responsibility'] : ['No longer needed', 'Too many voids']}
            confirmLabel={pending.granted ? `Grant to ${pending.role.name.toLowerCase()}s` : `Remove from ${pending.role.name.toLowerCase()}s`}
            onCancel={() => setPending(null)}
            onConfirm={async ({ reason }) => {
              const r = await setRolePermission({ roleId: pending.role.id, permission: pending.permission.key, granted: pending.granted, reason });
              if (!r.ok) throw new Error(r.message);
              setPending(null);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>
    </RevealSection>
  );
}
