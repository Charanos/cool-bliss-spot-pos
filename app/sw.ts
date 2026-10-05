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
  addEventListener(type: 'activate', listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void): void;
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
 *     first, and their copies are kept per build, so a copy never boots against another build's
 *     code. A station page falls back to its copy after four seconds; a Console page, whose figures
 *     are in the page, waits for the network and uses its copy only when the network is gone.
 *
 * The worker also never takes over on its own. `skipWaiting` is false: a new build waits until the
 * page asks for it, because swapping the JavaScript under a waiter mid-order is how a POS loses an
 * order to a chunk that no longer exists.
 */

const YEAR = 365 * 24 * 60 * 60;

/**
 * This worker's build, from the /offline entry next.config.ts stamps with it. Page copies are kept
 * under it, so a copy is only ever served to the build that made it: a page never boots against
 * code from another build, which is what made a network timeout unsafe before.
 */
const MANIFEST = self.__SW_MANIFEST;
const BUILD = (MANIFEST ?? []).map((e) => (typeof e === 'string' ? null : e.url === '/offline' ? e.revision : null)).find(Boolean) ?? 'dev';
const PAGES = `bliss-pages-${BUILD}`;

/** The stations run from their own database; a copy of their page is as good as a fresh one. */
const isStation = (path: string) => path.startsWith('/floor') || path.startsWith('/counter');

const serwist = new Serwist({
  precacheEntries: MANIFEST,
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
      // Rule 2, the stations. Venue Wi-Fi that is connected with no way out holds a request rather
      // than failing it, and a tablet opening in that spot waited a minute for a blank screen. After
      // four seconds this build's own copy of the page answers; the page is drawn from the device's
      // database either way, and the sync cycle catches up once the network does.
      matcher: ({ request, url, sameOrigin }) => sameOrigin && isStation(url.pathname) && (request.mode === 'navigate' || url.searchParams.has('_rsc')),
      handler: new NetworkFirst({
        cacheName: PAGES,
        networkTimeoutSeconds: 4,
        plugins: [new CacheableResponsePlugin({ statuses: [200] })],
      }),
    },
    {
      // Print pages carry live receipt data and must never be served stale. A cached blank or
      // error page replaying through the dialog is exactly the endless-blank-sheet bug.
      matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) => sameOrigin && url.pathname.startsWith('/print/'),
      handler: new NetworkOnly(),
    },
    {
      // Rule 2, the Console. Its pages carry the figures in the page itself, so it waits for the
      // network however long that takes, and a copy answers only when the network is actually gone.
      matcher: ({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) => sameOrigin && (request.mode === 'navigate' || url.searchParams.has('_rsc')),
      handler: new NetworkFirst({
        cacheName: PAGES,
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

/** Once this build is in charge, the page copies of every other build go. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => (k === 'bliss-pages' || k.startsWith('bliss-pages-')) && k !== PAGES).map((k) => caches.delete(k)))),
  );
});

/**
 * A waiting build takes over only when a client asks, which the app does at a moment that costs
 * nobody an order: nothing in the outbox, no tab open on screen. See lib/pos/updates.ts.
 */
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'bliss:apply-update') void self.skipWaiting();
});
