import 'server-only';
import { dataset } from '../_data/source';

/** Pricing owns price lists, price list items and time rules. */
export const pricingTables = () => {
  const d = dataset();
  return { priceLists: d.priceLists, items: d.priceListItems, rules: d.priceRules };
};
