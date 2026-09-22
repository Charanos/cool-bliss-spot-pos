'use client';

import { useEffect } from 'react';

/**
 * Registers the Serwist service worker on the client.
 * Placed in Floor and Counter root layouts so offline support activates
 * immediately on first load — not deferred to a shell component.
 */
export function SWRegister() {
  useEffect(() => {
    // Only a production build has a worker to register; see lib/pos/updates.ts.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // SW registration failures are non-fatal; the app still operates.
        });
    }
  }, []);

  return null;
}
