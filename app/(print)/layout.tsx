import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';
import { cx } from '@bliss/ui/lib/cx';
import { BRAND_ICONS } from '@/app/brand-icons';

export const metadata: Metadata = {
  icons: BRAND_ICONS,
  title: 'Print',
};

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      {/* 
        For thermal printing, we want absolutely no background colors from the browser body,
        no margins, and we want to enforce a very clean slate. 
      */}
      <body className={cx('bg-paper text-paper-ink antialiased min-h-screen')} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
