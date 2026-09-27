'use client';

import { Sheet, SheetIcon } from '@bliss/ui/components/floor/sheet';
import { IconKeyboard } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

/**
 * The Counter's keyboard, for a till run with a mouse and keyboard. docs/14 section 5.
 *
 * Letters alone, because a cashier's hands are already on the keys: digits, Backspace and Enter stay
 * the tender keypad's. Nothing fires while a field has focus, or with Ctrl, Cmd or Alt held, so typing
 * a name or a reference never moves the screen.
 */

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['O'], action: 'Orders to pour' },
  { keys: ['T'], action: 'Open tabs' },
  { keys: ['S'], action: 'Quick sale' },
  { keys: ['D'], action: 'The drawer' },
  { keys: ['H'], action: 'History' },
  { keys: ['/'], action: 'Search tabs, seats and the menu' },
  { keys: ['P'], action: 'Pour the oldest ticket, on Orders' },
  { keys: ['0–9', 'Enter'], action: 'Type an amount and take it, when settling' },
  { keys: ['Alt', '1–5'], action: 'The five views, from anywhere' },
  { keys: ['?'], action: 'This list' },
  { keys: ['Esc'], action: 'Close a sheet or dialog' },
];

/** Whether a key press belongs to the page rather than to a field or a browser shortcut. */
export function isShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return false;
  return true;
}

/** Run `run` when `key` is pressed as a shortcut. The handler may change; the listener does not. */
export function useShortcut(key: string, run: () => void, enabled = true) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (!isShortcut(event) || event.key.toLowerCase() !== key.toLowerCase()) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, enabled]);
}

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard" description="For a counter run with a mouse and keyboard." leading={<SheetIcon icon={IconKeyboard} />}>
      <dl className="flex flex-col">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="flex items-center justify-between gap-16 border-t border-rule py-12 first:border-t-0">
            <dt className="text-ui text-ink">{s.action}</dt>
            <dd className="flex shrink-0 items-center gap-4">
              {s.keys.map((k) => (
                <kbd key={k} className="min-w-control-sm rounded-sm border border-hairline px-8 py-2 text-center font-mono text-num-sm text-ink">
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
