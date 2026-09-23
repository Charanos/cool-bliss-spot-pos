'use client';

import { useEffect } from 'react';
import { isStaleBuildError, recoverFromStaleBuild } from './_components/sw-register';
import './globals.css';

/**
 * The last line: something failed while rendering the app itself. A stale build heals on its own;
 * anything else gets a calm screen and one button, and nothing on the device is lost, because the
 * outbox and the local store live outside the page.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleBuildError(error)) void recoverFromStaleBuild();
  }, [error]);

  return (
    <html lang="en-KE" data-theme="dark">
      <body className="flex min-h-dvh items-center justify-center bg-page px-24 text-ink antialiased">
        <main className="flex max-w-[420px] flex-col items-center gap-16 text-center">
          <p className="text-title text-ink">Bliss needs a moment</p>
          <p className="text-body text-ink-muted">Something on this screen did not load. Orders and payments held on this device are safe, and send as soon as it is back.</p>
          <div className="flex gap-12 pt-8">
            <button type="button" onClick={() => reset()} className="h-control-lg rounded-[14px] bg-control px-20 text-body font-medium text-ink press-feedback hover:bg-control-hover">
              Try again
            </button>
            <button type="button" onClick={() => void recoverFromStaleBuild().then(() => window.location.reload())} className="h-control-lg rounded-[14px] bg-accent px-20 text-body font-medium text-accent-ink press-feedback hover:bg-accent-hover">
              Reload Bliss
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
