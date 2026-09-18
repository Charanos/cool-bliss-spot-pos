import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Dot, type Tone } from './status';

/**
 * A skeleton takes the exact shape of what is coming, so nothing moves when the data lands.
 * Static: docs/07 registers no loading animation, and the Floor has none under 100ms by rule.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={cx('block rounded-sm bg-skeleton', className)} style={style} />;
}

/**
 * Empty states come in two kinds, and conflating them makes a healthy system look broken.
 * docs/08-ux-copy.md section 7:
 *  - nothing has happened yet: explain, then offer the one action that starts it
 *  - everything is fine: explain why it is empty, and offer nothing
 */
export function EmptyState({
  title,
  body,
  action,
  align = 'start',
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-8 py-40', align === 'center' ? 'items-center text-center' : 'items-start', className)}>
      <p className="text-subtitle text-ink">{title}</p>
      <p className="max-w-[48ch] text-body text-ink-muted">{body}</p>
      {action ? <div className="pt-8">{action}</div> : null}
    </div>
  );
}

/**
 * Inline notice: a dot, what happened, what is safe, and what to do. Persistent and in the flow,
 * never a toast. Used for errors that need a human and for the offline catalogue update.
 */
export function InlineNotice({ tone, children, action, className }: { tone: Tone; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cx('flex items-start gap-12 py-8', className)}>
      <Dot tone={tone} className="mt-8" />
      <p className="min-w-0 flex-1 text-body text-ink">{children}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Determinate progress over ten seconds, with a count: "Sending 4 of 12 orders". */
export function Progress({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cx('flex flex-col gap-8', className)}>
      <div className="h-[4px] overflow-hidden rounded-sm bg-control" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="flex justify-between gap-8 text-body-sm text-ink-muted">
        <span>{label}</span>
        <span className="font-mono tabular text-num-sm text-ink-subtle">
          {value} of {max}
        </span>
      </div>
    </div>
  );
}
