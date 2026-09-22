'use client';

import type { HistoryResult } from '@bliss/shared/trade';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkUnavailable, api } from './api';
import { META, getMeta, posDb, setMeta } from './db';
import { useSync } from './sync';

/**
 * The history screens' read. docs/16 section 9.
 *
 * History is the server's record, not this device's: a tab cleared on another tablet, a bill
 * settled at the other till, last month's nights. So it is fetched, not read from the local store,
 * and each answer is kept on the device so the screen still opens, marked as saved, when the
 * network is down.
 *
 * A range that includes tonight follows the night: each time the device syncs, the record is read
 * again, at most every fifteen seconds.
 */

export interface HistoryParams {
  from: string;
  to: string;
  /** Only tabs this person opened or looks after. */
  staffId?: string | null;
  /** Only what was settled on this device. */
  thisDevice?: boolean;
  q?: string;
}

export type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; data: HistoryResult; fetchedAt: number; refreshing: boolean }
  | { status: 'saved'; data: HistoryResult; fetchedAt: number; refreshing: boolean }
  | { status: 'unavailable'; message: string };

interface Cached {
  fetchedAt: number;
  data: HistoryResult;
}

const INDEX = 'history.index';
const KEEP = 12;
const FOLLOW_MS = 15_000;

function cacheKey(p: HistoryParams): string {
  return `history:${p.from}:${p.to}:${p.staffId ?? ''}:${p.thisDevice ? 'd' : ''}:${(p.q ?? '').trim().toLowerCase()}`;
}

/** Keep the last dozen answers, oldest dropped first, so the store never grows without end. */
async function remember(key: string, value: Cached) {
  const db = posDb();
  await db.transaction('rw', db.meta, async () => {
    const index = ((await getMeta<string[]>(INDEX)) ?? []).filter((k) => k !== key);
    index.push(key);
    const drop = index.splice(0, Math.max(0, index.length - KEEP));
    if (drop.length > 0) await db.meta.bulkDelete(drop);
    await setMeta(INDEX, index);
    await setMeta(key, value);
  });
}

async function fetchHistory(p: HistoryParams): Promise<HistoryResult> {
  const device = await getMeta<{ id: string }>(META.deviceId);
  const search = new URLSearchParams({ from: p.from, to: p.to });
  if (device?.id) search.set('device', device.id);
  if (p.staffId) search.set('staff', p.staffId);
  if (p.thisDevice && device?.id) search.set('only', device.id);
  if (p.q?.trim()) search.set('q', p.q.trim());
  const { status, body } = await api.get<({ ok: true } & HistoryResult) | { ok: false; message: string }>(`/api/dev/history?${search}`);
  if (!body || !body.ok) throw new Error(body && !body.ok ? body.message : `History answered ${status}.`);
  return body;
}

export function useHistory(params: HistoryParams | null): { state: HistoryState; refresh: () => void } {
  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const { lastSyncedAt } = useSync();
  const lastRead = useRef(0);
  const key = params ? cacheKey(params) : null;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const followsTonight = Boolean(params && state.status !== 'loading' && state.status !== 'unavailable' && params.to >= state.data.currentBusinessDate);

  // Show what is saved at once, then read the server.
  useEffect(() => {
    if (!key) return;
    let live = true;
    void (async () => {
      const cached = await getMeta<Cached>(key);
      if (!live) return;
      setState(cached ? { status: 'saved', data: cached.data, fetchedAt: cached.fetchedAt, refreshing: true } : { status: 'loading' });
    })();
    return () => {
      live = false;
    };
  }, [key]);

  useEffect(() => {
    const p = paramsRef.current;
    if (!key || !p) return;
    let live = true;
    // A search waits for the typing to stop; everything else reads at once.
    const wait = p.q?.trim() ? 280 : 0;
    const timer = window.setTimeout(async () => {
      setState((s) => (s.status === 'ready' || s.status === 'saved' ? { ...s, refreshing: true } : s));
      try {
        const data = await fetchHistory(p);
        lastRead.current = Date.now();
        const fetchedAt = Date.now();
        await remember(key, { data, fetchedAt });
        if (live) setState({ status: 'ready', data, fetchedAt, refreshing: false });
      } catch (e) {
        if (!live) return;
        const cached = await getMeta<Cached>(key);
        if (!live) return;
        if (cached) setState({ status: 'saved', data: cached.data, fetchedAt: cached.fetchedAt, refreshing: false });
        else
          setState({
            status: 'unavailable',
            message: e instanceof NetworkUnavailable ? 'This device is offline, and this range has not been opened here before. It loads the moment the network is back.' : e instanceof Error ? e.message : 'History did not load.',
          });
      }
    }, wait);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key, nonce]);

  // Tonight moves: read again after each sync, no more than every fifteen seconds.
  useEffect(() => {
    if (!followsTonight || !lastSyncedAt) return;
    if (Date.now() - lastRead.current < FOLLOW_MS) return;
    setNonce((n) => n + 1);
  }, [followsTonight, lastSyncedAt]);

  // Back from the background, or back online: read again.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRead.current > FOLLOW_MS) setNonce((n) => n + 1);
    };
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { state, refresh };
}

/** Tonight's business date as this device knows it, for the range presets before the first answer. */
export async function localBusinessDate(): Promise<string | undefined> {
  return getMeta<string>(META.businessDate);
}
