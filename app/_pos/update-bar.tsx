'use client';

import { Button } from '@bliss/ui/components/button';
import { Dot } from '@bliss/ui/components/status';
import { useEffect, useState } from 'react';
import { applyUpdate, snoozeUpdate, useAppUpdate } from '@/lib/pos/updates';

/**
 * A new build is out. It never interrupts: one quiet line under the top bar. The tablet restarts into
 * it by itself at the next free moment (lib/pos/updates.ts), so Later only puts the line away for a
 * while; it does not keep the old build. Restart now always goes: anything waiting to send is kept on
 * the tablet and sends after it. docs/16-responsive-and-offline.md section 5.
 */
export function UpdateBar() {
  const { ready, applying, snoozedUntil } = useAppUpdate();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Wake when a snooze runs out, so the line comes back without a tap.
  useEffect(() => {
    if (snoozedUntil <= now) return undefined;
    const timer = window.setTimeout(() => setNow(Date.now()), snoozedUntil - now + 50);
    return () => window.clearTimeout(timer);
  }, [snoozedUntil, now]);

  if (!ready || (snoozedUntil > now && !applying)) return null;

  return (
    <div role="status" className="safe-x flex shrink-0 flex-wrap items-center gap-8 border-b border-rule-raised/40 bg-raised/80 py-8 backdrop-blur-glass [--bliss-gutter-x:12px] pad:[--bliss-gutter-x:24px]">
      <Dot tone="info" />
      <p className="min-w-0 flex-1 text-body-sm text-ink">
        {error ?? (applying ? 'Restarting into the newer version.' : 'A newer version of Bliss is out. This tablet restarts into it when nobody is using it, or now.')}
      </p>
      <Button
        variant="secondary"
        size="sm"
        loading={applying}
        onClick={() =>
          void applyUpdate().then((result) => {
            if (!result.ok) setError(result.message);
          })
        }
      >
        Restart now
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          snoozeUpdate();
          setNow(Date.now());
        }}
      >
        Later
      </Button>
    </div>
  );
}
