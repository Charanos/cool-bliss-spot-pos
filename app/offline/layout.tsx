import { colour } from '@bliss/ui/tokens';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Offline · Bliss',
  robots: 'noindex',
};

export const viewport: Viewport = {
  themeColor: colour.frost[950],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function OfflineRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" data-theme="dark" className={fontVariables}>
      <body className="min-h-dvh overflow-hidden bg-page text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
