'use client';

import { formatElapsed } from '@bliss/shared/format';
import { useHydrated, useNow } from '../hooks';
import { cx } from '../lib/cx';

/**
 * Time since a moment, in JetBrains Mono: "4h12". Re-renders on its own 30s tick, so a list of cards
 * does not re-render every card to move one clock. Renders the server's figure until hydration.
 *
 * `warnAfterMs` turns it to the Low signal colour, with the reason in words for a screen reader.
 */
export function Elapsed({
  since,
  serverNow,
  warnAfterMs,
  warnLabel = 'open a long time',
  className,
}: {
  since: number;
  /** The render time on the server, so the first paint matches. Omit on client-only screens. */
  serverNow?: number;
  warnAfterMs?: number;
  warnLabel?: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const clientNow = useNow(30_000);
  const now = hydrated || serverNow === undefined ? clientNow : serverNow;
  const ms = Math.max(0, now - since);
  const warn = warnAfterMs !== undefined && ms > warnAfterMs;
  return (
    <span className={cx('font-mono tabular text-num-sm', warn ? 'text-low' : 'text-ink-subtle', className)} suppressHydrationWarning>
      {formatElapsed(ms)}
      {warn ? <span className="sr-only">, {warnLabel}</span> : null}
    </span>
  );
}
