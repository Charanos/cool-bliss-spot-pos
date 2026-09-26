import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'Bliss Console', template: '%s · Bliss Console' },
  description: 'Catalogue, stock, purchasing, people and reporting for Cool Bliss Spot.',
};

const THEME_COOKIE = 'bliss-console-theme';

/**
 * The Console is its own root layout: light by default, dark available, both first class, or the
 * device's own choice (System). docs/06-design-system.md section 4, Theme by surface. The theme is
 * set on <html> from the cookie, so the first paint is already in it.
 */
export default async function ConsoleRootLayout({ children }: { children: ReactNode }) {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = raw === 'dark' || raw === 'system' ? raw : 'light';
  return (
    <html lang="en-KE" data-theme={theme} data-surface="console" className={fontVariables}>
      <body className="min-h-dvh bg-page text-ink antialiased">{children}</body>
    </html>
  );
}
