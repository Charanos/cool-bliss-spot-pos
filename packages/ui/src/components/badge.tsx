import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

import { type Tone, washTone } from './status';

type BadgeTone = Tone | 'attention';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONE: Record<BadgeTone, string> = { ...washTone, attention: 'bg-attention-wash text-attention' };

/**
 * A tinted label naming what something is: "Waiter tablet". Not a status: a state uses StatusChip,
 * which carries a dot so it never relies on colour alone. Write sentence case; it renders in caps.
 */
export function Badge({ children, tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cx('inline-flex h-chip-dense items-center gap-6 rounded-sm px-8 font-mono text-badge uppercase transition-hover', TONE[tone], className)}
    >
      <span className="inline-flex items-center gap-6 leading-none">{children}</span>
    </span>
  );
}
