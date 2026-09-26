import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="people">{children}</Workspace>;
}
