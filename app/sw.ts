import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

// Declare the Serwist global scope so TypeScript knows about __SW_MANIFEST.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

// The Serwist webpack plugin requires the string 'self.__SW_MANIFEST' to be present.
// We assign it to an ignored variable so it compiles, but we don't actually use it for precaching.
const _ignoredManifest = self.__SW_MANIFEST;

const serwist = new Serwist({
  // We explicitly pass an empty array to ensure no stale offline bundles are precached
  precacheEntries: [],
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
