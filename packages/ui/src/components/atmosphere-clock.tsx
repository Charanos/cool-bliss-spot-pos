'use client';

import { formatDate, formatTime } from '@bliss/shared/format';
import { useNow } from '../hooks';
import { cx } from '../lib/cx';
import { FadeRule } from './atmosphere';

/**
 * The date and a large clock, for a screen a device rests on. The server and the browser render
 * different minutes when a page loads across a minute boundary, so the two text nodes opt out of
 * the hydration comparison; everything around them is still checked.
 */
export function AtmosphereClock({ timeZone, className }: { timeZone: string; className?: string }) {
  const now = useNow(15_000);
  return (
    <div className={cx('flex flex-col', className)}>
      <p className="font-mono tabular text-num-lg text-ink-subtle" suppressHydrationWarning>
        {formatDate(now, timeZone)}
      </p>
      <FadeRule className="my-20 w-[120px]" />
      <p className="font-mono tabular text-clock text-ink" suppressHydrationWarning>
        <time dateTime={new Date(now).toISOString()} suppressHydrationWarning>
          {formatTime(now, timeZone)}
        </time>
      </p>
    </div>
  );
}
