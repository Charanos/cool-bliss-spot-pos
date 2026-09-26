'use client';

import { IconBackspace } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE } from './icon';

export const PIN_LENGTH = 6;

/**
 * PIN entry: one underlined position per digit (six unless the person's PIN is longer or shorter)
 * and a keypad. The digits are never shown, only that
 * a position is filled. Hardware keyboards type straight in.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  label,
  error,
  size = 'lg',
  disabled,
  length = PIN_LENGTH,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (pin: string) => void;
  label: string;
  error?: string | null;
  size?: 'md' | 'lg';
  disabled?: boolean;
  /** Digits in this PIN, 4 to 8. It completes on its own at this length. */
  length?: number;
}) {
  const push = (digit: string) => {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const pop = () => !disabled && onChange(value.slice(0, -1));

  // A hardware keypad types straight in, wherever focus is, except into a text field: a reason typed
  // above an approval PIN must never be taken as PIN digits.
  const latest = useRef({ push, pop });
  latest.current = { push, pop };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        latest.current.push(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        latest.current.pop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const key = size === 'lg' ? 'h-keypad text-num-lg' : 'h-control-xl text-num-lg';

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-24">
      <div className="flex items-end justify-center gap-12">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx(
              'flex h-control-xl items-center justify-center border-b-2',
              length > 6 ? 'w-[34px]' : 'w-[44px]',
              error ? 'border-stop' : i === value.length ? 'border-accent' : i < value.length ? 'border-ink-muted' : 'border-hairline',
            )}
          >
            {i < value.length ? <span className="size-[12px] rounded-dot bg-ink" /> : null}
          </span>
        ))}
        <span className="sr-only" aria-live="polite">
          {value.length} of {length} digits entered
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-center text-body text-stop">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" aria-disabled={disabled || undefined} onClick={() => push(d)} className={cx(key, 'surface-key flex items-center justify-center font-mono tabular text-ink')}>
            {d}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" aria-disabled={disabled || undefined} onClick={() => push('0')} className={cx(key, 'surface-key flex items-center justify-center font-mono tabular text-ink')}>
          0
        </button>
        <button
          type="button"
          aria-label="Delete the last digit"
          aria-disabled={disabled || value.length === 0 || undefined}
          onClick={pop}
          className={cx(key, 'surface-veil inline-flex items-center justify-center rounded-lg text-ink-muted active:scale-[var(--bliss-scale-key)]')}
        >
          <IconBackspace size={24} stroke={ICON_STROKE} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
