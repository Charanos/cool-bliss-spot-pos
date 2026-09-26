import { cx } from '../../lib/cx';

const fill = { accent: 'bg-accent', attention: 'bg-attention', stop: 'bg-stop', poured: 'bg-poured', muted: 'bg-ink-subtle' } as const;

/**
 * A 3px bar inside a figure's cell: a share, days of cover, how much of an order has come in. It
 * is decoration beside a number that already says it, so it is hidden from assistive technology
 * unless `label` is given. Server safe. docs/19 section 3.
 */
export function InlineBar({
  value,
  tone = 'accent',
  label,
  className,
}: {
  /** From 0 to 1; anything outside is clamped. */
  value: number;
  tone?: keyof typeof fill;
  label?: string;
  className?: string;
}) {
  const share = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return (
    <span
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(share * 100) : undefined}
      aria-hidden={label ? undefined : true}
      className={cx('relative inline-block h-4 w-40 shrink-0 overflow-hidden rounded-pill bg-band-strong align-middle', className)}
    >
      <span className={cx('absolute inset-y-0 left-0 rounded-pill', fill[tone])} style={{ width: `${(share * 100).toFixed(1)}%` }} />
    </span>
  );
}
