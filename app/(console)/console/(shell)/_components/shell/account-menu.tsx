'use client';

import { cx } from '@bliss/ui/lib/cx';
import { IconCash, IconDeviceDesktop, IconDeviceTablet, IconLogout, IconMoon, IconSelector, IconSun } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '@bliss/ui/hooks';
import { signOutFromConsole } from '../../../sign-in/actions';
import { type ThemePreference, setTheme } from '../../_actions/settings';

export interface AccountProps {
  name: string;
  role: string;
  photo: string | null;
  theme: ThemePreference;
  /** Folded rail: the avatar alone. */
  compact?: boolean;
}

const THEMES: { value: ThemePreference; label: string; icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'dark', label: 'Dark', icon: IconMoon },
  { value: 'system', label: 'Match this device', icon: IconDeviceDesktop },
];

/**
 * The signed-in person, and what is theirs to change: the theme, a way onto a station, and signing
 * out. A menu (arrow keys, Home, End, Escape), opening upward from the foot of the rail.
 */
export function AccountMenu({ name, role, photo, theme: initialTheme, compact }: AccountProps) {
  const [open, setOpen] = useState(false);
  const [theme, setLocalTheme] = useState(initialTheme);
  const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);
  const [, start] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = name.trim().slice(0, 2).toUpperCase();

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(menuRef, open, () => close(false));

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
    menuRef.current.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
  }, [open]);

  const chooseTheme = (next: ThemePreference) => {
    setLocalTheme(next);
    // Applied at once; the cookie follows so the next page renders in it with no flash.
    document.documentElement.dataset.theme = next;
    start(() => setTheme(next));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') close(false);
    else return;
    event.preventDefault();
  };

  const item = 'flex min-h-row-compact w-full items-center gap-8 rounded-sm px-8 text-left text-body-sm text-ink outline-offset-0 hover:bg-control focus-visible:bg-control';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`${name}, ${role}`}
        className={cx(
          'focus-ring-desk group flex min-h-control-lg w-full items-center gap-12 rounded-control text-left transition-hover hover:bg-desk-hover aria-expanded:bg-desk-hover',
          compact ? 'justify-center px-0' : 'justify-center px-0 desktop:justify-start desktop:px-8',
        )}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a staff photo, sized by CSS
          <img src={photo} alt="" className="size-control-md shrink-0 rounded-dot object-cover ring-2 ring-desk-chip shadow-chip" />
        ) : (
          <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-dot bg-desk-chip text-label font-medium text-ink shadow-chip">
            {initials}
          </span>
        )}
        <span className={cx('min-w-0 flex-1 flex-col', compact ? 'hidden' : 'hidden desktop:flex')}>
          <span className="truncate text-ui font-medium text-ink">{name}</span>
          <span className="truncate text-body-sm text-ink-subtle transition-hover group-hover:text-ink-muted">{role}</span>
        </span>
        <span aria-hidden="true" className={cx('size-row-compact shrink-0 items-center justify-center rounded-dot bg-desk-chip text-ink-subtle shadow-chip transition-hover group-hover:text-ink', compact ? 'hidden' : 'hidden desktop:flex')}>
          <IconSelector size={14} stroke={1.75} />
        </span>
        <span className="sr-only">Account and theme</span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              tabIndex={-1}
              aria-label="Account"
              onKeyDown={onKeyDown}
              style={{ bottom: position?.bottom ?? -9999, left: position?.left ?? -9999 }}
              className="fixed z-popover w-popover-min rounded-md border border-edge bg-card p-4 shadow-popover"
            >
              <div className="px-8 pb-6 pt-8">
                <p className="truncate text-body-sm font-medium text-ink">{name}</p>
                <p className="truncate text-body-sm text-ink-subtle">{role}</p>
              </div>
              <div role="group" aria-label="Theme" className="border-t border-edge pt-4">
                <p className="label-caps px-8 pb-4 pt-6 text-ink-subtle">Theme</p>
                {THEMES.map((t) => (
                  <button key={t.value} type="button" role="menuitemradio" aria-checked={theme === t.value} onClick={() => chooseTheme(t.value)} className={item}>
                    <t.icon size={16} stroke={1.5} aria-hidden="true" className="text-ink-subtle" />
                    <span className="flex-1">{t.label}</span>
                    {theme === t.value ? <span aria-hidden="true" className="size-dot rounded-dot bg-accent" /> : null}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Stations" className="mt-4 border-t border-edge pt-4">
                <Link role="menuitem" href="/floor" className={item} onClick={() => close(false)}>
                  <IconDeviceTablet size={16} stroke={1.5} aria-hidden="true" className="text-ink-subtle" />
                  Open the Floor station
                </Link>
                <Link role="menuitem" href="/counter" className={item} onClick={() => close(false)}>
                  <IconCash size={16} stroke={1.5} aria-hidden="true" className="text-ink-subtle" />
                  Open the Counter station
                </Link>
              </div>
              <form action={signOutFromConsole} className="mt-4 border-t border-edge pt-4">
                <button type="submit" role="menuitem" className={item}>
                  <IconLogout size={16} stroke={1.5} aria-hidden="true" className="text-ink-subtle" />
                  Sign out
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
