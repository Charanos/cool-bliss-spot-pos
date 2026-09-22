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

/**
 * Where a table stands, in the order the night moves through it. docs/16 section 8. Each stage has
 * one next step, and the screens put that step on the tab card itself.
 *
 *   empty      sat down, nothing sent yet                  take the order, or close it with a reason
 *   at_bar     something fired and still to pour           nothing: it is the counter's turn
 *   to_serve   poured, not yet at the table                mark it served
 *   served     everything at the table, nothing paid yet   ask for the bill, or settle
 *   bill       the guests asked for the bill               settle
 *   seated     paid, the guests still sitting              clear the table
 *   cleared    gone                                        nothing
 *
 * Asking for the bill outranks a round still pouring: the counter needs to know first.
 */
export type TableStage = 'empty' | 'at_bar' | 'to_serve' | 'served' | 'bill' | 'seated' | 'cleared';

export function tableStage(
  tab: Pick<Tab, 'status' | 'clearedAt' | 'billAskedAt'>,
  lines: readonly { status: string; orderId: string }[],
  delivered: (orderId: string) => boolean,
): TableStage {
  if (tab.status === 'settled') return tab.clearedAt === null ? 'seated' : 'cleared';
  if (tab.billAskedAt) return 'bill';
  const fired = lines.filter((l) => l.status === 'pending' || l.status === 'served');
  if (fired.length === 0) return 'empty';
  if (fired.some((l) => l.status === 'pending')) return 'at_bar';
  if (fired.some((l) => !delivered(l.orderId))) return 'to_serve';
  return 'served';
}
