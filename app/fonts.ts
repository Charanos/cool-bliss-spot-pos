import { GeistSans } from 'geist/font/sans';
import { JetBrains_Mono } from 'next/font/google';

/** Geist Sans for everything. JetBrains Mono, tabular figures, for every number. Weights 400 and 500 only. */
export const sans = GeistSans;

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const fontVariables = `${sans.variable} ${mono.variable}`;
