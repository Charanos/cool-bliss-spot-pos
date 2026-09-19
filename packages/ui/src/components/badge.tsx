import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

type BadgeTone = 'accent' | 'attention' | 'neutral' | 'poured' | 'served' | 'stop';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONE: Record<BadgeTone, string> = {
  accent: 'border-accent/25 bg-accent/[0.07] text-accent-text',
  attention: 'border-attention/25 bg-attention/[0.07] text-attention',
  neutral: 'border-hairline/60 bg-raised/80 text-ink-muted',
  poured: 'border-poured/25 bg-poured/[0.07] text-poured',
  served: 'border-served/25 bg-served/[0.07] text-served',
  stop: 'border-stop/25 bg-stop/[0.12] text-stop',
};

/**
 * A tinted label naming what something is: "Waiter tablet". Not a status: a state uses StatusChip,
 * which carries a dot so it never relies on colour alone. Write sentence case; it renders in caps.
 */
export function Badge({ children, tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cx('inline-flex items-center gap-6 rounded-sm border px-8 py-4 font-mono text-badge uppercase transition-colors duration-[var(--bliss-duration-hover)]', TONE[tone], className)}
    >
      <span className="inline-flex items-center gap-6 leading-none">{children}</span>
    </span>
  );
}
