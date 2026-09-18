import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

// Declare the Serwist global scope so TypeScript knows about __SW_MANIFEST.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  // We omit precacheEntries to ensure the app functions exclusively online
  // and does not load stale offline bundles.
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: () => true,
      handler: new NetworkOnly(),
    },
  ],
});

serwist.addEventListeners();
