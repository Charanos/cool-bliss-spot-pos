'use client';

import { Segmented } from '@bliss/ui/components/choice';
import { useTransition } from 'react';
import { setTheme } from '../_actions';

/** Light by default, dark available. Both themes are first class, not a filter over each other. */
export function ThemeToggle({ theme }: { theme: 'light' | 'dark' }) {
  const [, start] = useTransition();
  return (
    <Segmented
      label="Theme"
      size="sm"
      value={theme}
      onChange={(next) => {
        document.documentElement.dataset.theme = next;
        start(() => setTheme(next));
      }}
      options={[
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  );
}
