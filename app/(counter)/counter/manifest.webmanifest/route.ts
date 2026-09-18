import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/** The Counter installs as its own app, on a tablet or a desktop at the counter. ADR-004. */
export function GET() {
  return Response.json(
    {
      name: 'Bliss Counter',
      short_name: 'Counter',
      description: 'Pour, settle and close the drawer at Cool Bliss Spot.',
      start_url: '/counter/orders',
      scope: '/counter/',
      display: 'standalone',
      background_color: colour.frost[950],
      theme_color: colour.frost[950],
      icons: [{ src: '/counter/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
