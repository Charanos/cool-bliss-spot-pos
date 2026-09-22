'use client';

import { useSyncExternalStore } from 'react';
import { posDb } from './db';

/**
 * Builds arrive, waiters keep working. docs/16-responsive-and-offline.md.
 *
 * The service worker never activates a new build on its own, because the running page holds
 * references to chunks the new build has renamed: taking over mid-order turns the next tap into a
 * failed import. So a new build sits in `waiting`, this reports it, and the shell offers it at a
 * moment that costs nothing.
 *
 * Restarting is refused while the outbox still holds anything: those entries are safe in Dexie and
 * would survive a reload, but a waiter who sees "restarting" while an order is unsent should not
 * have to take our word for it.
 */

export interface UpdateState {
  /** A new build is installed and waiting for this tab to let it in. */
  ready: boolean;
  /** Applying now, waiting for the worker to take over. */
  applying: boolean;
}

let state: UpdateState = { ready: false, applying: false };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | null = null;
let reloading = false;

function publish(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function watch(reg: ServiceWorkerRegistration) {
  registration = reg;
  if (reg.waiting && navigator.serviceWorker.controller) publish({ ready: true });
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // A worker that installs with no controller is the first one: it is this build, not a new one.
      if (installing.state === 'installed' && navigator.serviceWorker.controller) publish({ ready: true });
    });
  });
}

/** Registers the worker and keeps an eye on what it is doing. Safe to call more than once. */
export function startUpdates(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  // Development builds no worker (Serwist is disabled there), and public/sw.js may be a stale one
  // left by an earlier production build. Registering that would serve yesterday's app to today's code.
  // One already registered by an earlier visit is taken away for the same reason.
  if (process.env.NODE_ENV !== 'production') {
    void navigator.serviceWorker
      .getRegistrations()
      .then((all) => Promise.all(all.map((r) => r.unregister())))
      .catch(() => {});
    return () => {};
  }

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(watch)
    .catch(() => {
      // A tablet with the worker blocked still trades: everything it needs is already in Dexie.
    });

  const onControllerChange = () => {
    if (!reloading) return;
    reloading = false;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  // A shift is long. Ask the browser to look for a new build once an hour, and whenever the app
  // comes back to the foreground, rather than only at a cold start.
  const check = () => void registration?.update().catch(() => {});
  const hourly = setInterval(check, 60 * 60 * 1000);
  window.addEventListener('focus', check);

  return () => {
    clearInterval(hourly);
    window.removeEventListener('focus', check);
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

export type ApplyResult = { ok: true } | { ok: false; message: string };

/** Let the waiting build in, then reload once it has taken over. */
export async function applyUpdate(): Promise<ApplyResult> {
  const unsent = await posDb().outbox.where('status').anyOf('pending', 'inflight').count();
  if (unsent > 0) {
    return { ok: false, message: `This tablet still has ${unsent === 1 ? 'a change' : `${unsent} changes`} to send. Restart once it says synced.` };
  }
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return { ok: true };
  }
  reloading = true;
  publish({ applying: true });
  waiting.postMessage({ type: 'bliss:apply-update' });
  return { ok: true };
}

export function useAppUpdate(): UpdateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
