import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import { ViewHeader } from '../../_components/workspace';
import { type CategoryRow, CategoriesTable } from './categories-table';

export const metadata: Metadata = { title: 'Categories' };

const ROUTING: Record<string, string> = { bar: 'The bar screen', kitchen: 'The kitchen', none: 'Nowhere' };

/** Categories set the floor's tabs, where a fired line goes, and whether stock is tracked. */
export default function CategoriesPage() {
  const products = catalogue.products();
  const rows: CategoryRow[] = catalogue.categories().map((c) => ({
    id: c.id,
    order: c.sortOrder,
    name: c.name,
    colour: c.colourToken,
    routing: ROUTING[c.routingTarget] ?? 'Nowhere',
    tracked: c.trackStock,
    products: products.filter((p) => p.categoryId === c.id && p.status === 'active').length,
    active: c.status === 'active',
  }));
  return (
    <>
      <ViewHeader page="/console/catalogue/categories" />
      <CategoriesTable rows={rows} />
    </>
  );
}
