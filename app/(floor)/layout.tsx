import { colour } from '@bliss/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SWRegister } from '../_components/sw-register';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Bliss Floor',
  description: 'Take orders by seat at Cool Bliss Spot.',
  manifest: '/floor/manifest.webmanifest',
  applicationName: 'Bliss Floor',
  appleWebApp: { capable: true, title: 'Bliss Floor', statusBarStyle: 'black-translucent' },
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
  // A waiter never pinches the grid. Browser zoom and Android font scaling still apply to text.
  viewportFit: 'cover',
};

/**
 * The Floor is its own root layout: dark only, touch first, client only. docs/06 section 4, Theme by
 * surface: "The room is dim. A white tablet at arm's length is a light source pointed at a customer's face."
 */
export default function FloorRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" data-theme="dark" data-surface="floor" className={fontVariables}>
      <body className="min-h-dvh overflow-hidden bg-page text-ink antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
