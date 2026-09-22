'use client';

import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  disabled?: boolean;
}

/**
 * Filter chips: category chips on the Floor, zones on the tab list, ranges on the Console.
 * The selected chip is filled accent with accent ink; others carry no background, so a row of
 * chips never reads as a row of boxes.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const height = size === 'lg' ? 'h-control-lg px-16' : size === 'md' ? 'h-[36px] px-12' : 'h-control-sm px-12';
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex min-w-0 items-center gap-4', className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={o.disabled || undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cx(
              'inline-flex shrink-0 items-center gap-8 whitespace-nowrap rounded-dot press-feedback transition-colors',
              height,
              size === 'lg' ? 'text-body font-medium' : 'text-body-sm font-medium',
              selected ? 'bg-ink text-page shadow-raised' : 'text-ink-muted hover:bg-control/50 hover:text-ink',
              o.disabled && 'opacity-40',
            )}
          >
            <span>{o.label}</span>
            {o.count !== undefined ? (
              <span className={cx('font-mono tabular text-num-sm', selected ? 'text-page/70' : 'text-ink-subtle')}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Segmented control for a small set of mutually exclusive modes: Whole tab, This seat, Even split;
 * comfortable and compact rows. The selected segment takes the control fill.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const height = size === 'lg' ? 'h-control-lg' : size === 'md' ? 'h-control-md' : 'h-control-sm';
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex items-center gap-2 rounded-dot bg-sunken/80 p-[3px]', className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={o.disabled || undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cx(
              'inline-flex items-center gap-6 rounded-dot px-16 font-medium text-body-sm press-feedback transition-colors',
              height,
              selected ? 'bg-raised text-ink shadow-raised' : 'text-ink-muted hover:text-ink hover:bg-control/30',
              o.disabled && 'opacity-40',
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className="font-mono tabular text-num-sm text-ink-subtle">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
