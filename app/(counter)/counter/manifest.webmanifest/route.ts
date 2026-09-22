import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/**
 * The Counter installs as its own app, on a tablet or a desktop at the counter. ADR-004.
 * Same reasoning as the Floor's manifest: no orientation lock, origin scope, its own id.
 */
export function GET() {
  return Response.json(
    {
      id: '/counter',
      name: 'Bliss Counter',
      short_name: 'Counter',
      description: 'Pour, settle and close the drawer at Cool Bliss Spot.',
      start_url: '/counter/orders',
      scope: '/',
      display: 'standalone',
      background_color: colour.frost[950],
      theme_color: colour.frost[950],
      icons: [
        { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/counter/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
