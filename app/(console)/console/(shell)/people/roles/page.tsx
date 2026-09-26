import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import { ViewHeader } from '../../_components/workspace';
import { PERMISSIONS, roleView } from './permissions';
import { RolesView } from './roles-view';

export const metadata: Metadata = { title: 'Roles and permissions' };

export default async function RolesPage() {
  const actor = await identity.currentConsoleActor();
  const staff = identity.staffList();
  const canManage = identity.can(actor.staffId, 'staff.manage');
  const all = identity.roles();
  const mine = identity.rankOf(actor.role);
  const roles = all.map((r) => roleView(r, staff, actor.role.id));
  // A new role is based on one below the manager's own, unless they are the owner.
  const bases = all.filter((r) => r.key !== 'owner' && (actor.role.key === 'owner' || identity.rankOf(r) < mine)).map((r) => ({ value: r.id, label: r.name }));
  return (
    <>
      <ViewHeader
        page="/console/people/roles"
        actions={
          canManage ? (
            <ButtonLink href="/console/people/roles?new=1" variant="create" icon={IconPlus}>
              Add a role
            </ButtonLink>
          ) : null
        }
      />
      <RolesView roles={roles} permissions={PERMISSIONS} canManage={canManage} bases={bases} />
    </>
  );
}
