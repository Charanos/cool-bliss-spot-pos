'use client';

import type { PermissionKey } from '@bliss/shared/domain';
import { plural } from '@bliss/shared/format';
import { Card, CardFooter, CardGroup, CardHeader } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { IconKey, IconLock, IconShieldCheck, IconUsers, IconUsersGroup } from '@tabler/icons-react';
import { useCreateParam, useDialog } from '../../_components/forms';
import { StaffAvatar } from '../staff/avatar';
import type { RoleView } from './permissions';
import { RoleFormDialog } from './role-dialogs';
import { RolesMatrix } from './roles-matrix';

/** Every role as a card, with who holds it and how much it can do; the full matrix below. */
export function RolesView({ roles, permissions, canManage, bases }: { roles: RoleView[]; permissions: { key: PermissionKey; label: string; detail: string }[]; canManage: boolean; bases: { value: string; label: string }[] }) {
  const dialog = useDialog<'create'>();
  useCreateParam(() => dialog.open('create', null), canManage);
  const people = roles.reduce((n, r) => n + r.people, 0);
  const empty = roles.filter((r) => r.people === 0).length;
  const custom = roles.filter((r) => !r.isSystem).length;
  const approvers = roles.filter((r) => r.permissions.includes('void.approve') || r.permissions.includes('refund.approve')).reduce((n, r) => n + r.people, 0);

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Roles" icon={IconShieldCheck} value={<CountUp value={roles.length} />} detail={custom > 0 ? `${custom} added here` : 'The roles Bliss starts with'} />
        <Metric label="People with a role" icon={IconUsers} tone="poured" value={<CountUp value={people} delayMs={60} />} detail="Active, across every role" />
        <Metric label="Can approve" icon={IconKey} tone={approvers > 0 ? 'info' : 'default'} value={<CountUp value={approvers} delayMs={120} />} detail="Voids or refunds, by their role" />
        <Metric label="Held by nobody" icon={IconUsersGroup} tone={empty > 0 ? 'attention' : 'default'} value={<CountUp value={empty} delayMs={180} />} detail={empty > 0 ? 'Give them to someone, or delete them' : 'Every role is held'} />
      </MetricGrid>

      <CardGroup
        title="Roles"
        description="Where each signs in, and what it can do"
        icon={IconShieldCheck}
        gridClassName="grid grid-cols-1 gap-16 desktop:grid-cols-3"
      >
        {roles.map((r) => (
          <Card key={r.id} as="article" interactive className="group h-full" tone={r.people === 0 ? 'low' : undefined}>
            <CardHeader
              band
              title={r.name}
              subtitle={`Signs in on ${r.surfaces}`}
              href={`/console/people/roles/${r.id}`}
              meta={r.locked ? <IconLock size={14} stroke={1.5} aria-label={r.lockedReason ?? 'Locked'} className="text-ink-subtle" /> : null}
            />
            <div className="flex flex-col gap-8 px-20 py-16">
              <span className="flex items-baseline justify-between gap-12 text-body-sm">
                <span className="text-ink-muted">Permissions</span>
                <span className="font-mono tabular text-num-sm text-ink">
                  {r.permissions.length} of {permissions.length}
                </span>
              </span>
              <InlineBar value={r.permissions.length / permissions.length} tone={r.key === 'owner' ? 'attention' : 'accent'} label={`${r.permissions.length} of ${permissions.length} permissions`} className="w-full" />
            </div>
            <CardFooter>
              <span className="flex -space-x-6">
                {r.members.slice(0, 5).map((m) => (
                  <span key={m.id} className="rounded-dot ring-2 ring-card">
                    <StaffAvatar name={m.name} avatarUrl={m.avatarUrl} colourIndex={m.colourIndex} />
                  </span>
                ))}
              </span>
              <span className="text-body-sm text-ink-muted">{r.people === 0 ? 'Nobody holds it' : plural(r.people, 'person', 'people')}</span>
            </CardFooter>
          </Card>
        ))}
      </CardGroup>

      <CardGroup title="Permissions by role" description="Each change asks for a reason and is kept in the audit trail" icon={IconKey}>
        <RolesMatrix roles={roles} permissions={permissions} canManage={canManage} />
      </CardGroup>

      <RoleFormDialog open={dialog.is('create')} onClose={dialog.close} target={null} bases={bases} />
    </div>
  );
}
