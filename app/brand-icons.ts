import type { Metadata } from 'next';

/**
 * The Cool Bliss glass in the browser tab and on a home screen, the same on every surface: the
 * Console, the stations, the entry page, printed tickets and the offline page. iOS reads `apple`
 * and has never taken SVG there; the PNG comes from app/icon/[spec].
 */
export const BRAND_ICONS: NonNullable<Metadata['icons']> = {
  apple: '/icon/192',
  icon: [
    { url: '/icon/192', type: 'image/png', sizes: '192x192' },
    { url: '/brand/mark-on-dark.svg', type: 'image/svg+xml' },
  ],
};
