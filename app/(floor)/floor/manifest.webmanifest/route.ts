import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/**
 * The Floor installs as its own PWA. ADR-004, docs/16-responsive-and-offline.md.
 *
 * `orientation` is deliberately absent: a waiter holds a phone upright and a tablet on its side,
 * and the layout answers to both. Locking it to landscape would leave half the devices letterboxed.
 *
 * The scope is the whole origin rather than /floor, so the surface switcher in the top bar opens the
 * Counter inside the installed app instead of kicking the waiter out to a browser tab. `id` is what
 * keeps this install distinct from the Counter's.
 */
export function GET() {
  return Response.json(
    {
      id: '/floor',
      name: 'Bliss Floor',
      short_name: 'Floor',
      description: 'Take orders by seat at Cool Bliss Spot.',
      start_url: '/floor/tabs',
      scope: '/',
      display: 'standalone',
      background_color: colour.frost[950],
      theme_color: colour.frost[950],
      icons: [
        { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/floor/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
