import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/** The Floor installs as its own PWA with its own manifest. ADR-004. */
export function GET() {
  return Response.json(
    {
      name: 'Bliss Floor',
      short_name: 'Floor',
      description: 'Take orders by seat at Cool Bliss Spot.',
      start_url: '/floor/tabs',
      scope: '/floor/',
      display: 'standalone',
      orientation: 'landscape',
      background_color: colour.frost[950],
      theme_color: colour.frost[950],
      icons: [{ src: '/floor/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
