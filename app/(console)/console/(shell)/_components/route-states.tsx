'use client';

import { Button } from '@bliss/ui/components/button';
import { Dot } from '@bliss/ui/components/status';
import { useEffect } from 'react';

/**
 * The error state for a view: what happened, that nothing was changed, and one thing to do. The
 * technical detail goes to the server log (and the digest to support), never onto the screen.
 * docs/08 voice.
 */
export function RouteError({ what, error, reset }: { what: string; error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="flex flex-col items-start gap-12 py-40">
      <p className="flex items-center gap-8 text-title-section text-ink">
        <Dot tone="stop" />
        {what} did not load
      </p>
      <p className="measure text-ui text-ink-muted">Nothing was changed. The data is safe; this view could not read it just now. Try again, and if it keeps happening, note the time for support{error.digest ? ` and the reference ${error.digest}` : ''}.</p>
      <Button size="sm" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
