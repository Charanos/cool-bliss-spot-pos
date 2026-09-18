import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import { Workspace } from '../_components/workspace';

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      title="People"
      description="Who can do what. Every change to a role or a permission is recorded with the reason."
      tabs={[
        { href: '/console/people/staff', label: 'Staff', count: identity.staffList().filter((s) => s.employmentStatus === 'active').length },
        { href: '/console/people/roles', label: 'Roles and permissions' },
      ]}
    >
      {children}
    </Workspace>
  );
}
