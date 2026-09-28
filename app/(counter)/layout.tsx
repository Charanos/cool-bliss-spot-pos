import { colour } from '@bliss/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SWRegister } from '../_components/sw-register';
import { DISPLAY_BOOT } from '@/lib/pos/display-boot';
import { fontVariables } from '../fonts';
import '../globals.css';
import { BRAND_ICONS } from '@/app/brand-icons';

export const metadata: Metadata = {
  title: 'Bliss Counter',
  description: 'Pour, settle and close the drawer at Cool Bliss Spot.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Bliss',
  appleWebApp: { capable: true, title: 'Bliss', statusBarStyle: 'black-translucent' },
  icons: BRAND_ICONS,
};

export const viewport: Viewport = {
  themeColor: colour.frost[950],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * The Counter is its own root layout: dark, touch first, and the same layout on a tablet or a desktop
 * at the counter. docs/14 section 5. data-surface scopes the device store to the counter.
 */
export default function CounterRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" data-theme="dark" data-surface="counter" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* The device's display profile, before first paint: a Clarity counter never flashes the standard palette. */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOT }} />
      </head>
      <body className="min-h-dvh overflow-hidden bg-page text-ink antialiased" suppressHydrationWarning>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
