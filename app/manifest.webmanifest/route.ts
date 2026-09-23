import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/**
 * Bliss installs as one app. ADR-004, docs/16-responsive-and-offline.md.
 *
 * It opens where the browser does, on the landing page, and the person picks Floor or Counter
 * there, as on a desktop; the surface switcher moves between them inside the app. One app rather
 * than two keeps a tablet that serves both roles to one icon, one sign-in and one service worker.
 *
 * `orientation` is deliberately absent: a phone is held upright and a tablet on its side, and the
 * layout answers to both.
 */
export function GET() {
  return Response.json(
    {
      id: '/',
      name: 'Bliss · Cool Bliss Spot',
      short_name: 'Bliss',
      description: 'Take orders by the seat, pour, settle and close the drawer at Cool Bliss Spot.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: colour.frost[950],
      theme_color: colour.frost[950],
      icons: [
        { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
