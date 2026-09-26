'use client';

import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '../../hooks';
import { cx } from '../../lib/cx';
import { ICON_STROKE } from '../icon';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter in a toolbar: "Status  Open ▾". A button that opens a listbox of options, with the
 * listbox pattern done properly: options are `option`s with aria-selected, arrow keys move, Enter
 * or Space choose, Escape and Tab close, focus returns to the trigger. docs/19 section 3.
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
  const [position, setPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const all: readonly FilterOption[] = allLabel === null ? options : [{ value: '', label: allLabel }, ...options];
  const selectedIndex = Math.max(0, all.findIndex((o) => o.value === value));
  const current = all.find((o) => o.value === value);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(listRef, open, () => close(false));

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !listRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const list = listRef.current.getBoundingClientRect();
    const below = rect.bottom + 6 + list.height <= window.innerHeight;
    setPosition({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - list.height),
      left: Math.min(window.innerWidth - Math.max(list.width, rect.width) - 8, rect.left),
      minWidth: rect.width,
    });
    listRef.current.focus({ preventScroll: true });
  }, [open]);

  const choose = (index: number) => {
    const option = all[index];
    if (!option) return;
    onChange(option.value);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = all.length - 1;
    if (event.key === 'ArrowDown') setActive((i) => (i >= last ? 0 : i + 1));
    else if (event.key === 'ArrowUp') setActive((i) => (i <= 0 ? last : i - 1));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(last);
    else if (event.key === 'Enter' || event.key === ' ') choose(active);
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') close(false);
    else return;
    event.preventDefault();
  };

  const filtered = Boolean(value);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setActive(selectedIndex);
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(selectedIndex);
            setOpen(true);
          }
        }}
        className={cx(
          'inline-flex h-control-sm items-center gap-8 rounded-md border px-12 text-body-sm transition-hover',
          filtered ? 'border-accent bg-accent-wash text-ink' : 'border-edge-strong bg-card text-ink-muted hover:bg-control hover:text-ink',
        )}
      >
        <span className="text-ink-subtle">{label}</span>
        <span className={cx('max-w-search truncate font-medium', filtered ? 'text-accent-text' : 'text-ink')}>{current?.label ?? allLabel ?? ''}</span>
        <IconChevronDown size={14} stroke={ICON_STROKE} aria-hidden="true" className={cx('shrink-0 text-ink-subtle transition-card', open && 'rotate-180')} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onKeyDown}
              data-lenis-prevent=""
              style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, minWidth: position?.minWidth }}
              className="fixed z-popover max-h-popover min-w-popover-min overflow-y-auto rounded-md border border-edge bg-card p-4 shadow-popover outline-none"
            >
              {all.map((option, index) => {
                const selected = option.value === value;
                return (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the listbox, which owns focus
                  <li
                    key={option.value || '__all'}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(index)}
                    className={cx(
                      'flex cursor-pointer items-center gap-8 rounded-sm px-8 py-6 text-body-sm',
                      index === active ? 'bg-control text-ink' : 'text-ink-muted',
                      selected && 'font-medium text-ink',
                    )}
                  >
                    <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center text-accent-text">
                      {selected ? <IconCheck size={14} stroke={2} /> : null}
                    </span>
                    {option.label}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

/** @deprecated The old name, kept while pages move over. Use FilterSelect. */
export const FilterDropdown = FilterSelect;
