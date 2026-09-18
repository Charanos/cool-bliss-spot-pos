'use client';

import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

export interface ActionItem {
  key: string;
  label: string;
  icon?: TablerIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/**
 * The action sheet body: 48px rows, the destructive action last, in the Stop colour, with 16px
 * separating it from the others. docs/10 F3 and docs/06 section 6.1.
 */
export function ActionList({ items, className }: { items: readonly ActionItem[]; className?: string }) {
  const safe = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);
  const row = (item: ActionItem) => {
    const Glyph = item.icon;
    return (
      <li key={item.key}>
        <button
          type="button"
          onClick={() => !item.disabled && item.onSelect()}
          aria-disabled={item.disabled || undefined}
          data-destructive={item.destructive || undefined}
          className={cx(
            '-mx-12 flex min-h-row-floor w-[calc(100%+24px)] items-center gap-12 rounded-sm px-12 text-left text-body press-feedback hover:bg-control-hover',
            item.destructive ? 'text-stop' : 'text-ink',
            item.disabled && 'text-ink-disabled',
          )}
        >
          {Glyph ? <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" /> : null}
          <span className="min-w-0 flex-1">{item.label}</span>
          {item.hint ? <span className="shrink-0 text-body-sm text-ink-subtle">{item.hint}</span> : null}
        </button>
      </li>
    );
  };
  return (
    <div className={className}>
      <ul>{safe.map(row)}</ul>
      {destructive.length > 0 ? <ul className="mt-16">{destructive.map(row)}</ul> : null}
    </div>
  );
}
