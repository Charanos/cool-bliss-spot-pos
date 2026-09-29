'use client';

import type { AvailabilityEntry, AvailabilityState } from '@bliss/shared/domain';
import type { OutboxEntry } from '@bliss/shared/sync';
import { useSyncExternalStore } from 'react';
import { REJECTION_COPY, type RejectionCode } from '@bliss/shared/sync';
import { notify } from '@bliss/ui/components/notices';
import { NetworkUnavailable, SignInRequired, api, isForcedOffline } from './api';
import { haptic } from './haptics';
import { activeDisplay } from './display';
import { capsForServer, readCaps } from './device-caps';
import { META, posDb, getMeta, setMeta } from './db';

/**
 * Sync, docs/02 section 6, docs/05 section 2.9 and docs/14 section 4.
 *
 *  1. Pull before push, always: catalogue version, availability version, then trade changes since
 *     this device's cursor.
 *  2. A new epoch means the server's data was rebuilt: the device drops its trade copy and outbox and
 *     bootstraps again.
 *  3. Rows for a tab this device still has unsent entries for are held back until those entries are
 *     acknowledged, so the server never overwrites a change the device has not sent yet.
 *  4. Drain the outbox in seq order. A refusal takes the refused change off the device, refuses what
 *     was already queued behind it on the same tab, and asks for the tab again whole; work done
 *     after it sends as normal. Rows held back under point 3 are asked for again the same way.
 *  5. Repeat every five seconds while connected.
 */

export type LinkState = 'synced' | 'sending' | 'offline' | 'unreachable';

export interface SyncSnapshot {
  link: LinkState;
  heldOrders: number;
  unsentLines: number;
  rejected: number;
  lastSyncedAt: number | null;
  /** When the server last took something this device sent. History reads again on it. */
  lastPushedAt: number | null;
  bootstrapped: boolean;
  /** The most recent items that ran out or went on hold, for a polite announcement. */
  announcements: string[];
}

let snapshot: SyncSnapshot = {
  link: 'synced',
  heldOrders: 0,
  unsentLines: 0,
  rejected: 0,
  lastSyncedAt: null,
  lastPushedAt: null,
  bootstrapped: false,
  announcements: [],
};
const listeners = new Set<() => void>();

function publish(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

export function useSync(): SyncSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

interface TradeRows {
  tabs: { id: string }[];
  seats: { id: string; tabId: string }[];
  orders: { id: string; tabId: string; status: string }[];
  lines: { id: string; tabId: string; status: string }[];
  lineModifiers: { id: string; orderLineId: string }[];
  bills: { id: string; tabId: string | null }[];
  billLines: { id: string; billId: string }[];
  tenders: { id: string; billId: string }[];
  drawers: { id: string }[];
}

interface PullBody {
  epoch: string;
  reset: boolean;
  full: boolean;
  cursor: number;
  outlet: { id: string; name: string; timezone: string; cutover: string };
  businessDate: string;
  catalogueVersion: number;
  availabilityVersion: number;
  serverTime: number;
  catalogue?: {
    version: number;
    categories: unknown[];
    products: unknown[];
    variants: unknown[];
    modifierGroups: unknown[];
    modifiers: unknown[];
    variantModifierGroups: unknown[];
  };
  pricing?: { priceLists: unknown[]; priceListItems: unknown[]; priceRules: unknown[] };
  recipes?: unknown[];
  zones?: unknown[];
  tables?: unknown[];
  staff?: unknown[];
  devices?: unknown[];
  autoBind?: boolean;
  availability?: AvailabilityEntry[];
  /** No valid station token came with the pull: no trade rows, and the device asks for a PIN. */
  authRequired?: boolean;
  /** A renewed station token, when the one sent is getting old. */
  stationToken?: string;
  trade: TradeRows;
}

// Rows arrive validated by the server's own types; Dexie takes them as they are.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bulkPut over heterogeneous snapshot tables
type AnyRows = any[];

/** Remember tabs to ask the server for again whole, once nothing for them waits to send. */
async function markRefetch(ids: Iterable<string>) {
  const add = [...ids].filter(Boolean);
  if (add.length === 0) return;
  const known = (await getMeta<string[]>(META.refetchTabs)) ?? [];
  await setMeta(META.refetchTabs, [...new Set([...known, ...add])].slice(-200));
}

/** Tabs this device still has unsent entries for. Their server rows wait until those land. */
async function pendingAggregates(): Promise<Set<string>> {
  const pending = await posDb().outbox.where('status').anyOf('pending', 'inflight').toArray();
  return new Set(pending.map((e) => e.aggregateId));
}

async function resetTrade() {
  const db = posDb();
  await Promise.all([
    db.tabs.clear(),
    db.seats.clear(),
    db.orders.clear(),
    db.lines.clear(),
    db.lineModifiers.clear(),
    db.bills.clear(),
    db.billLines.clear(),
    db.tenders.clear(),
    db.drawers.clear(),
    db.outbox.clear(),
  ]);
  await Promise.all([setMeta(META.tradeCursor, -1), setMeta(META.catalogueVersion, -1), setMeta(META.availabilityVersion, -1)]);
}

async function applyTrade(rows: TradeRows, full: boolean) {
  const db = posDb();
  const held = await pendingAggregates();
  const keep = <T extends { tabId?: string | null }>(r: T) => !(r.tabId && held.has(r.tabId));

  if (full) {
    // A full picture replaces what the server knows, never what only this device has: its drafts and
    // anything for a tab with unsent changes.
    const drafts = new Set((await db.orders.where('status').equals('draft').toArray()).map((o) => o.id));
    await db.tabs.filter((t) => !held.has(t.id)).delete();
    await db.seats.filter((s) => !held.has(s.tabId)).delete();
    await db.orders.filter((o) => !drafts.has(o.id) && !held.has(o.tabId)).delete();
    await db.lines.filter((l) => l.status !== 'draft' && !held.has(l.tabId)).delete();
    await Promise.all([db.bills.clear(), db.billLines.clear(), db.tenders.clear(), db.drawers.clear()]);
  }

  const lineTab = new Map(rows.lines.map((l) => [l.id, l.tabId]));

  // Rows held back for a tab with unsent changes are not lost: the tab is asked for again whole once
  // those changes land or are refused, since the cursor moves past these rows now.
  if (!full && held.size > 0) {
    const skipped = new Set<string>();
    for (const t of rows.tabs) if (held.has(t.id)) skipped.add(t.id);
    for (const r of [...rows.seats, ...rows.orders, ...rows.lines]) if (r.tabId && held.has(r.tabId)) skipped.add(r.tabId);
    for (const m of rows.lineModifiers) {
      const tabId = lineTab.get(m.orderLineId);
      if (tabId && held.has(tabId)) skipped.add(tabId);
    }
    await markRefetch(skipped);
  }

  const tabs = rows.tabs.filter((t) => !held.has(t.id));
  if (tabs.length > 0) await db.tabs.bulkPut(tabs as AnyRows);

  const seats = rows.seats.filter(keep);
  if (seats.length > 0) await db.seats.bulkPut(seats as AnyRows);

  const orders = rows.orders.filter(keep);
  if (orders.length > 0) await db.orders.bulkPut(orders as AnyRows);

  const lines = rows.lines.filter(keep);
  if (lines.length > 0) await db.lines.bulkPut(lines as AnyRows);

  const lineModifiers = rows.lineModifiers.filter((m) => !held.has(lineTab.get(m.orderLineId) ?? ''));
  if (lineModifiers.length > 0) await db.lineModifiers.bulkPut(lineModifiers as AnyRows);

  if (rows.bills.length > 0) await db.bills.bulkPut(rows.bills as AnyRows);
  if (rows.billLines.length > 0) await db.billLines.bulkPut(rows.billLines as AnyRows);
  if (rows.tenders.length > 0) await db.tenders.bulkPut(rows.tenders as AnyRows);
  // A drawer with a drop or an open still unsent keeps the device's copy until those land.
  const drawers = rows.drawers.filter((d) => !held.has(d.id));
  if (drawers.length > 0) await db.drawers.bulkPut(drawers as AnyRows);
}

async function applyPull(body: PullBody) {
  const db = posDb();
  const changed: string[] = [];
  const knownEpoch = await getMeta<string>(META.epoch);
  const reset = Boolean(knownEpoch && knownEpoch !== body.epoch);
  // Written only when it changes: every live query that reads the meta table re-runs on a write.
  if ((await getMeta<boolean>(META.autoBind)) !== Boolean(body.autoBind)) await setMeta(META.autoBind, Boolean(body.autoBind));

  await db.transaction('rw', db.tables, async () => {
    if (reset) await resetTrade();
    await setMeta(META.epoch, body.epoch);
    await setMeta(META.outlet, body.outlet);
    await setMeta(META.businessDate, body.businessDate);
    if (body.catalogue && body.pricing) {
      await Promise.all([
        db.categories.clear(),
        db.products.clear(),
        db.variants.clear(),
        db.modifierGroups.clear(),
        db.modifiers.clear(),
        db.variantModifierGroups.clear(),
        db.priceLists.clear(),
        db.priceListItems.clear(),
        db.priceRules.clear(),
        db.recipes.clear(),
      ]);
      await db.categories.bulkPut(body.catalogue.categories as AnyRows);
      await db.products.bulkPut(body.catalogue.products as AnyRows);
      await db.variants.bulkPut(body.catalogue.variants as AnyRows);
      await db.modifierGroups.bulkPut(body.catalogue.modifierGroups as AnyRows);
      await db.modifiers.bulkPut(body.catalogue.modifiers as AnyRows);
      await db.variantModifierGroups.bulkPut(body.catalogue.variantModifierGroups as AnyRows);
      await db.priceLists.bulkPut(body.pricing.priceLists as AnyRows);
      await db.priceListItems.bulkPut(body.pricing.priceListItems as AnyRows);
      await db.priceRules.bulkPut(body.pricing.priceRules as AnyRows);
      await db.recipes.bulkPut((body.recipes ?? []) as AnyRows);
      if (body.zones) {
        await db.zones.clear();
        await db.zones.bulkPut(body.zones as AnyRows);
      }
      if (body.tables) {
        await db.serviceTables.clear();
        await db.serviceTables.bulkPut(body.tables as AnyRows);
      }
      if (body.staff) {
        await db.staff.clear();
        await db.staff.bulkPut(body.staff as AnyRows);
      }
      if (body.devices) {
        // Replaced whole, so a device the venue removed (or a handover cleared) is not kept here.
        await db.devices.clear();
        await db.devices.bulkPut(body.devices as AnyRows);
      }
      await setMeta(META.catalogueVersion, body.catalogueVersion);
    }
    if (body.availability) {
      const previous = new Map<string, AvailabilityState>((await db.availability.toArray()).map((a) => [a.productVariantId, a.state]));
      for (const entry of body.availability) {
        const before = previous.get(entry.productVariantId);
        if (before && before !== 'finished' && entry.state === 'finished') {
          const variant = await db.variants.get(entry.productVariantId);
          if (variant) changed.push(`${variant.name} is ${entry.reason === 'hold' ? 'on hold' : entry.reason === 'not_counted' ? 'not counted yet' : 'finished'}.`);
        }
      }
      await db.availability.bulkPut(body.availability);
      await setMeta(META.availabilityVersion, body.availabilityVersion);
    }
    if (body.stationToken) await setMeta(META.stationToken, body.stationToken);
    if (!body.authRequired) {
      await applyTrade(body.trade, body.full || reset);
      await setMeta(META.tradeCursor, body.cursor);
    }
    await setMeta(META.bootstrapped, true);
    await setMeta(META.lastPulledAt, Date.now());
  });
  if (changed.length > 0) {
    publish({ announcements: changed.slice(-3) });
    for (const message of changed) notify({ tone: 'warning', key: `stock:${message}`, title: message, body: 'It is off the grid on every device until it is restocked.' });
    haptic('warning');
  }
}

export async function pull(): Promise<void> {
  const [catalogueVersion, availabilityVersion, cursor, epoch, device, sentToken] = await Promise.all([
    getMeta<number>(META.catalogueVersion),
    getMeta<number>(META.availabilityVersion),
    getMeta<number>(META.tradeCursor),
    getMeta<string>(META.epoch),
    getMeta<{ id: string }>(META.deviceId),
    getMeta<string>(META.stationToken),
  ]);
  const unsynced = await posDb().outbox.where('status').anyOf('pending', 'inflight', 'rejected').count();
  const held = await pendingAggregates();
  const refetch = ((await getMeta<string[]>(META.refetchTabs)) ?? []).filter((id) => !held.has(id)).slice(0, 50);
  const query = new URLSearchParams({
    catalogue: String(catalogueVersion ?? -1),
    availability: String(availabilityVersion ?? -1),
    since: String(cursor ?? -1),
    epoch: epoch ?? '',
    device: device?.id ?? '',
    // The pull is also the heartbeat: what waits to send, which build, and what this device is.
    unsynced: String(unsynced),
    app: process.env.NEXT_PUBLIC_BLISS_VERSION ?? '',
    caps: capsForServer(readCaps(), activeDisplay()),
  });
  if (refetch.length > 0) query.set('refetch', refetch.join(','));
  const { body } = await api.get<PullBody>(`/api/station/sync/pull?${query.toString()}`);
  await applyPull(body);
  if (refetch.length > 0 && !body.authRequired) {
    const sent = new Set(refetch);
    const left = ((await getMeta<string[]>(META.refetchTabs)) ?? []).filter((id) => !sent.has(id));
    await setMeta(META.refetchTabs, left);
  }
  await pruneEarlierNights(body.businessDate);
  // A device still showing someone signed in, whose sign-in the server no longer accepts (from before
  // station tokens, or withdrawn since), asks for the PIN again. Its outbox is kept and sends after.
  // Only the sign-in this pull carried is refused: one made while it was in flight stands.
  if (body.authRequired && (await getMeta(META.session)) && ((await getMeta<string>(META.stationToken)) ?? null) === (sentToken ?? null)) {
    await setMeta(META.session, null);
    await setMeta(META.stationToken, null);
  }
  publish({ bootstrapped: true });
}

interface PushResult {
  id: string;
  status: 'acked' | 'rejected';
  code?: string;
  detail?: string;
  stockConflictLineIds?: string[];
}

let backoffUntil = 0;
let failures = 0;

export async function drain(): Promise<void> {
  // Nothing is sent until someone has signed in on this device: the server needs the station token.
  if (!(await getMeta<string>(META.stationToken))) return;
  const db = posDb();
  const pending = await db.outbox.where('status').anyOf('pending', 'inflight').sortBy('seq');
  if (pending.length === 0) return;
  const batch = pending.slice(0, 50);

  await db.outbox.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { status: 'inflight' as const, attempts: e.attempts + 1 } })));
  let results: PushResult[];
  const refused: PushResult[] = [];
  try {
    const { body } = await api.post<{ results: PushResult[] }>('/api/station/sync/push', { entries: batch });
    results = body.results;
  } catch (error) {
    await db.outbox.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { status: 'pending' as const } })));
    throw error;
  }

  const refetch = new Set<string>();
  const answered = new Set(results.map((r) => r.id));
  let acked = 0;
  await db.transaction('rw', [db.outbox, db.lines, db.drawers, db.bills, db.billLines, db.tenders, db.meta], async () => {
    for (const result of results) {
      if (result.status === 'acked') {
        acked += 1;
        await db.outbox.update(result.id, { status: 'acked', ackedAt: Date.now() });
        for (const lineId of result.stockConflictLineIds ?? []) await db.lines.update(lineId, { stockConflict: true });
        continue;
      }
      await db.outbox.update(result.id, { status: 'rejected', rejectionCode: result.code ?? 'REJECTED', rejectionDetail: result.detail });
      refused.push(result);
      const entry = batch.find((b) => b.id === result.id);
      if (!entry) continue;
      // Whatever was queued behind the refused change on the same tab, and not yet sent, depended on
      // it, so it is refused with it. Anything done after this, on the tab as the server has it, sends.
      const behind = await db.outbox
        .where('aggregateId')
        .equals(entry.aggregateId)
        .filter((e) => (e.status === 'pending' || (e.status === 'inflight' && !answered.has(e.id))) && e.seq > entry.seq)
        .toArray();
      for (const e of behind) await db.outbox.update(e.id, { status: 'rejected', rejectionCode: 'BLOCKED', rejectionDetail: 'An earlier change to this tab was refused.' });
      // The device's own copy of what was refused goes, and the tab is asked for again whole.
      if (entry.kind === 'drawer.open') await db.drawers.delete(entry.aggregateId);
      if (entry.kind === 'bill.settle') {
        const billId = (entry.payload as { billId: string }).billId;
        await db.bills.delete(billId);
        await db.billLines.where('billId').equals(billId).delete();
        await db.tenders.where('billId').equals(billId).delete();
      }
      refetch.add(entry.aggregateId);
    }
    // Anything sent that the server did not answer goes back in the queue, never left in flight.
    for (const e of batch) {
      if (answered.has(e.id)) continue;
      const now = await db.outbox.get(e.id);
      if (now?.status === 'inflight') await db.outbox.update(e.id, { status: 'pending' });
    }
  });
  await markRefetch(refetch);
  await setMeta(META.lastPushedAt, Date.now());
  if (acked > 0) publish({ lastPushedAt: Date.now() });
  for (const r of refused) {
    notify({
      tone: 'error',
      key: 'rejected',
      count: true,
      title: 'A change could not be sent',
      body: REJECTION_COPY[r.code as RejectionCode] ?? r.detail ?? 'The server refused it. A manager can see why in Console, Settings, Sync.',
    });
  }
  if (refused.length > 0) haptic('error');
}

async function recount(link?: LinkState) {
  const db = posDb();
  const open = await db.outbox.where('status').anyOf('pending', 'inflight').toArray();
  const fires = open.filter((e): e is OutboxEntry<'order.fire'> => e.kind === 'order.fire');
  const rejected = await db.outbox.where('status').equals('rejected').count();
  publish({
    heldOrders: fires.length,
    unsentLines: fires.reduce((n, e) => n + e.payload.lines.length, 0),
    rejected,
    ...(link ? { link } : null),
  });
}

let running = false;
let queued = false;

/** One cycle: pull, drain, and pull again if anything was sent, so what was applied shows at once. */
export async function syncNow(): Promise<void> {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    await recount();
    if (Date.now() < backoffUntil && !queued) return;
    const wasHolding = snapshot.link === 'offline' && snapshot.heldOrders > 0;
    const wasDown = snapshot.bootstrapped && (snapshot.link === 'offline' || snapshot.link === 'unreachable');
    try {
      await pull();
      if (wasHolding) publish({ link: 'sending' });
      const before = await posDb().outbox.where('status').anyOf('pending', 'inflight').count();
      await drain();
      if (before > 0) await pull();
      failures = 0;
      backoffUntil = 0;
      await recount('synced');
      publish({ lastSyncedAt: Date.now() });
      if (wasDown) {
        notify({ tone: 'success', key: 'link', title: 'Back online', body: before > 0 ? `${before} held ${before === 1 ? 'change' : 'changes'} sent.` : 'Everything on this device is up to date.' });
      }
    } catch (error) {
      if (error instanceof SignInRequired) {
        // Not an outage: the PIN screen is already showing. Keep the outbox and wait for a sign-in.
        await recount();
        return;
      }
      if (!(error instanceof NetworkUnavailable)) console.error('[sync]', error);
      failures += 1;
      backoffUntil = Date.now() + Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
      const db = posDb();
      const held = await db.outbox.where('status').anyOf('pending', 'inflight').count();
      const wasUp = snapshot.bootstrapped && (snapshot.link === 'synced' || snapshot.link === 'sending');
      await recount(held > 0 ? 'offline' : 'unreachable');
      if (wasUp && failures === 1) {
        notify({ tone: 'warning', key: 'link', title: 'This device is offline', body: 'Keep working. Everything is kept here and sends when the network is back.' });
      }
    }
  } finally {
    running = false;
    if (queued) {
      queued = false;
      void syncNow();
    }
  }
}

/** Start the five second cycle. Returns a stop function. */
export function startSync(): () => void {
  void (async () => {
    await getMeta<boolean>(META.bootstrapped).then((b) => publish({ bootstrapped: Boolean(b) }));
    await syncNow();
  })();
  const interval = setInterval(() => void syncNow(), 5000);
  const wake = () => {
    backoffUntil = 0;
    void syncNow();
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  return () => {
    clearInterval(interval);
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake);
  };
}

/**
 * Trade from earlier nights that is finished with (closed, and its table cleared) leaves this device
 * once a new business day starts, so every query reads tonight, not the whole week. Once per day.
 */
async function pruneEarlierNights(businessDate: string | undefined) {
  if (!businessDate || (await getMeta<string>(META.prunedFor)) === businessDate) return;
  const db = posDb();
  const held = await pendingAggregates();
  await db.transaction('rw', [db.tabs, db.seats, db.orders, db.lines, db.lineModifiers, db.bills, db.billLines, db.tenders, db.meta], async () => {
    const done = await db.tabs.filter((t) => t.businessDate < businessDate && (t.status === 'settled' || t.status === 'voided' || t.status === 'merged_into') && t.clearedAt !== null && !held.has(t.id)).toArray();
    const tabIds = done.map((t) => t.id);
    if (tabIds.length > 0) {
      const lineIds = (await db.lines.where('tabId').anyOf(tabIds).toArray()).map((l) => l.id);
      const billIds = (await db.bills.where('tabId').anyOf(tabIds).toArray()).map((b) => b.id);
      await db.lineModifiers.where('orderLineId').anyOf(lineIds).delete();
      await db.lines.where('tabId').anyOf(tabIds).delete();
      await db.orders.where('tabId').anyOf(tabIds).delete();
      await db.seats.where('tabId').anyOf(tabIds).delete();
      await db.billLines.where('billId').anyOf(billIds).delete();
      await db.tenders.where('billId').anyOf(billIds).delete();
      await db.bills.bulkDelete(billIds);
      await db.tabs.bulkDelete(tabIds);
    }
    // Quick sales from earlier nights go the same way.
    const quick = await db.bills.filter((b) => b.tabId === null && b.businessDate < businessDate).toArray();
    if (quick.length > 0) {
      const ids = quick.map((b) => b.id);
      await db.billLines.where('billId').anyOf(ids).delete();
      await db.tenders.where('billId').anyOf(ids).delete();
      await db.bills.bulkDelete(ids);
    }
    await setMeta(META.prunedFor, businessDate);
  });
}

/** Manually reset backoff and immediately trigger a sync cycle. */
export function wakeSync(): void {
  backoffUntil = 0;
  failures = 0;
  void syncNow();
}

export function forcedOfflineLabel() {
  return isForcedOffline();
}

/** Clear acknowledged entries after the 72 hour safety window. docs/02 section 11. */
export async function pruneAcked(): Promise<void> {
  const cutoff = Date.now() - 72 * 3_600_000;
  const db = posDb();
  const old = await db.outbox
    .where('status')
    .equals('acked')
    .filter((e) => (e.ackedAt ?? 0) < cutoff)
    .primaryKeys();
  // The outbox is device transport, not a record: acknowledged entries leave once the server holds them.
  await db.outbox.bulkDelete(old);
}
