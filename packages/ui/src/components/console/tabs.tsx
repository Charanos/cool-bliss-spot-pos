'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { cx } from '../../lib/cx';
import { useUrlState } from './url-state';

export interface TabLink {
  href: string;
  label: string;
  count?: number;
  /** A tab whose count needs attention shows it in the attention tone. */
  attention?: boolean;
  /** A count that needs action now, such as a message that could not sync. */
  stop?: boolean;
}

/** Whether a path is inside a tab. Longest match wins, so /trade/bills does not light up /trade. */
function activeHref(pathname: string, tabs: readonly TabLink[]): string | null {
  let best: string | null = null;
  for (const tab of tabs) {
    if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
      if (!best || tab.href.length > best.length) best = tab.href;
    }
  }
  return best;
}

/**
 * A workspace's views, as links: every view is a URL, so middle click, share and back all work.
 * Underline tabs on one hairline: the active view has a 2px ink underline. docs/19 section 4.
 */
export function RouteTabs({ tabs, label, className }: { tabs: readonly TabLink[]; label: string; className?: string }) {
  const pathname = usePathname();
  const current = activeHref(pathname, tabs);
  return (
    <nav aria-label={label} className={cx('border-b border-rule', className)}>
      <ul className="-mb-px flex items-center gap-24 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const active = tab.href === current;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex h-control-md items-center gap-6 border-b-2 text-body-sm transition-hover',
                  active ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:border-hairline hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count !== undefined ? <span className={cx('font-mono tabular text-num-sm', tab.attention ? 'text-attention' : 'text-ink-subtle')}>{tab.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A workspace's pages as pills at the head of the page: a track on the band, the page you are on
 * a raised chip of the card's surface, each with its count. Links, so every page is a URL, with
 * arrow keys moving between them.
 */
export function PillTabs({ tabs, label, className }: { tabs: readonly TabLink[]; label: string; className?: string }) {
  const pathname = usePathname();
  const current = activeHref(pathname, tabs);
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    refs.current[(index + step + tabs.length) % tabs.length]?.focus();
  };
  return (
    <nav aria-label={label} className={cx('max-w-full overflow-x-auto no-scrollbar', className)}>
      <ul className="inline-flex items-center gap-2 rounded-pill bg-band-strong p-4 shadow-well">
        {tabs.map((tab, i) => {
          const active = tab.href === current;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                ref={(el) => {
                  refs.current[i] = el;
                }}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cx(
                  'inline-flex h-control-sm items-center gap-8 rounded-pill px-16 text-body-sm transition-hover',
                  active ? 'bg-card font-medium text-ink shadow-chip' : 'text-ink-muted hover:bg-card hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count ? (
                  <span
                    className={cx(
                      'inline-flex h-count min-w-count items-center justify-center rounded-pill px-6 font-mono tabular text-num-sm',
                      tab.stop ? 'bg-stop text-stop-ink' : tab.attention ? 'bg-attention text-accent-ink' : active ? 'bg-accent-wash text-accent-text' : 'bg-band-strong text-ink-subtle',
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/**
 * Views inside one page, kept in the URL (`?view=`) so a view is shareable and survives a reload.
 * The tabs pattern done properly: a tablist, tabs with aria-selected, arrow keys and Home and End
 * move, and only the selected tab is in the tab order. Render the matching panel with TabPanel.
 */
export function Tabs<T extends string>({
  items,
  param = 'view',
  fallback,
  label,
  idBase,
  className,
}: {
  items: readonly TabItem<T>[];
  param?: string;
  fallback: T;
  label: string;
  idBase: string;
  className?: string;
}) {
  const url = useUrlState();
  const raw = url.get(param);
  const value = (items.find((i) => i.value === raw)?.value ?? fallback) as T;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (next: T) => url.set({ [param]: next === fallback ? null : next });

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const move = event.key === 'ArrowRight' ? (index >= last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index <= 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (move === null) return;
    event.preventDefault();
    const item = items[move]!;
    select(item.value);
    refs.current[move]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cx('flex items-center gap-24 border-b border-rule', className)}>
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              '-mb-px inline-flex h-control-md items-center gap-6 border-b-2 text-body-sm transition-hover',
              selected ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="font-mono tabular text-num-sm text-ink-subtle">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The current view's value, read from the same URL parameter the Tabs write. */
export function useTabValue<T extends string>(items: readonly { value: T }[], fallback: T, param = 'view'): T {
  const url = useUrlState();
  const raw = url.get(param);
  return (items.find((i) => i.value === raw)?.value ?? fallback) as T;
}

export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}
