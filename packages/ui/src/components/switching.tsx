'use client';

import { useEffect, useState } from 'react';
import { BlissMark } from './brand';
import { Spinner } from './spinner';

/**
 * The screen between surfaces: the Console to a station, or one station to another. A station loads
 * its menu and team on arrival, which can take a few seconds on a first visit, so the click is
 * answered at once and the whole screen says where it is going. Nothing behind it can be tapped
 * twice. After a long wait it offers the target's own sign-in, in case the network dropped.
 */
export function SwitchingScreen({ to, name, fallback, surface = 'dark' }: { to: string; name?: string; fallback?: string; surface?: 'dark' | 'light' }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-toast flex flex-col items-center justify-center gap-24 bg-page/95 px-24 text-center backdrop-blur-glass">
      <BlissMark size={64} surface={surface} className="animate-breathe" />
      <div className="flex flex-col items-center gap-8">
        <p className="flex items-center gap-12 text-title font-medium text-ink">
          <Spinner size={20} />
          Opening the {to}
        </p>
        <p className="measure text-body text-ink-muted">{name ? `Signing you in as ${name}. ` : ''}The first visit on a device takes a few seconds while it loads the menu.</p>
      </div>
      {slow && fallback ? (
        <a href={fallback} className="text-body-sm text-accent-text underline underline-offset-4">
          Taking a while? Open its sign-in instead
        </a>
      ) : null}
    </div>
  );
}
