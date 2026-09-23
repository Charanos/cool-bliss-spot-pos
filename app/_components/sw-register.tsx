'use client';

import { useEffect } from 'react';

const RECOVERED = 'bliss:recovered-at';

/** A page from an older build asking for code the server no longer has. */
export function isStaleBuildError(reason: unknown): boolean {
  const text = reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason ?? '');
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text);
}

/**
 * Recover from a stale build: drop the cached pages, let a waiting worker take over, and load the
 * current build once. Guarded so a real outage cannot turn into a reload loop.
 */
export async function recoverFromStaleBuild(): Promise<void> {
  try {
    const last = Number(sessionStorage.getItem(RECOVERED) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RECOVERED, String(Date.now()));
  } catch {
    // Storage blocked: recover anyway, once per page life.
  }
  try {
    if ('caches' in window) await caches.delete('bliss-pages');
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.waiting?.postMessage({ type: 'bliss:apply-update' });
  } finally {
    window.location.reload();
  }
}

/**
 * Registers the Serwist service worker, in every root layout, so the installed app works offline
 * from its first launch; and watches for a stale build, which it heals rather than letting the app
 * fall over. docs/16 section 4.
 */
export function SWRegister() {
  useEffect(() => {
    // Only a production build has a worker to register; see lib/pos/updates.ts.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration failing is not fatal; the app still works online.
      });
    }
    const onError = (event: ErrorEvent) => {
      if (isStaleBuildError(event.error ?? event.message)) void recoverFromStaleBuild();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleBuildError(event.reason)) void recoverFromStaleBuild();
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
