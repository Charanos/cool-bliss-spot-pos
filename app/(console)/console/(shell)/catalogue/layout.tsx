import type { ReactNode } from 'react';
import * as catalogue from '@/modules/catalogue/service';
import { Workspace } from '../_components/workspace';

export default function CatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace workspace="catalogue" counts={{ '/console/catalogue/products': catalogue.products().filter((p) => p.status === 'active').length }}>
      {children}
    </Workspace>
  );
}
