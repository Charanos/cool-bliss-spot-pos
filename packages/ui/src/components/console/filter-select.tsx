'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { ICON_STROKE } from '../icon';
import { ListboxPopup } from '../listbox';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter in a toolbar: "Status  Open ▾", a pill that opens the shared listbox (listbox.tsx):
 * options with aria-selected, arrow keys, type to jump, Enter or Space to choose, Escape and Tab to
 * close, focus back on the trigger. docs/19 section 3.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
  /** The option that clears the filter. Null when a value is always required. */
  allLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const all: readonly FilterOption[] = allLabel === null ? options : [{ value: '', label: allLabel }, ...options];
  const current = all.find((o) => o.value === value);
  const filtered = Boolean(value);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          'inline-flex h-control-sm items-center gap-8 rounded-pill border px-12 text-body-sm transition-hover',
          filtered ? 'border-accent/40 bg-accent-wash text-ink' : 'border-edge bg-card text-ink-muted hover:border-edge-strong hover:bg-control hover:text-ink',
        )}
      >
        <span className="text-ink-subtle">{label}</span>
        <span className={cx('max-w-search truncate font-medium', filtered ? 'text-accent-text' : 'text-ink')}>{current?.label ?? allLabel ?? ''}</span>
        <IconChevronDown size={14} stroke={ICON_STROKE} aria-hidden="true" className={cx('shrink-0 text-ink-subtle transition-card', open && 'rotate-180')} />
      </button>
      {open ? (
        <ListboxPopup
          anchor={buttonRef}
          options={all}
          value={value}
          label={label}
          onChoose={onChange}
          onClose={(refocus) => {
            setOpen(false);
            if (refocus) buttonRef.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </>
  );
}

/** @deprecated The old name, kept while pages move over. Use FilterSelect. */
export const FilterDropdown = FilterSelect;
