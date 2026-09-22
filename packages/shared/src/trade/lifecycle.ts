import type { Tab } from '../domain';

/**
 * A tab's life on its table. docs/16 section 8.
 *
 *   open, part settled, settling    the guests are ordering or paying
 *   settled, not cleared            paid, still sitting: the table is theirs until someone clears it
 *   settled and cleared             gone; the tab is part of the night's record
 *   voided, merged                  never held a table on its own
 *
 * The Floor, the Counter and the server all ask these two questions the same way, so a table is
 * never free on one device and taken on another.
 */

const ORDERING: readonly Tab['status'][] = ['open', 'part_settled', 'settling'];

/** Paid, and the guests have not left yet. */
export function isSeated(tab: Pick<Tab, 'status' | 'clearedAt'>): boolean {
  return tab.status === 'settled' && tab.clearedAt === null;
}

/** Whether the tab keeps its table from being offered to the next party. */
export function holdsTable(tab: Pick<Tab, 'status' | 'clearedAt'>): boolean {
  return ORDERING.includes(tab.status) || isSeated(tab);
}

/** Still being ordered on or paid: the tabs a waiter works. */
export function isOrdering(tab: Pick<Tab, 'status'>): boolean {
  return ORDERING.includes(tab.status);
}
