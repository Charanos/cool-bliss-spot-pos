'use client';

import type { AvailabilityEntry, AvailabilityState } from '@bliss/shared/domain';
import type { OutboxEntry } from '@bliss/shared/sync';
import { useSyncExternalStore } from 'react';
import { NetworkUnavailable, api, isForcedOffline } from './api';
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
 *  4. Drain the outbox in seq order. A rejection blocks that tab only.
 *  5. Repeat every five seconds while connected.
 */

export type LinkState = 'synced' | 'sending' | 'offline' | 'unreachable';

export interface SyncSnapshot {
  link: LinkState;
  heldOrders: number;
  unsentLines: number;
  rejected: number;
  lastSyncedAt: number | null;
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
  availability?: AvailabilityEntry[];
  trade: TradeRows;
}

// Rows arrive validated by the server's own types; Dexie takes them as they are.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bulkPut over heterogeneous snapshot tables
type AnyRows = any[];

/** Tabs this device still has unsent entries for. Their server rows wait until those land. */
async function pendingAggregates(): Promise<Set<string>> {
  const pending = await posDb().outbox.where('status').anyOf('pending', 'inflight').toArray();
  return new Set(pending.map((e) => e.aggregateId));
}

async function resetTrade() {
  const db = posDb();
  await Promise.all([db.tabs.clear(), db.seats.clear(), db.orders.clear(), db.lines.clear(), db.lineModifiers.clear(), db.bills.clear(), db.billLines.clear(), db.tenders.clear(), db.drawers.clear(), db.outbox.clear()]);
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
  await db.tabs.bulkPut(rows.tabs.filter((t) => !held.has(t.id)) as AnyRows);
  await db.seats.bulkPut(rows.seats.filter(keep) as AnyRows);
  await db.orders.bulkPut(rows.orders.filter(keep) as AnyRows);
  await db.lines.bulkPut(rows.lines.filter(keep) as AnyRows);
  await db.lineModifiers.bulkPut(rows.lineModifiers.filter((m) => !held.has(lineTab.get(m.orderLineId) ?? '')) as AnyRows);
  await db.bills.bulkPut(rows.bills as AnyRows);
  await db.billLines.bulkPut(rows.billLines as AnyRows);
  await db.tenders.bulkPut(rows.tenders as AnyRows);
  await db.drawers.bulkPut(rows.drawers as AnyRows);
}

async function applyPull(body: PullBody) {
  const db = posDb();
  const changed: string[] = [];
  const knownEpoch = await getMeta<string>(META.epoch);
  const reset = Boolean(knownEpoch && knownEpoch !== body.epoch);

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
      if (body.devices) await db.devices.bulkPut(body.devices as AnyRows);
      await setMeta(META.catalogueVersion, body.catalogueVersion);
    }
    if (body.availability) {
      const previous = new Map<string, AvailabilityState>((await db.availability.toArray()).map((a) => [a.productVariantId, a.state]));
      for (const entry of body.availability) {
        const before = previous.get(entry.productVariantId);
        if (before && before !== 'finished' && entry.state === 'finished') {
          const variant = await db.variants.get(entry.productVariantId);
          if (variant) changed.push(`${variant.name} is ${entry.reason === 'hold' ? 'on hold' : 'finished'}.`);
        }
      }
      await db.availability.bulkPut(body.availability);
      await setMeta(META.availabilityVersion, body.availabilityVersion);
    }
    await applyTrade(body.trade, body.full || reset);
    await setMeta(META.tradeCursor, body.cursor);
    await setMeta(META.bootstrapped, true);
    await setMeta(META.lastPulledAt, Date.now());
  });
  if (changed.length > 0) publish({ announcements: changed.slice(-3) });
}

export async function pull(): Promise<void> {
  const [catalogueVersion, availabilityVersion, cursor, epoch, device] = await Promise.all([
    getMeta<number>(META.catalogueVersion),
    getMeta<number>(META.availabilityVersion),
    getMeta<number>(META.tradeCursor),
    getMeta<string>(META.epoch),
    getMeta<{ id: string }>(META.deviceId),
  ]);
  const query = new URLSearchParams({
    catalogue: String(catalogueVersion ?? -1),
    availability: String(availabilityVersion ?? -1),
    since: String(cursor ?? -1),
    epoch: epoch ?? '',
    device: device?.id ?? '',
  });
  const { body } = await api.get<PullBody>(`/api/dev/sync/pull?${query.toString()}`);
  await applyPull(body);
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
  const db = posDb();
  const pending = await db.outbox.where('status').anyOf('pending', 'inflight').sortBy('seq');
  if (pending.length === 0) return;
  const rejectedAggregates = new Set((await db.outbox.where('status').equals('rejected').toArray()).map((e) => e.aggregateId));
  const batch = pending.filter((e) => !rejectedAggregates.has(e.aggregateId)).slice(0, 50);
  if (batch.length === 0) return;

  await db.outbox.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { status: 'inflight' as const, attempts: e.attempts + 1 } })));
  let results: PushResult[];
  try {
    const { body } = await api.post<{ results: PushResult[] }>('/api/dev/sync/push', { entries: batch });
    results = body.results;
  } catch (error) {
    await db.outbox.bulkUpdate(batch.map((e) => ({ key: e.id, changes: { status: 'pending' as const } })));
    throw error;
  }

  await db.transaction('rw', db.outbox, db.lines, async () => {
    for (const result of results) {
      if (result.status === 'acked') {
        await db.outbox.update(result.id, { status: 'acked', ackedAt: Date.now() });
        for (const lineId of result.stockConflictLineIds ?? []) await db.lines.update(lineId, { stockConflict: true });
      } else {
        await db.outbox.update(result.id, { status: 'rejected', rejectionCode: result.code ?? 'REJECTED', rejectionDetail: result.detail });
      }
    }
  });
  await setMeta(META.lastPushedAt, Date.now());
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
    } catch (error) {
      if (!(error instanceof NetworkUnavailable)) console.error('[sync]', error);
      failures += 1;
      backoffUntil = Date.now() + Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
      const db = posDb();
      const held = await db.outbox.where('status').anyOf('pending', 'inflight').count();
      await recount(held > 0 ? 'offline' : 'unreachable');
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

export function forcedOfflineLabel() {
  return isForcedOffline();
}

/** Clear acknowledged entries after the 72 hour safety window. docs/02 section 11. */
export async function pruneAcked(): Promise<void> {
  const cutoff = Date.now() - 72 * 3_600_000;
  const db = posDb();
  const old = await db.outbox.where('status').equals('acked').filter((e) => (e.ackedAt ?? 0) < cutoff).primaryKeys();
  // The outbox is device transport, not a record: acknowledged entries leave once the server holds them.
  await db.outbox.bulkDelete(old);
}
