import { colour } from '@bliss/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SWRegister } from '../_components/sw-register';
import { fontVariables } from '../fonts';
import '../globals.css';

/**
 * The landing page is where the installed app opens (app/manifest.webmanifest), so it carries the
 * same install metadata and service worker as the surfaces it leads to.
 */
export const metadata: Metadata = {
  title: 'Bliss',
  description: 'Point of sale and stock control for Cool Bliss Spot.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Bliss',
  appleWebApp: { capable: true, title: 'Bliss', statusBarStyle: 'black-translucent' },
  icons: {
    // iOS reads this one and has never supported SVG here.
    apple: '/icon/192',
    icon: [{ url: '/icon/192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: colour.frost[950],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" data-theme="dark" className={fontVariables}>
      <body className="min-h-dvh bg-page text-ink antialiased" suppressHydrationWarning>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
