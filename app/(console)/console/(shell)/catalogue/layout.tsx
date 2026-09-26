import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function CatalogueLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="catalogue">{children}</Workspace>;
}
