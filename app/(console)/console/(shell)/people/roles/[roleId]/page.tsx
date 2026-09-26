import { plural } from '@bliss/shared/format';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { IconDeviceTablet, IconKey, IconLock, IconShieldCheck, IconUsers } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ROLE_LABEL } from '../../../_lib/labels';
import { StaffAvatar } from '../../staff/avatar';
import { PERMISSIONS, roleView } from '../permissions';
import { RolesMatrix } from '../roles-matrix';
import { RoleActions } from './role-actions';

export async function generateMetadata({ params }: { params: Promise<{ roleId: string }> }): Promise<Metadata> {
  const { roleId } = await params;
  return { title: identity.roles().find((r) => r.id === roleId)?.name ?? 'Role' };
}

/** One role: who holds it, where it signs in, and each permission it carries, changed in place. */
export default async function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const role = identity.roles().find((r) => r.id === roleId);
  if (!role) notFound();
  const actor = await identity.currentConsoleActor();
  const staff = identity.staffList();
  const view = roleView(role, staff, actor.role.id);
  const canManage = identity.can(actor.staffId, 'staff.manage');
  const formerly = staff.filter((s) => s.roleId === role.id && s.employmentStatus !== 'active');
  const deleteBlocked = role.isSystem ? null : view.people > 0 || formerly.some((s) => s.employmentStatus === 'suspended') ? 'Held by someone, so it stays' : null;
  const sensitive = PERMISSIONS.filter((p) => ['void.approve', 'refund.approve', 'staff.manage', 'price.write'].includes(p.key) && role.permissions.includes(p.key));

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={role.name} />
      <DetailHeader
        back={{ href: '/console/people/roles', label: 'Roles' }}
        title={role.name}
        status={view.locked ? <IconLock size={16} stroke={1.5} aria-label={view.lockedReason ?? 'Locked'} className="text-ink-subtle" /> : null}
        meta={
          <MetaRow
            items={[
              { icon: IconDeviceTablet, value: `Signs in on ${view.surfaces}` },
              { icon: IconShieldCheck, value: role.isSystem ? 'One of the roles Bliss starts with' : `Based on ${ROLE_LABEL[role.key] ?? role.key}` },
            ]}
          />
        }
        actions={canManage && role.key !== 'owner' ? <RoleActions role={{ id: role.id, name: role.name }} deletable={!role.isSystem && !deleteBlocked} deleteBlocked={deleteBlocked} /> : null}
      />

      {view.lockedReason ? (
        <Callout tone="info" title={view.lockedReason}>
          {role.key === 'owner' ? 'Its permissions cannot be taken away, so the venue always has someone who can change everything.' : 'So nobody can widen their own access. Ask another manager, or the owner.'}
        </Callout>
      ) : null}

      <MetricGrid columns={3}>
        <Metric label="Held by" icon={IconUsers} tone={view.people > 0 ? 'poured' : 'attention'} value={view.people} detail={view.people > 0 ? plural(view.people, 'active person', 'active people') : 'Nobody, yet'} />
        <Metric
          label="Permissions"
          icon={IconKey}
          value={`${role.permissions.length} of ${PERMISSIONS.length}`}
          detail={<InlineBar value={role.permissions.length / PERMISSIONS.length} tone={role.key === 'owner' ? 'attention' : 'accent'} label={`${role.permissions.length} of ${PERMISSIONS.length} permissions`} className="w-full" />}
        />
        <Metric label="Can approve" icon={IconShieldCheck} tone={sensitive.length > 0 ? 'info' : 'default'} value={sensitive.length} detail={sensitive.length > 0 ? sensitive.map((p) => p.label.toLowerCase()).join(', ') : 'No voids, refunds, prices or people'} />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
        <RolesMatrix roles={[view]} permissions={PERMISSIONS} canManage={canManage} label={`What ${role.name.toLowerCase()}s can do`} />

        <Card aria-labelledby="role-people">
          <CardHeader band level="h2" titleId="role-people" title="Who holds it" subtitle={formerly.length > 0 ? `${plural(formerly.length, 'more')} suspended or gone` : undefined} />
          {view.members.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="Nobody holds this role" body="Give it to someone from their own page, or delete it." />
            </div>
          ) : (
            <ul className="flex flex-col">
              {view.members.map((m) => (
                <li key={m.id} className="flex items-center gap-12 border-b border-rule px-20 py-12 last:border-b-0">
                  <StaffAvatar name={m.name} avatarUrl={m.avatarUrl} colourIndex={m.colourIndex} />
                  <EntityLink kind="staff" id={m.id} className="text-ui">
                    {m.name}
                  </EntityLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
