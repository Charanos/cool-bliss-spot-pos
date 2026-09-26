'use client';

import { IconDots } from '@tabler/icons-react';
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '../hooks';
import { cx } from '../lib/cx';
import type { ActionItem } from './action-list';
import { ICON_STROKE } from './icon';

/**
 * An overflow menu. Every gesture on the Floor and every hover action on the Console has one, so a
 * gesture is never the only route. Rendered in a portal: it floats over the pane rather than nesting
 * a surface inside it. Arrow keys, Home, End and Escape work as expected.
 */
export function OverflowMenu({
  items,
  label,
  trigger,
  size = 'md',
  align = 'end',
}: {
  items: readonly ActionItem[];
  label: string;
  trigger?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(menuRef, open, close);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const below = rect.bottom + 4 + menu.height <= window.innerHeight;
    const top = below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - menu.height);
    const left = align === 'end' ? Math.max(8, rect.right - menu.width) : Math.min(window.innerWidth - menu.width - 8, rect.left);
    setPosition({ top, left });
    menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, [open, align]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => nodes[(next + nodes.length) % nodes.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(nodes.length - 1);
    else if (event.key === 'Tab') setOpen(false);
    else return;
    event.preventDefault();
  };

  const target = size === 'lg' ? 'size-control-lg' : size === 'md' ? 'size-control-md' : 'size-control-sm';
  const safe = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cx(target, 'inline-flex shrink-0 items-center justify-center rounded-md text-ink-subtle press-feedback hover:bg-control hover:text-ink aria-expanded:bg-control aria-expanded:text-ink')}
      >
        {trigger ?? <IconDots size={size === 'sm' ? 16 : 20} stroke={ICON_STROKE} aria-hidden="true" />}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              onKeyDown={onKeyDown}
              data-lenis-prevent=""
              style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
              className="fixed z-popover min-w-popover-min rounded-md border border-edge bg-card p-4 shadow-popover"
            >
              {[safe, destructive].map((group, gi) =>
                group.length === 0 ? null : (
                  <div key={gi} className={cx(gi === 1 && safe.length > 0 && 'mt-4 border-t border-edge pt-4')}>
                    {group.map((item) => {
                      const Glyph = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          aria-disabled={item.disabled || undefined}
                          onClick={() => {
                            if (item.disabled) return;
                            setOpen(false);
                            item.onSelect();
                          }}
                          className={cx(
                            'flex min-h-row-compact w-full items-center gap-8 rounded-sm px-8 text-left text-body-sm outline-offset-0 hover:bg-control focus-visible:bg-control',
                            item.destructive ? 'text-stop' : 'text-ink',
                            item.disabled && 'text-ink-disabled',
                          )}
                        >
                          {Glyph ? <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" /> : null}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
