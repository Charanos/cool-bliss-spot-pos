import { ZERO, isPositive, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import { ViewHeader } from '../../_components/workspace';
import { type CategoryRow, CategoriesTable } from './categories-table';

export const metadata: Metadata = { title: 'Categories' };

const ROUTING: Record<string, string> = { bar: 'The bar', kitchen: 'The kitchen', none: 'Nowhere' };
const DAYS = 28;

/** Categories set the floor's tabs, where a fired line prints, and whether stock is counted. */
export default async function CategoriesPage() {
  const actor = await identity.currentConsoleActor();
  const products = catalogue.products();
  const to = reporting.clock().lastNight;
  const sales = new Map(reporting.salesByCategory(addDays(to, -DAYS + 1), to).map((c) => [c.name, c.value]));
  const total = sum([...sales.values()]);
  const ordered = catalogue.categories();
  const onFloor = ordered.filter((c) => c.status === 'active');
  const rows: CategoryRow[] = ordered.map((c) => {
    const takings = sales.get(c.name) ?? ZERO;
    return {
      id: c.id,
      position: onFloor.indexOf(c) + 1,
      name: c.name,
      colour: c.colourToken,
      routingTarget: c.routingTarget,
      routing: ROUTING[c.routingTarget] ?? 'Nowhere',
      trackStock: c.trackStock,
      products: products.filter((p) => p.categoryId === c.id && p.status === 'active').length,
      archivedProducts: products.filter((p) => p.categoryId === c.id && p.status === 'archived').length,
      takings,
      share: isPositive(total) ? Number(takings) / Number(total) : 0,
      active: c.status === 'active',
    };
  });
  return (
    <>
      <ViewHeader page="/console/catalogue/categories" />
      <CategoriesTable rows={rows} canEdit={identity.can(actor.staffId, 'price.write')} days={DAYS} />
    </>
  );
}
