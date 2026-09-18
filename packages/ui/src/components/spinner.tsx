import { cx } from '../lib/cx';

/**
 * Inline spinner for 100ms to 1s waits, in the control, never centred over a blank page.
 * docs/08-ux-copy.md section 9. The track and arc are borders on an element with no children.
 */
export function Spinner({ size = 16, tone = 'default', className }: { size?: 16 | 20 | 24; tone?: 'default' | 'on-accent'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block shrink-0 rounded-dot border-2 spin',
        tone === 'on-accent' ? 'border-accent-ink/25 border-t-accent-ink' : 'border-control-hover border-t-accent',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
