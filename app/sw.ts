import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/**
 * The worker's own globals, structurally: this project compiles with the DOM lib, not WebWorker,
 * so the few members used here are named rather than pulled in wholesale.
 */
declare const self: WorkerGlobalScope & {
  skipWaiting(): Promise<void>;
  addEventListener(type: 'message', listener: (event: { data?: unknown }) => void): void;
};

/**
 * The Bliss service worker. docs/16-responsive-and-offline.md.
 *
 * Bliss is local first: the device trades from its own Dexie store and the outbox carries changes to
 * the server. The service worker's job is narrower than it looks. It makes the app itself openable
 * without a network, and it stays out of the way of everything else.
 *
 * Two rules decide every route here:
 *
 *  1. Nothing that talks to the server is ever cached. A cached pull would hand the device rows
 *     from a moment that has passed, on top of the rows it already has, and a cached push response
 *     would tell it an order was accepted that the server never saw. Both are worse than being
 *     offline, which the device already handles. /api is NetworkOnly, deliberately, forever.
 *  2. The shell is cached so a tablet that opens in a dead spot still starts. Pages are network
 *     first with no timeout: a slow connection waits for this build rather than booting an older
 *     cached page whose code the server no longer has, and the last good copy answers only when
 *     the network is actually gone.
 *
 * The worker also never takes over on its own. `skipWaiting` is false: a new build waits until the
 * page asks for it, because swapping the JavaScript under a waiter mid-order is how a POS loses an
 * order to a chunk that no longer exists.
 */

const YEAR = 365 * 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true, concurrency: 10 },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Rule 1. The sync cycle, identity and the drawer: live, or not at all.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    {
      // Hashed build output: the name changes when the content does, so it can be kept.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'bliss-build',
        plugins: [new ExpirationPlugin({ maxEntries: 512, maxAgeSeconds: YEAR, purgeOnQuotaError: true })],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'font',
      handler: new CacheFirst({
        cacheName: 'bliss-fonts',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: YEAR, purgeOnQuotaError: true })],
      }),
    },
    {
      // The menu's photographs and the staff faces. A tile with no photograph still works, so these
      // expire quietly rather than holding a tablet's storage for a product that has left the menu.
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'bliss-images',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && (url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('/icon.svg')),
      handler: new StaleWhileRevalidate({ cacheName: 'bliss-app-meta' }),
    },
    {
      // Rule 2. A page, or the router's own payload for one.
      matcher: ({ request, url, sameOrigin }) => sameOrigin && (request.mode === 'navigate' || url.searchParams.has('_rsc')),
      handler: new NetworkFirst({
        cacheName: 'bliss-pages',
        plugins: [new CacheableResponsePlugin({ statuses: [200] })],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * A waiting build takes over only when a client asks, which the app does at a moment that costs
 * nobody an order: nothing in the outbox, no tab open on screen. See lib/pos/updates.ts.
 */
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'bliss:apply-update') void self.skipWaiting();
});
