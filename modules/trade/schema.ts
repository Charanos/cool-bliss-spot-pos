import 'server-only';
import { dataset } from '../_data/source';

/** Trade owns zones, tables, tabs, seats, orders, lines, modifiers, routing tickets and shifts. */
export const tradeTables = () => {
  const d = dataset();
  return {
    zones: d.zones,
    tables: d.tables,
    tabs: d.tabs,
    seats: d.seats,
    orders: d.orders,
    lines: d.lines,
    lineModifiers: d.lineModifiers,
    shifts: d.shifts,
  };
};
