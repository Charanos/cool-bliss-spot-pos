import 'server-only';

import { seedId } from '@bliss/db/seed/ids';
import { MENU } from '@bliss/db/seed/menu';
import { menuImage } from '@bliss/db/seed/menu-images';
import type { Category, Product } from '@bliss/shared/domain';

/**
 * A product with no photograph shows the one its menu section ships with (public/products), the
 * same the handover gives it. An outlet handed over before the photographs, whose database was never
 * brought up to date with pnpm db:menu, still shows a picture on every tile. Only what is loaded is
 * filled, never the database: a photograph the owner sets, or removes to set another, is theirs.
 */
export function fillMenuPhotos(data: { products: Product[]; categories: Category[] }): void {
  const byId = new Map(MENU.map((s) => [seedId(`menu:category:${s.key}`), s.key]));
  const byName = new Map(MENU.map((s) => [s.name.trim().toLowerCase(), s.key]));
  const section = new Map(data.categories.map((c) => [c.id, byId.get(c.id) ?? byName.get(c.name.trim().toLowerCase()) ?? null]));
  for (const product of data.products) {
    if (product.imageKey) continue;
    const key = section.get(product.categoryId);
    if (key) product.imageKey = menuImage(key, product.name);
  }
}
