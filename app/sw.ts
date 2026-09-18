import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from 'serwist';

// Declare the Serwist global scope so TypeScript knows about __SW_MANIFEST.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  // Precache the entire Next.js build output (JS, CSS, static files).
  precacheEntries: self.__SW_MANIFEST,

  // Activate and take control of all clients immediately, without waiting for old SW to unload.
  skipWaiting: true,
  clientsClaim: true,

  // Navigation preload: fetch navigation requests in parallel with SW boot for speed.
  navigationPreload: true,

  // When offline, serve our branded offline page for any navigation request.
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },

  runtimeCaching: [
    // App shell pages (Floor, Counter) — NetworkFirst with 7d cache.
    // Serves the cached shell instantly when offline.
    {
      matcher: ({ request, url }) =>
        request.destination === 'document' &&
        (url.pathname.startsWith('/floor') || url.pathname.startsWith('/counter')),
      handler: new NetworkFirst({
        cacheName: 'bliss-pages',
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },

    // Static assets (fonts, icons, images) — CacheFirst, 1 year.
    {
      matcher: ({ request }) =>
        request.destination === 'font' ||
        request.destination === 'image' ||
        request.destination === 'style',
      handler: new CacheFirst({
        cacheName: 'bliss-static',
        plugins: [
          new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
      }),
    },

    // Scripts — StaleWhileRevalidate: use cache, update in background.
    {
      matcher: ({ request }) => request.destination === 'script',
      handler: new StaleWhileRevalidate({
        cacheName: 'bliss-scripts',
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },

    // API routes — NetworkFirst, short TTL; never serve stale data silently.
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'bliss-api',
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 })],
        networkTimeoutSeconds: 5,
      }),
    },

    // Everything else from the default Serwist cache strategy.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
