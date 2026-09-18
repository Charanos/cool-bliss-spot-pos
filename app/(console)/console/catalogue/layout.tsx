import type { ReactNode } from 'react';
import * as catalogue from '@/modules/catalogue/service';
import { Workspace } from '../_components/workspace';

export default function CatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      title="Catalogue"
      description="One product, several serves off the same bottle. Changes reach the floor with the next snapshot."
      tabs={[
        { href: '/console/catalogue/products', label: 'Products', count: catalogue.products().filter((p) => p.status === 'active').length },
        { href: '/console/catalogue/categories', label: 'Categories' },
        { href: '/console/catalogue/modifiers', label: 'Modifiers' },
      ]}
    >
      {children}
    </Workspace>
  );
}
