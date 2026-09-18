import 'server-only';
import { dataset } from '../_data/source';

/** Catalogue owns categories, products, variants and modifiers. */
export const catalogueTables = () => {
  const d = dataset();
  return {
    version: d.catalogueVersion,
    categories: d.categories,
    products: d.products,
    variants: d.variants,
    modifierGroups: d.modifierGroups,
    modifiers: d.modifiers,
    variantModifierGroups: d.variantModifierGroups,
  };
};
