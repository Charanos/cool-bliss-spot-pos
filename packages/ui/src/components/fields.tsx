'use client';

import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
  useRef,
  useState,
} from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE } from './icon';
import { Spinner } from './spinner';

/**
 * Fields are underlined, never filled, so no input box ever sits inside a sheet surface.
 * The rule thickens to the accent on focus and turns Stop on error. Labels are label type;
 * helper and error text say what would be valid, never "Invalid input".
 */

interface FieldFrameProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  counter?: ReactNode;
  htmlFor: string;
  className?: string;
  children: ReactNode;
  hideLabel?: boolean;
}

export function FieldFrame({ label, helper, error, counter, htmlFor, className, children, hideLabel }: FieldFrameProps) {
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      {label ? (
        <label htmlFor={htmlFor} className={cx('text-label text-ink-subtle', hideLabel && 'sr-only')}>
          {label}
        </label>
      ) : null}
      {children}
      {error || helper || counter ? (
        <div className="flex items-start justify-between gap-12 pt-6">
          <p id={`${htmlFor}-help`} className={cx('text-body-sm', error ? 'text-stop' : 'text-ink-subtle')}>
            {error ?? helper}
          </p>
          {counter ? <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{counter}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/*
 * The focus indicator is a 2px rule drawn by a pseudo element, not a coloured shadow, which the
 * design system refuses. The input's own outline is replaced in the same rule set, as section 8 asks.
 */
const underline =
  "relative flex min-w-0 items-center gap-8 border-b border-ink-subtle/60 transition-[border-color] duration-[160ms] focus-within:border-accent after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:origin-left after:scale-x-0 after:bg-accent after:content-[''] after:transition-transform after:duration-[160ms] focus-within:after:scale-x-100";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  counter?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  size?: 'md' | 'lg';
  mono?: boolean;
  hideLabel?: boolean;
  frameClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helper, error, counter, leading, trailing, size = 'lg', mono, hideLabel, id, className, frameClassName, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame label={label} helper={helper} error={error} counter={counter} htmlFor={fieldId} className={frameClassName} hideLabel={hideLabel}>
      <div className={cx(underline, size === 'lg' ? 'h-control-lg' : 'h-control-md', error ? 'border-stop focus-within:border-stop after:bg-stop' : null, disabled && 'opacity-60')}>
        {leading}
        <input
          {...rest}
          ref={ref}
          id={fieldId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? `${fieldId}-help` : undefined}
          className={cx(
            'h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-subtle',
            mono ? 'font-mono tabular text-num-lg' : 'text-body',
            className,
          )}
        />
        {trailing}
      </div>
    </FieldFrame>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  counter?: ReactNode;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, helper, error, counter, id, className, rows = 2, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame label={label} helper={helper} error={error} counter={counter} htmlFor={fieldId}>
      <div className={cx(underline, 'py-8', error ? 'border-stop focus-within:border-stop after:bg-stop' : null)}>
        <textarea
          {...rest}
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? `${fieldId}-help` : undefined}
          className={cx('min-h-[44px] w-full resize-none bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle', className)}
        />
      </div>
    </FieldFrame>
  );
});

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, 'leading' | 'trailing'> & { onClear?: () => void; shortcut?: string }
>(function SearchField({ onClear, value, shortcut, size = 'md', ...rest }, ref) {
  const hasValue = typeof value === 'string' && value.length > 0;
  return (
    <TextField
      {...rest}
      ref={ref}
      size={size}
      type="search"
      value={value}
      autoComplete="off"
      spellCheck={false}
      leading={<IconSearch size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />}
      trailing={
        hasValue && onClear ? (
          <button type="button" onClick={onClear} aria-label="Clear the search" className="-mr-8 inline-flex size-control-md items-center justify-center text-ink-subtle hover:text-ink">
            <IconX size={16} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
        ) : shortcut ? (
          <kbd className="font-mono text-num-sm text-ink-subtle">{shortcut}</kbd>
        ) : null
      }
    />
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  helper?: ReactNode;
  hideLabel?: boolean;
  options: readonly { value: string; label: string }[];
  /** The choice is being applied, for a select that navigates. The spinner takes the chevron's slot. */
  pending?: boolean;
}

export function SelectField({ label, helper, options, id, className, hideLabel, pending = false, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame label={label} helper={helper} htmlFor={fieldId} hideLabel={hideLabel}>
      <div className={cx(underline, 'relative h-control-md')}>
        <select
          {...rest}
          id={fieldId}
          style={{ colorScheme: 'inherit', ...rest.style }}
          className={cx('h-full w-full min-w-0 flex-1 appearance-none bg-transparent pr-24 text-body text-ink outline-none cursor-pointer', className)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-raised text-ink py-6">
              {o.label}
            </option>
          ))}
        </select>
        {pending ? (
          <Spinner size={16} className="pointer-events-none absolute right-0" />
        ) : (
          <IconChevronDown size={16} stroke={ICON_STROKE} aria-hidden="true" className="pointer-events-none absolute right-0 text-ink-subtle" />
        )}
      </div>
    </FieldFrame>
  );
}

/**
 * Stepper — an underlined field like every other input here, not a filled
 * pill. The number sits in the same slot a typed value would occupy in
 * TextField, flanked by ± buttons that act as its increment/decrement
 * affordance rather than as a separate control bolted on next to it.
 *
 * Built on ARIA's spinbutton pattern, so it behaves like the native `<input
 * type=number>` this stands in for: role="spinbutton" with
 * aria-valuenow/min/max/text lets a screen reader announce "4, guests, spin
 * button" the way it would a real numeric input, and ArrowUp/ArrowDown/Home/
 * End work without leaving the keyboard. Clicking or pressing Enter on the
 * number opens a real numeric input for direct entry — getting from 1 to 20
 * by individual taps is the one thing every other field in this file lets
 * you skip by typing or selecting directly, and this closes that gap.
 */
export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label,
  size = 'lg',
  decreaseLabel = 'Decrease',
  increaseLabel = 'Increase',
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  label: string;
  size?: 'md' | 'lg' | 'xl';
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  const figure = size === 'xl' ? 'text-[32px] leading-none' : size === 'lg' ? 'text-num-lg' : 'text-num';
  const figureWidth = size === 'xl' ? 'min-w-[56px]' : size === 'lg' ? 'min-w-[40px]' : 'min-w-[32px]';

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const step = (delta: number) => onChange(clamp(value + delta));

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    onChange(Number.isFinite(parsed) ? clamp(parsed) : value);
    setEditing(false);
  };

  const openEditor = () => {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const heightClass = size === 'xl' ? 'h-[48px]' : size === 'lg' ? 'h-[40px]' : 'h-[32px]';
  const buttonSize = size === 'xl' ? 'w-[48px] text-[28px]' : size === 'lg' ? 'w-[40px] text-[24px]' : 'w-[32px] text-[20px]';

  return (
    <div
      className={cx(
        'inline-flex shrink-0 items-center rounded-full bg-sunken/60 ring-1 ring-rule-raised/30 select-none overflow-hidden',
        heightClass,
        className,
      )}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        aria-disabled={value <= min || undefined}
        onClick={() => step(-1)}
        className={cx(
          'flex h-full shrink-0 items-center justify-center text-ink font-regular transition-colors hover:bg-glass-hover active:bg-glass-strong press-feedback',
          buttonSize,
          value <= min ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer',
        )}
      >
        −
      </button>

      {editing ? (
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') setEditing(false);
          }}
          className={cx('bg-transparent text-center font-mono tabular text-ink outline-none font-medium', figure, figureWidth)}
        />
      ) : (
        <button
          type="button"
          id={fieldId}
          aria-live="off"
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${value}`}
          onClick={openEditor}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); step(1); }
            if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); step(-1); }
            if (e.key === 'Home') { e.preventDefault(); onChange(min); }
            if (e.key === 'End') { e.preventDefault(); onChange(max); }
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); }
          }}
          className={cx('h-full cursor-text select-none text-center font-mono tabular text-ink outline-none focus-visible:text-accent font-medium', figure, figureWidth)}
        >
          {value}
        </button>
      )}

      <button
        type="button"
        aria-label={increaseLabel}
        aria-disabled={value >= max || undefined}
        onClick={() => step(1)}
        className={cx(
          'flex h-full shrink-0 items-center justify-center text-ink font-regular transition-colors hover:bg-glass-hover active:bg-glass-strong press-feedback',
          buttonSize,
          value >= max ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer',
        )}
      >
        +
      </button>
    </div>
  );
}

/** A switch. The knob is a mark on the track, not a nested surface. */
export function Switch({
  checked,
  onChange,
  label,
  helper,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  helper?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-row items-center gap-16 py-8">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-body text-ink">
          {label}
        </label>
        {helper ? <p className="text-body-sm text-ink-subtle">{helper}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onChange(!checked)}
        className={cx('relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-sm px-[4px] press-feedback', checked ? 'bg-accent' : 'bg-control-hover', disabled && 'opacity-50')}
      >
        <span
          aria-hidden="true"
          className={cx('size-[20px] rounded-sm transition-transform duration-[160ms] ease-out', checked ? 'translate-x-[20px] bg-accent-ink' : 'translate-x-0 bg-ink-subtle')}
        />
      </button>
    </div>
  );
}