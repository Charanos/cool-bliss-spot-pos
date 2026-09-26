'use client';

import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../lib/cx';

/**
 * A PIN typed on a keyboard: one box per digit over a single real input, so typing, deleting,
 * pasting a whole PIN and a phone's one-time-code fill all work as they would in any field. Anything
 * that is not a digit is dropped, and a paste longer than the PIN keeps its first digits. Hidden by
 * default, with a toggle to show the digits while choosing.
 */
export function PinBoxes({
  value,
  onChange,
  length,
  label,
  helper,
  error,
  focusFirst,
  disabled,
  revealable = true,
}: {
  value: string;
  onChange: (next: string) => void;
  length: number;
  label: string;
  helper?: string;
  error?: string | null;
  /** Take focus when shown, for the first field of a dialog. */
  focusFirst?: boolean;
  disabled?: boolean;
  revealable?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (focusFirst) input.current?.focus({ preventScroll: true });
  }, [focusFirst]);
  const described = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex h-20 items-center justify-between gap-12">
        <label htmlFor={id} className="text-label text-ink-muted">
          {label}
        </label>
        {revealable ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            className="inline-flex items-center gap-4 rounded-sm text-body-sm text-ink-subtle transition-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {shown ? <IconEyeOff size={14} stroke={1.75} aria-hidden="true" /> : <IconEye size={14} stroke={1.75} aria-hidden="true" />}
            {shown ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      <div className="relative w-fit">
        <input
          ref={input}
          id={id}
          type={shown ? 'text' : 'password'}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${length}}`}
          maxLength={length}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          onPaste={(e) => {
            e.preventDefault();
            onChange(e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length));
          }}
          className="absolute inset-0 z-10 size-full cursor-text opacity-0"
        />
        <div aria-hidden="true" className="flex gap-8">
          {Array.from({ length }, (_, i) => {
            const digit = value[i];
            const caret = focused && (i === value.length || (i === length - 1 && value.length === length));
            return (
              <span
                key={i}
                className={cx(
                  'flex h-control-xl w-control-lg items-center justify-center rounded-control border bg-card font-mono tabular text-num-lg text-ink transition-hover',
                  error ? 'border-stop' : caret ? 'border-accent ring-2 ring-accent/25' : digit ? 'border-edge-strong' : 'border-edge',
                  disabled && 'opacity-60',
                )}
              >
                {digit ? shown ? digit : <span className="size-8 rounded-dot bg-ink" /> : null}
              </span>
            );
          })}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-stop">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-help`} className="text-body-sm text-ink-subtle">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
