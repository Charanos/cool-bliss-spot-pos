import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbModule from './db';
import type * as SyncModule from './sync';

/**
 * The device's side of sync, on a real IndexedDB (fake-indexeddb) with the network stubbed. What
 * the Counter lagged on: server rows held back for a tab with unsent work were lost when the cursor
 * moved past them, one refused change held its tab for good, and a refused settle stayed on screen.
 */

// A browser, as far as the device store needs one.
const listeners: Record<string, () => void> = {};
Object.assign(globalThis, {
  window: Object.assign(globalThis, { addEventListener: (k: string, f: () => void) => (listeners[k] = f), removeEventListener: () => {} }),
  document: { documentElement: { dataset: { surface: 'counter' } }, addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
});

const calls: { method: string; path: string; json?: unknown }[] = [];
let nextPull: unknown = null;
let nextPush: { results: { id: string; status: 'acked' | 'rejected'; code?: string }[] } = { results: [] };

vi.mock('./api', () => ({
  NetworkUnavailable: class extends Error {},
  SignInRequired: class extends Error {},
  isForcedOffline: () => false,
  api: {
    get: async (path: string) => {
      calls.push({ method: 'GET', path });
      return { status: 200, body: nextPull };
    },
    post: async (path: string, json: unknown) => {
      calls.push({ method: 'POST', path, json });
      return { status: 200, body: nextPush };
    },
  },
}));
vi.mock('@bliss/ui/components/notices', () => ({ notify: () => {} }));
vi.mock('./haptics', () => ({ haptic: () => {} }));
vi.mock('./display', () => ({ activeDisplay: () => 'standard' }));
vi.mock('./device-caps', () => ({ readCaps: () => ({}), capsForServer: () => '' }));

let sync: typeof SyncModule;
let db: typeof DbModule;

const empty = (): Record<'tabs' | 'seats' | 'orders' | 'lines' | 'lineModifiers' | 'bills' | 'billLines' | 'tenders' | 'drawers', unknown[]> => ({ tabs: [], seats: [], orders: [], lines: [], lineModifiers: [], bills: [], billLines: [], tenders: [], drawers: [] });
const pullBody = (trade: Partial<ReturnType<typeof empty>>, cursor: number) => ({ epoch: 'e1', outlet: { id: 'o', timezone: 'Africa/Nairobi', cutover: '06:00' }, businessDate: '2026-09-28', cursor, full: false, trade: { ...empty(), ...trade } });
const tab = (id: string, patch: Record<string, unknown> = {}) => ({ id, outletId: 'o', businessDate: '2026-09-28', serviceTableId: 't1', zoneId: 'z', tabNumber: 1, name: null, guestCount: 2, openedBy: 's', openedAt: 1, assignedTo: 's', status: 'open', mergedIntoTabId: null, closedAt: null, ...patch });

async function queue(id: string, seq: number, kind: string, aggregateId: string, payload: Record<string, unknown> = {}) {
  await db.posDb().outbox.add({ id, seq, deviceId: 'd', staffId: 's', kind, aggregateId, payload, clientAt: Date.now(), attempts: 0, status: 'pending' } as never);
}

beforeAll(async () => {
  db = await import('./db');
  sync = await import('./sync');
});

beforeEach(async () => {
  calls.length = 0;
  const d = db.posDb();
  await Promise.all(d.tables.map((t) => t.clear()));
  await db.setMeta(db.META.epoch, 'e1');
  await db.setMeta(db.META.stationToken, 'token');
  await db.setMeta(db.META.deviceId, { id: 'd' });
});

describe('device sync', () => {
  it('asks again for a tab whose server rows it held back, once its own change has landed', async () => {
    await db.posDb().tabs.put(tab('tab-a') as never);
    await queue('e1', 1, 'line.serve', 'tab-a');

    // The Floor asked for the bill while the Counter's pour was unsent: held back, not applied.
    nextPull = pullBody({ tabs: [tab('tab-a', { billAskedAt: 99 })] }, 10);
    await sync.pull();
    expect((await db.posDb().tabs.get('tab-a'))?.billAskedAt).toBeUndefined();
    expect(await db.getMeta(db.META.refetchTabs)).toEqual(['tab-a']);

    // While the pour is still unsent, the tab is not asked for yet.
    nextPull = pullBody({}, 11);
    await sync.pull();
    expect(calls.at(-1)!.path).not.toContain('refetch=');

    // The pour lands; the next pull asks for the tab whole and gets the bill request.
    nextPush = { results: [{ id: 'e1', status: 'acked' }] };
    await sync.drain();
    nextPull = pullBody({ tabs: [tab('tab-a', { billAskedAt: 99 })] }, 12);
    await sync.pull();
    expect(calls.at(-1)!.path).toContain('refetch=tab-a');
    expect((await db.posDb().tabs.get('tab-a'))?.billAskedAt).toBe(99);
    expect(await db.getMeta(db.META.refetchTabs)).toEqual([]);
  });

  it('takes a refused settle off the device, refuses what was queued behind it, and lets later work send', async () => {
    const d = db.posDb();
    await d.tabs.put(tab('tab-b', { status: 'settled' }) as never);
    await d.bills.put({ id: 'bill-1', tabId: 'tab-b', businessDate: '2026-09-28', deviceId: 'd', settledAt: 1 } as never);
    await d.billLines.put({ id: 'bl-1', billId: 'bill-1', orderLineId: 'l1' } as never);
    await d.tenders.put({ id: 'tn-1', billId: 'bill-1' } as never);
    await queue('s1', 1, 'bill.settle', 'tab-b', { billId: 'bill-1' });
    await queue('s2', 2, 'tab.clear', 'tab-b');

    nextPush = { results: [{ id: 's1', status: 'rejected', code: 'TENDER_MISMATCH' }] };
    await sync.drain();
    // Only the settle went: the batch is everything pending, and the clear behind it is refused with it.
    expect(await d.bills.get('bill-1')).toBeUndefined();
    expect(await d.billLines.count()).toBe(0);
    expect(await d.tenders.count()).toBe(0);
    expect((await d.outbox.get('s2'))?.status).toBe('rejected');
    expect((await d.outbox.get('s2'))?.rejectionCode).toBe('BLOCKED');
    expect(await db.getMeta(db.META.refetchTabs)).toEqual(['tab-b']);

    // Work done on the tab afterwards is not held behind the refusal.
    await queue('s3', 3, 'bill.settle', 'tab-b', { billId: 'bill-2' });
    nextPush = { results: [{ id: 's3', status: 'acked' }] };
    await sync.drain();
    const sent = calls.filter((c) => c.path === '/api/station/sync/push').at(-1)!.json as { entries: { id: string }[] };
    expect(sent.entries.map((e) => e.id)).toEqual(['s3']);
    expect((await d.outbox.get('s3'))?.status).toBe('acked');
  });
});
