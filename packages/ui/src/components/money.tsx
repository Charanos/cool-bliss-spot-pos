'use client';

import { type Cents, formatFigure, formatKes, isNegative } from '@bliss/shared/money';
import { useCountTo } from '../motion/hooks';
import type { AnimationName } from '../motion/registry';
import { cx } from '../lib/cx';

export type NumSize = 'num-sm' | 'num' | 'num-lg' | 'num-xl' | 'display' | 'title-lg' | 'title';

const numSize: Record<NumSize, string> = {
  'num-sm': 'text-num-sm',
  num: 'text-num',
  'num-lg': 'text-num-lg',
  'num-xl': 'text-num-xl',
  display: 'text-display',
  'title-lg': 'text-title-lg tracking-[-0.03em]',
  title: 'text-title',
};

/** Every number in JetBrains Mono with tabular figures. */
export function Num({ children, size = 'num', className }: { children: React.ReactNode; size?: NumSize; className?: string }) {
  return <span className={cx('font-mono tabular', numSize[size], className)}>{children}</span>;
}

export type MoneyTone = 'default' | 'muted' | 'money' | 'attention' | 'poured' | 'subtle' | 'accent' | 'disabled';

const toneClass: Record<MoneyTone, string> = {
  default: 'text-ink',
  muted: 'text-ink-muted',
  subtle: 'text-ink-subtle',
  money: 'text-money',
  attention: 'text-attention',
  poured: 'text-poured',
  accent: 'text-accent-text',
  disabled: 'text-ink-disabled',
};

export interface MoneyProps {
  value: Cents;
  size?: NumSize;
  tone?: MoneyTone;
  /** Hide the KES prefix inside dense columns where the header already says KES. */
  currency?: boolean;
  decimals?: 'always' | 'whole';
  className?: string;
}

/**
 * KES in label type, the figure in JetBrains Mono. Negative values take a leading minus and the
 * Stop colour, never parentheses and never colour alone. docs/06-design-system.md section 3.
 */
export function Money({ value, size = 'num', tone = 'default', currency = true, decimals = 'always', className }: MoneyProps) {
  const negative = isNegative(value);
  const large = size === 'display' || size === 'title-lg' || size === 'title' || size === 'num-xl';
  return (
    <span className={cx('inline-flex items-baseline gap-[0.25em] whitespace-nowrap', className)} aria-label={formatKes(value, { decimals })}>
      {currency ? (
        <span aria-hidden="true" className={cx(
          'font-semibold tracking-[0.06em] text-ink-subtle uppercase',
          large ? 'text-[12px]' : 'text-[10px]'
        )}>
          KES
        </span>
      ) : null}
      <span aria-hidden="true" className={cx('font-mono tabular tracking-tight', numSize[size], negative ? 'text-stop font-medium' : toneClass[tone])}>
        {formatFigure(value, { decimals })}
      </span>
    </span>
  );
}

/** Money that counts to its new value through a registered animation. */
export function AnimatedMoney({ animation, fromZeroOnMount, ...props }: MoneyProps & { animation: AnimationName; fromZeroOnMount?: boolean }) {
  const shown = useCountTo(props.value, animation, { fromZeroOnMount });
  return (
    <span className="contents">
      <Money {...props} value={shown} />
      <span className="sr-only" aria-live="off">
        {formatKes(props.value)}
      </span>
    </span>
  );
}
