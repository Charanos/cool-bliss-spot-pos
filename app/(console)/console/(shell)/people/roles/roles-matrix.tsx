'use client';

import type { PermissionKey } from '@bliss/shared/domain';
import { plural } from '@bliss/shared/format';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Card } from '@bliss/ui/components/console/card';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconLock, IconMinus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setRolePermission } from '../../_actions/people';
import type { RoleView } from './permissions';

type RoleColumn = Pick<RoleView, 'id' | 'key' | 'name' | 'permissions' | 'people' | 'locked' | 'lockedReason'>;

/**
 * N-09: the permission matrix, on one card. Each cell is a toggle button with aria-pressed; changing
 * one asks for a reason, because a permission change is audited as sensitive like a void.
 */
export function RolesMatrix({ roles, permissions, canManage, label = 'Permissions by role' }: { roles: RoleColumn[]; permissions: { key: PermissionKey; label: string; detail: string }[]; canManage: boolean; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    role: RoleColumn;
    permission: { key: PermissionKey; label: string };
    granted: boolean;
  } | null>(null);

  return (
    <>
      <Card aria-label={label}>
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="border-b border-edge card-band">
                <th scope="col" className="w-[280px] py-12 pl-20 pr-16 text-left align-bottom text-label text-ink-subtle">
                  Permission
                </th>
                {roles.map((r) => (
                  <th key={r.id} scope="col" className="px-8 py-12 text-center align-bottom">
                    <span className="flex flex-col items-center gap-2">
                      <span className="flex items-center gap-4 text-ui font-medium text-ink">
                        {r.locked ? <IconLock size={14} stroke={1.5} aria-label={r.lockedReason ?? 'Locked'} className="text-ink-subtle" /> : null}
                        <Link href={`/console/people/roles/${r.id}`} className="rounded-sm transition-hover hover:text-accent-text">
                          {r.name}
                        </Link>
                      </span>
                      <span className="text-body-sm text-ink-subtle">{plural(r.people, 'person', 'people')}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.key} className="border-b border-rule last:border-b-0">
                  <th scope="row" className="py-8 pl-20 pr-16 text-left font-regular">
                    <span className="block text-ui text-ink">{p.label}</span>
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
                          onClick={() =>
                            editable
                              ? setPending({
                                  role: r,
                                  permission: p,
                                  granted: !granted,
                                })
                              : undefined
                          }
                          className={cx(
                            'inline-flex size-control-sm items-center justify-center rounded-md transition-hover press-scale',
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
      </Card>

      <ConsoleOverlay
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={
          pending
            ? pending.granted
              ? `Let ${pending.role.name.toLowerCase()}s ${pending.permission.label.toLowerCase()}?`
              : `Stop ${pending.role.name.toLowerCase()}s being able to ${pending.permission.label.toLowerCase()}?`
            : ''
        }
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
              const r = await setRolePermission({
                roleId: pending.role.id,
                permission: pending.permission.key,
                granted: pending.granted,
                reason,
              });
              if (!r.ok) throw new Error(r.message);
              setPending(null);
              router.refresh();
            }}
          />
        ) : null}
      </ConsoleOverlay>
    </>
  );
}
