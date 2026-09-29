'use client';

import { IconCheck } from '@tabler/icons-react';
import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '../hooks';
import { cx } from '../lib/cx';

export interface ListboxOption {
  value: string;
  label: string;
  /** A second line or a figure beside the label, such as a count. */
  hint?: ReactNode;
  disabled?: boolean;
}

/**
 * The open list of a dropdown, shared by SelectField and FilterSelect so every dropdown on every
 * surface looks and behaves the same: a floating card under its trigger (above it when there is no
 * room below), the chosen option ticked, arrow keys, Home and End, Enter or Space to choose, Escape
 * and Tab to close, and typing a letter jumps to the next option that starts with it.
 *
 * It renders into the nearest open <dialog>, or the body: a modal dialog sits in the browser's top
 * layer, and a list portalled to the body would open underneath it.
 */
export function ListboxPopup({
  anchor,
  options,
  value,
  label,
  onChoose,
  onClose,
}: {
  anchor: RefObject<HTMLElement | null>;
  options: readonly ListboxOption[];
  value: string;
  label: string;
  onChoose: (value: string) => void;
  onClose: (refocus: boolean) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const idBase = useId();
  const [position, setPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const typed = useRef({ text: '', at: 0 });
  const [container] = useState<Element | null>(() => (typeof document === 'undefined' ? null : (anchor.current?.closest('dialog[open]') ?? document.body)));
  useDismiss(listRef, true, () => onClose(false));

  useLayoutEffect(() => {
    const trigger = anchor.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    // A fixed box is placed in the layout viewport (clientHeight, clientWidth). window.innerHeight is the
    // visual one, which on an iPad shrinks with the toolbar and the keyboard and made the list flip up
    // or land off the edge.
    const view = document.documentElement;
    const below = rect.bottom + 6 + box.height <= view.clientHeight - 8;
    setPosition({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - box.height),
      left: Math.max(8, Math.min(view.clientWidth - Math.max(box.width, rect.width) - 8, rect.left)),
      minWidth: rect.width,
    });
    list.focus({ preventScroll: true });
  }, [anchor]);

  // Bring the active option into view by scrolling the list alone. scrollIntoView also scrolls every
  // scroller around it, the page included, and on iPad that page scroll closed the list as it opened.
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop - 4;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight + 4;
  }, [active]);

  const move = (from: number, step: 1 | -1) => {
    for (let i = 1; i <= options.length; i += 1) {
      const next = (from + step * i + options.length) % options.length;
      if (!options[next]?.disabled) return next;
    }
    return from;
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChoose(option.value);
    onClose(true);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((i) => move(i, 1));
    else if (event.key === 'ArrowUp') setActive((i) => move(i, -1));
    else if (event.key === 'Home') setActive(move(-1, 1));
    else if (event.key === 'End') setActive(move(options.length, -1));
    else if (event.key === 'Enter' || event.key === ' ') choose(active);
    else if (event.key === 'Escape') {
      // Close the list, not the dialog around it.
      event.stopPropagation();
      onClose(true);
    } else if (event.key === 'Tab') onClose(false);
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at < 700 ? typed.current.text + event.key.toLowerCase() : event.key.toLowerCase(), at: now };
      const hit = options.findIndex((o, i) => !o.disabled && i !== active && o.label.toLowerCase().startsWith(typed.current.text));
      const again = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      const found = hit >= 0 ? hit : again;
      if (found >= 0) setActive(found);
    } else return;
    event.preventDefault();
  };

  if (!container) return null;
  return createPortal(
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={`${idBase}-${active}`}
      onKeyDown={onKeyDown}
      data-lenis-prevent=""
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, minWidth: position?.minWidth }}
      className="listbox-surface fixed z-popover max-h-popover min-w-popover-min overflow-y-auto overscroll-contain rounded-control p-4 outline-none"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the listbox, which owns focus
          <li
            key={option.value || '__empty'}
            id={`${idBase}-${index}`}
            data-index={index}
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled || undefined}
            onMouseMove={() => active !== index && !option.disabled && setActive(index)}
            onClick={() => choose(index)}
            className={cx(
              'flex min-h-row-compact cursor-pointer items-center gap-8 rounded-md px-8 text-body-sm transition-hover',
              index === active && !option.disabled ? 'bg-control text-ink' : 'text-ink-muted',
              selected && 'font-medium text-ink',
              option.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center text-accent-text">
              {selected ? <IconCheck size={14} stroke={2} /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.hint ? <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{option.hint}</span> : null}
          </li>
        );
      })}
    </ul>,
    container,
  );
}
