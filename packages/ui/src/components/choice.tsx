'use client';

import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { cx } from '../lib/cx';

/**
 * Arrow keys for a radio group: Left and Right (and Up and Down) move the choice, Home and End jump,
 * and only the checked option is in the tab order. The ARIA radio group pattern.
 */
function useRoving<T extends string>(options: readonly ChoiceOption<T>[], value: T, onChange: (next: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const at = enabled.indexOf(index);
    const last = enabled.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabled[at >= last ? 0 : at + 1] ?? null;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabled[at <= 0 ? last : at - 1] ?? null;
    else if (event.key === 'Home') next = enabled[0] ?? null;
    else if (event.key === 'End') next = enabled[last] ?? null;
    if (next === null) return;
    event.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  return { refs, onKeyDown, tabIndexFor: (i: number) => (i === selectedIndex ? 0 : -1) };
}

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
  const height = size === 'lg' ? 'h-control-lg px-16' : size === 'md' ? 'h-row-compact px-12' : 'h-control-sm px-12';
  const roving = useRoving(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex min-w-0 items-center gap-4', className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(node) => {
              roving.refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={roving.tabIndexFor(i)}
            onKeyDown={(event) => roving.onKeyDown(event, i)}
            aria-disabled={o.disabled || undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cx(
              'inline-flex shrink-0 items-center gap-8 whitespace-nowrap rounded-dot press-feedback transition-colors',
              height,
              size === 'lg' ? 'text-body font-medium' : 'text-body-sm font-medium',
              selected ? 'bg-ink text-page shadow-raised' : 'text-ink-muted hover:bg-control hover:text-ink',
              o.disabled && 'opacity-40',
            )}
          >
            <span>{o.label}</span>
            {o.count !== undefined ? (
              <span className={cx('font-mono tabular text-num-sm', selected ? 'text-page' : 'text-ink-subtle')}>{o.count}</span>
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
  const roving = useRoving(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex items-center gap-2 rounded-dot bg-sunken p-2', className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(node) => {
              roving.refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={roving.tabIndexFor(i)}
            onKeyDown={(event) => roving.onKeyDown(event, i)}
            aria-disabled={o.disabled || undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cx(
              'inline-flex items-center gap-6 rounded-dot px-16 font-medium text-body-sm press-feedback transition-colors',
              height,
              selected ? 'bg-thumb text-ink shadow-raised' : 'text-ink-muted hover:bg-control hover:text-ink',
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
