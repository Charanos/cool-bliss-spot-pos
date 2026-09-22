'use client';

import { Button } from '@bliss/ui/components/button';
import { Dot } from '@bliss/ui/components/status';
import { useEffect, useState } from 'react';

/**
 * The page the service worker falls back to when a navigation has no network and no cached copy.
 * docs/16-responsive-and-offline.md.
 *
 * It is deliberately plain: it runs with no data, no session and no sync cycle, so it promises
 * nothing about orders it cannot see. What it does do is notice the network coming back, because a
 * waiter standing in a dead spot should not have to guess when to try again.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <main className="safe-x flex min-h-dvh flex-col items-center justify-center gap-24 text-center [--bliss-gutter-x:24px]">
      <span className="animate-breathe flex size-avatar items-center justify-center rounded-dot border border-rule-raised bg-raised">
        <Dot tone={online ? 'poured' : 'low'} />
      </span>

      <div className="flex flex-col gap-8">
        <h1 className="text-title font-medium text-ink">{online ? 'The network is back' : 'This device is offline'}</h1>
        <p className="max-w-[38ch] text-body text-ink-muted">
          {online
            ? 'Open Bliss again and it will pick up where the tablet left off.'
            : 'Bliss could not be opened from this device. Tabs and orders already on it are kept and will send once the network returns.'}
        </p>
      </div>

      <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </main>
  );
}
