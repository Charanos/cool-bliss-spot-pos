import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Bliss',
  description: 'Point of sale and stock control for Cool Bliss Spot.',
};

export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-KE" data-theme="dark" className={fontVariables}>
      <body className="min-h-dvh bg-page text-ink antialiased">{children}</body>
    </html>
  );
}
