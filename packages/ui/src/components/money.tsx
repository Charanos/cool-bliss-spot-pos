'use client';

import { type Cents, formatFigure, formatKes, isNegative } from '@bliss/shared/money';
import { useCountTo } from '../motion/hooks';
import type { AnimationName } from '../motion/registry';
import { cx } from '../lib/cx';

export type NumSize = 'num-sm' | 'num-md' | 'num' | 'num-lg' | 'num-kpi' | 'num-xl' | 'display' | 'title-lg' | 'title';

const numSize: Record<NumSize, string> = {
  'num-sm': 'text-num-sm',
  'num-md': 'text-num-md',
  num: 'text-num',
  'num-lg': 'text-num-lg',
  'num-kpi': 'text-num-kpi',
  'num-xl': 'text-num-xl',
  display: 'text-display',
  'title-lg': 'text-title-lg',
  title: 'text-title',
};

/** The KES prefix scales with the figure: label type beside a large number, micro beside a small one. */
const currencySize: Record<NumSize, string> = {
  'num-sm': 'text-micro',
  'num-md': 'text-micro',
  num: 'text-micro',
  'num-lg': 'text-label',
  'num-kpi': 'text-label',
  'num-xl': 'text-label',
  display: 'text-label',
  'title-lg': 'text-label',
  title: 'text-label',
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
  // The visible parts are hidden from assistive technology and the whole amount is read once, as
  // words a screen reader pronounces: "KES 1,250.00", never "K E S" and a bare number.
  return (
    <span className={cx('inline-flex items-baseline gap-4 whitespace-nowrap', className)}>
      <span className="sr-only">{formatKes(value, { decimals })}</span>
      {currency ? (
        <span aria-hidden="true" className={cx('font-medium text-ink-subtle uppercase', currencySize[size])}>
          KES
        </span>
      ) : null}
      <span aria-hidden="true" className={cx('font-mono tabular', numSize[size], negative ? 'text-stop' : toneClass[tone])}>
        {formatFigure(value, { decimals })}
      </span>
    </span>
  );
}

/** Money that counts to its new value through a registered animation. */
export function AnimatedMoney({ animation, fromZeroOnMount, ...props }: MoneyProps & { animation: AnimationName; fromZeroOnMount?: boolean }) {
  const shown = useCountTo(props.value, animation, { fromZeroOnMount });
  // The counting figure is decoration; the settled value is what a screen reader hears.
  return (
    <span className="contents">
      <span aria-hidden="true" className="contents">
        <Money {...props} value={shown} />
      </span>
      <span className="sr-only">{formatKes(props.value, { decimals: props.decimals })}</span>
    </span>
  );
}
