import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';
import { cx } from '@bliss/ui/lib/cx';
import { BRAND_ICONS } from '@/app/brand-icons';
import { fontVariables } from '../fonts';

export const metadata: Metadata = {
  icons: BRAND_ICONS,
  title: 'Print',
};

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    // The app's own fonts, which the tickets are set in. Without them a ticket prints in whatever the
    // computer has (Arial on Windows), which has only regular and bold: every print weight snaps to bold.
    <html lang="en" data-theme="light" className={fontVariables}>
      <body className={cx('bg-paper text-paper-ink antialiased min-h-screen')} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
