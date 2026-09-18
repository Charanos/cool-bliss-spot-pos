import { colour } from '@bliss/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SWRegister } from '../_components/sw-register';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Bliss Counter',
  description: 'Pour, settle and close the drawer at Cool Bliss Spot.',
  manifest: '/counter/manifest.webmanifest',
  applicationName: 'Bliss Counter',
  appleWebApp: { capable: true, title: 'Bliss Counter', statusBarStyle: 'black-translucent' },
  icons: {
    apple: '/counter/icon.svg',
  },
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
    <html lang="en-KE" data-theme="dark" data-surface="counter" className={fontVariables}>
      <body className="min-h-dvh overflow-hidden bg-page text-ink antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
