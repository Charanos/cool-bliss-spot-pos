'use client';

import { useEffect } from 'react';

/**
 * Registers the Serwist service worker on the client.
 * Placed in Floor and Counter root layouts so offline support activates
 * immediately on first load — not deferred to a shell component.
 */
export function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // SW registration failures are non-fatal; the app still operates.
        });
    }
  }, []);

  return null;
}
