'use client';

import { useSyncExternalStore } from 'react';
import { posDb } from './db';

/**
 * Builds arrive, waiters keep working. docs/16-responsive-and-offline.md section 5.
 *
 * The service worker never activates a new build on its own, because the running page holds
 * references to chunks the new build has renamed: taking over mid-order turns the next tap into a
 * failed import. So a new build waits, and this module lets it in at a moment that costs nobody an
 * order. It used to wait for a tap on "Restart now", and a tablet whose bar was put off, or that was
 * never looked at, stayed on an old build for days. Now:
 *
 *  - Every pull carries the server's build. A page on another build knows at once, without waiting
 *    for the browser to notice a new worker (noteServerBuild).
 *  - The browser is asked to look for the new worker whenever the app comes back to the screen, when
 *    the network returns, and every fifteen minutes. An iPad app opened from the Home Screen does not
 *    reliably fire focus on resume; visibilitychange and pageshow it does.
 *  - The new build goes in by itself at a free moment: on a sign-in screen at once, and elsewhere when
 *    nothing waits to send, no sheet or dialog is open, nobody is inside a tab or a sale, and the screen
 *    has been left alone for a minute and a half, or has just come back after a while away.
 *  - A restart that did not take is tried again later and later (three minutes, ten, thirty, then
 *    hourly), so a server that answers with an older page cannot put the tablet in a loop.
 */

export interface UpdateState {
  /** A newer build is out: installed and waiting, or known from the server and on its way. */
  ready: boolean;
  /** Applying now, waiting for the new build to take over. */
  applying: boolean;
  /** Put off from the bar until then; the free-moment restart still happens. */
  snoozedUntil: number;
}

/** This page's own build, stamped by next.config.ts. Empty in development. */
export const OWN_BUILD = process.env.NEXT_PUBLIC_BLISS_BUILD ?? '';

const IDLE_MS = 90_000;
const AWAY_MS = 30_000;
const CHECK_EVERY_MS = 15 * 60_000;
const RETRY_AFTER_MS = 3 * 60_000;
const TRIED = 'bliss:update-tried';

let state: UpdateState = { ready: false, applying: false, snoozedUntil: 0 };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | null = null;
let serverBuild: string | null = null;
let waitingWorker = false;
let reloading = false;
let lastInput = Date.now();

function publish(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function refreshReady() {
  const behind = Boolean(OWN_BUILD && serverBuild && serverBuild !== OWN_BUILD);
  const ready = waitingWorker || behind;
  if (ready !== state.ready) publish({ ready });
}

/** The server's build, from each pull. Another one than ours: a newer build is out. */
export function noteServerBuild(build: string) {
  if (process.env.NODE_ENV !== 'production' || !build || build === serverBuild) return;
  serverBuild = build;
  refreshReady();
  if (build !== OWN_BUILD) {
    check();
    void maybeApply('server');
  }
}

function watch(reg: ServiceWorkerRegistration) {
  registration = reg;
  const found = () => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = true;
      refreshReady();
    }
  };
  found();
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // A worker that installs with no controller is the first one: it is this build, not a new one.
      if (installing.state === 'installed') found();
    });
  });
}

function check() {
  void registration?.update().catch(() => {});
}

/** Why now is not a free moment, or null when it is. */
function busy(): string | null {
  if (typeof document === 'undefined') return 'no document';
  const path = window.location.pathname;
  if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return 'a sheet is open';
  if (/^\/(floor|counter)\/tabs\/[^/]+/.test(path)) return 'inside a tab';
  if (path.startsWith('/counter/sale')) return 'a sale in progress';
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]')) return 'typing';
  return null;
}

const onSignIn = () => /\/(sign-in|pair)(\/|$)/.test(window.location.pathname);

async function unsent(): Promise<number> {
  return posDb().outbox.where('status').anyOf('pending', 'inflight').count();
}

/**
 * A restart that did not bring the build the server named (offline, mid deploy, a proxy holding an
 * old page) is tried again later and later: three minutes, ten, thirty, then hourly. Never a tablet
 * reloading under nobody every few minutes for a whole night.
 */
const BACKOFF_MS = [RETRY_AFTER_MS, 10 * 60_000, 30 * 60_000, 60 * 60_000];

function readTried(): { build: string; at: number; n: number } | null {
  try {
    const raw = sessionStorage.getItem(TRIED);
    return raw ? (JSON.parse(raw) as { build: string; at: number; n: number }) : null;
  } catch {
    return null;
  }
}

function triedRecently(): boolean {
  const tried = readTried();
  if (!tried || tried.build !== (serverBuild ?? 'worker')) return false;
  return Date.now() - tried.at < BACKOFF_MS[Math.min(tried.n - 1, BACKOFF_MS.length - 1)]!;
}

function noteTried() {
  const target = serverBuild ?? 'worker';
  const tried = readTried();
  const n = tried && tried.build === target ? (tried.n ?? 1) + 1 : 1;
  try {
    sessionStorage.setItem(TRIED, JSON.stringify({ build: target, at: Date.now(), n }));
  } catch {
    // Storage blocked: the back-off is lost for this page, and nothing else.
  }
}

/**
 * Let the new build in if this is a free moment. `returned` is a comeback after a while away, which
 * counts as free without the idle wait: the waiter has just picked the tablet up and has not started.
 */
async function maybeApply(reason: 'server' | 'idle' | 'returned' | 'sign-in'): Promise<void> {
  if (!state.ready || state.applying || reloading) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (triedRecently()) return;
  // A sign-in screen is free once nobody is mid-PIN: a few quiet seconds.
  const free = (onSignIn() && Date.now() - lastInput >= 5000) || ((reason === 'returned' || Date.now() - lastInput >= IDLE_MS) && busy() === null);
  if (!free) return;
  if ((await unsent()) > 0) return;
  await restart();
}

async function restart(): Promise<void> {
  noteTried();
  publish({ applying: true });
  // Look once more, so a worker that finished installing a moment ago is the one that takes over.
  await registration?.update().catch(() => {});
  const waiting = registration?.waiting;
  if (waiting) {
    reloading = true;
    waiting.postMessage({ type: 'bliss:apply-update' });
    // controllerchange reloads; if it never comes (the worker was replaced meanwhile), reload anyway.
    window.setTimeout(() => window.location.reload(), 6000);
    return;
  }
  // No worker to wait for: pages come from the network first, so a reload is the new build.
  window.location.reload();
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

  let hiddenAt = 0;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    check();
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) void maybeApply('returned');
  };
  // A page restored from the back-forward cache, or an iPad app brought back from the switcher.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      check();
      void maybeApply('returned');
    }
  };
  const onOnline = () => check();
  const onInput = () => {
    lastInput = Date.now();
  };
  const tick = setInterval(() => void maybeApply(onSignIn() ? 'sign-in' : 'idle'), 20_000);
  const hourly = setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', check);
  window.addEventListener('pointerdown', onInput, { capture: true, passive: true });
  window.addEventListener('keydown', onInput, { capture: true });

  return () => {
    clearInterval(tick);
    clearInterval(hourly);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', check);
    window.removeEventListener('pointerdown', onInput, { capture: true });
    window.removeEventListener('keydown', onInput, { capture: true });
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

export type ApplyResult = { ok: true } | { ok: false; message: string };

/** Restart into the new build now, from the bar or Settings. Refused while anything waits to send. */
export async function applyUpdate(): Promise<ApplyResult> {
  const count = await unsent();
  if (count > 0) {
    return { ok: false, message: `This tablet still has ${count === 1 ? 'a change' : `${count} changes`} to send. Restart once it says synced.` };
  }
  await restart();
  return { ok: true };
}

/** Put the bar away for twenty minutes. The restart at a free moment still happens. */
export function snoozeUpdate() {
  publish({ snoozedUntil: Date.now() + 20 * 60_000 });
}

/** Ask the browser to look for a new build now, from Settings. */
export async function checkForUpdate(): Promise<'current' | 'ready' | 'offline'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  try {
    await registration?.update();
  } catch {
    return 'offline';
  }
  if (registration?.waiting) {
    waitingWorker = true;
    refreshReady();
  }
  return state.ready ? 'ready' : 'current';
}

/**
 * Start again from the network: drop this device's copy of the app (the worker and its caches) and
 * load it fresh. The orders, tabs and sign-in live in the device's own database, which this does not
 * touch. For a tablet whose app copy has gone wrong, from Settings.
 */
export async function repairAppCopy(): Promise<ApplyResult> {
  const count = await unsent();
  if (count > 0) return { ok: false, message: `This tablet still has ${count === 1 ? 'a change' : `${count} changes`} to send. Repair once it says synced.` };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: 'This tablet is offline. Repair needs the network to load the app again.' };
  try {
    const all = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(all.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } finally {
    window.location.reload();
  }
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

/** Where this device stands against the server, for Settings. */
export function buildStanding(): { own: string; server: string | null } {
  return { own: OWN_BUILD, server: serverBuild };
}
