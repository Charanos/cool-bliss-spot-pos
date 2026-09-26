import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import { Workspace } from '../_components/workspace';

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      eyebrow="MANAGEMENT · ROLES & ACCESS"
      title="People & Zoning"
      description="Who can do what, and where they operate. Manage staff, roles, tables, and zones."
      tabs={[
        { href: '/console/people/staff', label: 'Staff', count: identity.staffList().filter((s) => s.employmentStatus === 'active').length },
        { href: '/console/people/roles', label: 'Roles and permissions' },
        { href: '/console/people/zoning', label: 'Zoning' },
      ]}
    >
      {children}
    </Workspace>
  );
}
