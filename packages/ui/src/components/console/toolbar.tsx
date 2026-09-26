'use client';

import { IconSearch, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { ICON_STROKE } from '../icon';

/**
 * The strip above a table or a report: filters on the left, a count and view controls on the
 * right. One row, one height (32px), so every workspace's toolbar reads the same.
 */
export function Toolbar({ children, end, className, label = 'Filters' }: { children?: ReactNode; end?: ReactNode; className?: string; label?: string }) {
  return (
    <div role="toolbar" aria-label={label} className={cx('flex flex-wrap items-center gap-8', className)}>
      {children}
      {end ? <div className="ml-auto flex items-center gap-8">{end}</div> : null}
    </div>
  );
}

/** Search inside a toolbar: filters as you type, clears with one control. */
export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div
      className={cx(
        'relative flex h-control-sm w-search items-center gap-8 rounded-md border border-edge-strong bg-card px-12 transition-hover focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        className,
      )}
    >
      <IconSearch size={14} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-full min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear the search" className="-mr-4 inline-flex size-20 shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-hover hover:bg-control hover:text-ink">
          <IconX size={12} stroke={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** An on or off filter in a toolbar, as a pressed button: "Only open", "With variance". */
export function ToggleChip({ pressed, onChange, children }: { pressed: boolean; onChange: (next: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cx(
        'inline-flex h-control-sm items-center gap-6 rounded-md border px-12 text-body-sm font-medium transition-hover',
        pressed ? 'border-accent bg-accent-wash text-accent-text' : 'border-edge-strong bg-card text-ink-muted hover:bg-control hover:text-ink',
      )}
    >
      <span aria-hidden="true" className={cx('size-dot rounded-dot', pressed ? 'bg-accent' : 'bg-hairline')} />
      {children}
    </button>
  );
}

/** A count in a toolbar: "24 bills", or "6 of 24 bills" once filtered. Announced when it changes. */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: [string, string] }) {
  const word = total === 1 ? noun[0] : noun[1];
  return (
    <span aria-live="polite" className="text-body-sm text-ink-subtle tabular">
      {shown === total ? `${total} ${word}` : `${shown} of ${total} ${word}`}
    </span>
  );
}
