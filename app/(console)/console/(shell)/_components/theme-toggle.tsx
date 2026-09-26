'use client';

import { cx } from '@bliss/ui/lib/cx';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTransition } from 'react';
import { setTheme } from '../_actions/settings';

/** Light by default, dark available. Both themes are first class, not a filter over each other. */
export function ThemeToggle({ theme }: { theme: 'light' | 'dark' }) {
  const [, start] = useTransition();

  const handleToggle = (next: 'light' | 'dark') => {
    if (next === theme) return;
    document.documentElement.dataset.theme = next;
    start(() => setTheme(next));
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode"
      className="grid h-[32px] grid-cols-2 gap-2 rounded-dot bg-sunken/80 p-[3px] border border-hairline/60 select-none"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => handleToggle('light')}
        className={cx(
          'flex items-center justify-center gap-8 rounded-dot px-12 text-label transition-all duration-150 press-feedback outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          theme === 'light'
            ? 'bg-raised text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1),_0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-hairline/10'
            : 'text-ink-subtle hover:text-ink hover:bg-control/30',
        )}
      >
        <IconSun size={15} stroke={1.5} aria-hidden="true" />
        <span>Light</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => handleToggle('dark')}
        className={cx(
          'flex items-center justify-center gap-8 rounded-dot px-12 text-label transition-all duration-150 press-feedback outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          theme === 'dark'
            ? 'bg-raised text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1),_0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-hairline/10'
            : 'text-ink-subtle hover:text-ink hover:bg-control/30',
        )}
      >
        <IconMoon size={15} stroke={1.5} aria-hidden="true" />
        <span>Dark</span>
      </button>
    </div>
  );
}
