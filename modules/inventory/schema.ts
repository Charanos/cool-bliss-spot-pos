import 'server-only';
import { dataset } from '../_data/source';

/** Inventory owns locations, the movement ledger, holds, pour specs, recipes and counts. */
export const inventoryTables = () => {
  const d = dataset();
  return {
    locations: d.locations,
    movements: d.movements,
    holds: d.holds,
    counts: d.counts,
    countLines: d.countLines,
    recipes: d.recipes,
    pourSpecs: d.pourSpecs,
  };
};
