'use client';

import { plural } from '@bliss/shared/format';
import { notify } from '@bliss/ui/components/notices';
import { isForcedOffline } from './api';
import { haptic } from './haptics';
import {
  addLine,
  clearTable,
  closeEmptyTab,
  fireOrder,
  handOver,
  markOrderDelivered,
  markTableOrdersDelivered,
  type SeatSelection,
  setBillAsked,
  setDraftQty,
  undoClearTable,
  unmarkOrderDelivered,
} from './mutations';
import { pourLines } from './counter';
import { posDb } from './db';

/**
 * Actions with their answer. docs/16 section 7.
 *
 * The mutations in mutations.ts and counter.ts change data and nothing else. These wrap the ones a
 * person triggers, and say what happened: a notice in the right tone, an undo where there is a real
 * inverse, a buzz where the person asked for one. Screens call these, so the same action reads the
 * same wherever it is taken.
 *
 * An undo here is never cosmetic. It runs the inverse change through the outbox like any other, and
 * if the server has since made it impossible, the refusal comes back as its own notice.
 */

function offline(): boolean {
  return isForcedOffline() || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

/** Run a change and turn a thrown error into an error notice. Returns whether it went through. */
export async function attempt(run: () => Promise<unknown>, failure = 'That did not go through'): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (e) {
    haptic('error');
    notify({ tone: 'error', title: failure, body: e instanceof Error ? e.message : 'Nothing was changed.' });
    return false;
  }
}

/* ------------------------------------------------------------------ floor */

/**
 * A tile tapped. One notice per item and seat, counting up as the waiter keeps tapping, with an
 * undo that takes the last one back off. On a phone, where the ticket is behind a drawer, this is
 * the only sign the tap landed.
 */
export async function addItem(input: { tabId: string; seat: SeatSelection; seatName: string; variantId: string; name: string }) {
  const lineId = await addLine({ tabId: input.tabId, seat: input.seat, variantId: input.variantId });
  if (!lineId) {
    haptic('warning');
    notify({ tone: 'warning', key: `finished:${input.variantId}`, title: `${input.name} is finished`, body: 'It cannot be added until it is restocked.' });
    return null;
  }
  haptic('tap');
  const line = await posDb().lines.get(lineId);
  notify({
    key: `add:${input.tabId}:${String(input.seat)}:${input.variantId}`,
    count: true,
    holdMs: 2600,
    title: `${input.name} added`,
    body: `${line?.qty ?? 1} on ${input.seatName}. Not fired yet.`,
    undo: async () => {
      const current = await posDb().lines.get(lineId);
      if (!current || current.status !== 'draft') throw new Error('That line was fired already. Void it from the ticket instead.');
      await setDraftQty(lineId, current.qty - 1);
    },
  });
  return lineId;
}

export async function fire(tabId: string, label: string): Promise<number> {
  let fired = 0;
  const ok = await attempt(async () => {
    fired = await fireOrder(tabId);
  }, 'The order did not fire');
  if (!ok) return 0;
  if (fired === 0) {
    notify({ tone: 'info', key: `fire:${tabId}`, title: 'Nothing to fire', body: 'Add something from the grid first.' });
    return 0;
  }
  haptic('success');
  notify(
    offline()
      ? { tone: 'info', key: `fire:${tabId}`, title: `Held on this device · ${label}`, body: `${plural(fired, 'line')} will reach the counter the moment the network is back.` }
      : { tone: 'success', key: `fire:${tabId}`, title: `Fired · ${label}`, body: `${plural(fired, 'line')} sent to the counter.` },
  );
  return fired;
}

/** The round is at the table. Undo takes the mark back. */
export async function deliver(orderId: string, label: string) {
  const ok = await attempt(() => markOrderDelivered(orderId), 'Could not mark it served');
  if (!ok) return;
  haptic('success');
  notify({ key: `deliver:${orderId}`, title: `Served · ${label}`, body: 'The round is recorded as at the table.', undo: () => unmarkOrderDelivered(orderId).then(() => undefined) });
}

export async function undeliver(orderId: string, label: string) {
  const ok = await attempt(() => unmarkOrderDelivered(orderId), 'Could not take the mark back');
  if (ok) notify({ tone: 'info', key: `deliver:${orderId}`, title: `Back to poured · ${label}`, body: 'It shows as waiting to go to the table again.' });
}

export async function deliverTable(tabId: string, label: string) {
  let n = 0;
  const ok = await attempt(async () => {
    n = await markTableOrdersDelivered(tabId);
  }, 'Could not mark the table served');
  if (!ok) return;
  if (n === 0) return notify({ tone: 'info', key: `deliver-table:${tabId}`, title: 'Nothing poured to serve', body: `Every poured round for ${label} is already at the table.` });
  haptic('success');
  notify({ key: `deliver-table:${tabId}`, title: `Served · ${label}`, body: `${plural(n, 'round')} recorded as at the table.` });
}

/**
 * Tables to a colleague, at the end of a shift or mid-rush. Undo hands each table back to whoever
 * had it, through the outbox like any change.
 */
export async function handOverTabs(tabIds: string[], to: { id: string; name: string }) {
  let previous = new Map<string, string[]>();
  const ok = await attempt(async () => {
    previous = await handOver(tabIds, to.id);
  }, 'The tables were not handed over');
  if (!ok) return false;
  const moved = [...previous.values()].reduce((n, ids) => n + ids.length, 0);
  haptic('success');
  notify({
    key: `handover:${to.id}`,
    title: `${plural(moved, 'table')} handed to ${to.name}`,
    body: offline() ? 'It reaches their device the moment the network is back.' : 'Seats, lines and bills go with them, unchanged.',
    undo: async () => {
      for (const [owner, ids] of previous) await handOver(ids, owner);
    },
  });
  return true;
}

/**
 * The guests want to pay. The Counter sees the tab first in its list the moment this lands; undo
 * takes the ask back if they order another round instead.
 */
export async function askBill(tabId: string, label: string) {
  const ok = await attempt(() => setBillAsked(tabId, true), 'The bill was not asked for');
  if (!ok) return;
  haptic('success');
  notify({
    key: `bill:${tabId}`,
    title: `Bill asked · ${label}`,
    body: offline() ? 'It reaches the counter the moment the network is back.' : 'The counter has it at the top of their list.',
    undo: () => setBillAsked(tabId, false),
  });
}

export async function takeBackBill(tabId: string, label: string) {
  const ok = await attempt(() => setBillAsked(tabId, false), 'The bill request was not taken back');
  if (ok) notify({ tone: 'info', key: `bill:${tabId}`, title: `Bill request taken back · ${label}`, body: 'The tab stays open for another round.' });
}

/**
 * The guests have gone. The table is free on every device at once; undo holds for as long as the
 * notice stands, and the server refuses it only if new guests have sat down there already.
 */
export async function clear(tabId: string, label: string) {
  const ok = await attempt(() => clearTable(tabId), 'The table was not cleared');
  if (!ok) return false;
  haptic('success');
  notify({
    key: `clear:${tabId}`,
    title: `${label} is clear`,
    body: 'The table is free on every device, and the tab is in tonight’s history.',
    undo: () => undoClearTable(tabId),
  });
  return true;
}

export async function closeEmpty(tabId: string, label: string, reason: string) {
  await closeEmptyTab(tabId, reason);
  haptic('success');
  notify({ key: `clear:${tabId}`, title: `${label} closed`, body: 'Nothing was ordered. The reason is kept with the tab.' });
}

/* ---------------------------------------------------------------- counter */

/**
 * Lines poured. One notice per ticket, counting up as the lines go, so pouring a round line by line
 * reads as one round. There is no undo: a poured drink is a poured drink, and a wrong one is voided
 * with its reason like any other.
 */
export async function pour(tabId: string, orderId: string, lineIds: string[], label: string, whole: boolean) {
  const ok = await attempt(() => pourLines(tabId, lineIds), 'Could not record the pour');
  if (!ok) return;
  haptic(whole ? 'success' : 'tap');
  notify({
    key: `pour:${orderId}`,
    count: !whole,
    holdMs: 2800,
    title: whole ? `Poured · ${label}` : `Poured on ${label}`,
    body: whole ? `${plural(lineIds.length, 'line')}. The waiter sees it on the Floor now.` : 'The waiter sees each line as it is poured.',
  });
}
