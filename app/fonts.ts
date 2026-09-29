import { GeistSans } from 'geist/font/sans';
import { JetBrains_Mono } from 'next/font/google';

/**
 * Geist Sans for everything. JetBrains Mono, tabular figures, for every number on a screen, at 400 and
 * 500 only. Printed tickets are Geist alone, figures included, at the print weights Geist carries.
 */
export const sans = GeistSans;

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  // Prevents CLS: Next.js generates a matching fallback metric from system-ui so the
  // layout doesn't shift when the custom mono font loads.
  adjustFontFallback: false,
  preload: true,
});

export const fontVariables = `${sans.variable} ${mono.variable}`;

