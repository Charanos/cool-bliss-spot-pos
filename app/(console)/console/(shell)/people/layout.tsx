import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import { Workspace } from '../_components/workspace';

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace workspace="people" counts={{ '/console/people/staff': identity.staffList().filter((s) => s.employmentStatus === 'active').length }}>
      {children}
    </Workspace>
  );
}
