import { seedId } from '@bliss/db/seed/ids';
import type { Category, Product } from '@bliss/shared/domain';
import { describe, expect, it } from 'vitest';
import { fillMenuPhotos } from './menu-photos';

const category = (id: string, name: string) => ({ id, name }) as Category;
const product = (name: string, categoryId: string, imageKey: string | null = null) => ({ name, categoryId, imageKey }) as Product;

describe('menu photographs on an outlet handed over before them', () => {
  it('fills a missing photo from the menu section, by category id or name, and leaves the rest', () => {
    const beers = seedId('menu:category:beers');
    const products = [product('Tusker Lager 500ml', beers), product('Mutura', 'c-snacks'), product('Guinness', beers, '/api/uploads/own.webp'), product('Something', 'c-own')];
    fillMenuPhotos({ products, categories: [category(beers, 'Beers'), category('c-snacks', 'Snacks'), category('c-own', 'House specials')] });
    expect(products[0]!.imageKey).toBe('/products/tusker-lager.webp');
    expect(products[1]!.imageKey).toMatch(/^\/products\/.+\.webp$/);
    expect(products[2]!.imageKey).toBe('/api/uploads/own.webp');
    expect(products[3]!.imageKey).toBeNull();
  });
});
