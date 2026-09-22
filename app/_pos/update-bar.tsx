'use client';

import { Button } from '@bliss/ui/components/button';
import { Dot } from '@bliss/ui/components/status';
import { useState } from 'react';
import { applyUpdate, useAppUpdate } from '@/lib/pos/updates';

/**
 * A new build is ready. It never interrupts: one quiet line under the top bar, dismissable, and the
 * restart is refused while anything is still waiting to send. docs/16-responsive-and-offline.md.
 */
export function UpdateBar() {
  const { ready, applying } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || dismissed) return null;

  return (
    <div role="status" className="safe-x flex shrink-0 flex-wrap items-center gap-8 border-b border-rule-raised/40 bg-raised/80 px-12 py-8 backdrop-blur-glass pad:px-24">
      <Dot tone="info" />
      <p className="min-w-0 flex-1 text-body-sm text-ink">{error ?? 'A newer version of Bliss is ready on this tablet.'}</p>
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
      <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
        Later
      </Button>
    </div>
  );
}
