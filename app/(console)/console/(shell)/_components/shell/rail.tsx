'use client';

import { BlissMark } from '@bliss/ui/components/brand';
import { cx } from '@bliss/ui/lib/cx';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState, useTransition } from 'react';
import { setRailCollapsed } from '../../_actions/settings';
import { AccountMenu, type AccountProps } from './account-menu';
import { openCommandMenu } from './command-events';

export interface RailItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** A number worth knowing: open tabs, items on hold. */
  count?: number;
  /** A count that needs action wears a tone and a dot: holds are attention, unsynced orders stop. */
  tone?: 'attention' | 'stop';
}

export interface RailGroup {
  label: string;
  items: readonly RailItem[];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The Console rail. docs/19 section 4.2. Venue first: the outlet and its business day, then search,
 * the workspaces in four groups named for the job, Settings, and the account. Flat on one tonal step
 * off the page, with one hairline; no glass, no gradients, no glow.
 *
 * It folds to an icon rail (the `[` key, or the control at its foot), remembered per browser, and
 * folds itself below 1280px, where the tables need the width.
 */
export function Rail({
  venue,
  groups,
  settings,
  account,
  initialCollapsed,
}: {
  venue: { name: string; day: string; trading: boolean };
  groups: readonly RailGroup[];
  settings: RailItem;
  account: AccountProps;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, start] = useTransition();
  // The shortcut is the platform's: Command on a Mac, Control elsewhere. Read after mount, so the
  // server and the first client render agree.
  const [shortcut, setShortcut] = useState('⌘K');
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('Ctrl K');
  }, []);

  // The cookie is saved outside the state update: an updater must stay pure, and React refuses a
  // transition started from inside one.
  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    start(() => setRailCollapsed(next));
  }, [collapsed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Labels show from 1280px unless folded; below that the rail is icons only, with names as tooltips.
  const label = collapsed ? 'sr-only' : 'sr-only desktop:not-sr-only';

  return (
    <aside
      aria-label="Console"
      data-collapsed={collapsed || undefined}
      className={cx('sticky top-0 z-rail flex h-dvh shrink-0 flex-col border-r border-rule bg-rail transition-card', collapsed ? 'w-rail-collapsed' : 'w-rail-collapsed desktop:w-rail-console')}
    >
      {/* Venue: the outlet and where its business day stands. Aligned with the top bar. */}
      <div className="flex h-bar shrink-0 items-center gap-12 border-b border-rule px-20">
        <Link href="/console/overview" className="flex min-w-0 items-center gap-12 rounded-md" title={venue.name}>
          <span className="shrink-0 text-ink">
            <BlissMark size={24} />
          </span>
          <span className={cx('min-w-0 flex-col', collapsed ? 'hidden' : 'hidden desktop:flex')}>
            <span className="truncate text-title-card text-ink">{venue.name}</span>
            <span className="flex items-center gap-6 text-body-sm text-ink-muted">
              <span aria-hidden="true" className={cx('size-dot shrink-0 rounded-dot', venue.trading ? 'animate-breathe bg-poured' : 'bg-ink-disabled')} />
              <span className="truncate">{venue.trading ? `Trading · ${venue.day}` : `Closed · ${venue.day}`}</span>
            </span>
          </span>
        </Link>
      </div>

      {/* Search and jump. */}
      <div className="px-12 pt-12">
        <button
          type="button"
          onClick={openCommandMenu}
          title={`Search or jump to (${shortcut})`}
          className="flex h-control-sm w-full items-center gap-8 rounded-md border border-edge bg-card px-8 text-body-sm text-ink-subtle transition-hover hover:border-edge-strong hover:text-ink"
        >
          <IconSearch size={16} stroke={1.5} aria-hidden="true" className="shrink-0" />
          <span className={cx('flex-1 text-left', label)}>Search or jump to</span>
          <kbd className={cx('font-mono text-num-sm text-ink-subtle', collapsed ? 'hidden' : 'hidden desktop:inline')}>{shortcut}</kbd>
        </button>
      </div>

      <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto px-12 pb-12 no-scrollbar" data-lenis-prevent="">
        {groups.map((group) => (
          <div key={group.label} className="pt-16">
            <p className={cx('label-caps px-8 pb-6 text-ink-subtle', collapsed ? 'hidden' : 'hidden desktop:block')}>{group.label}</p>
            <div aria-hidden="true" className={cx('mx-8 mb-8 h-px bg-rule', collapsed ? 'block' : 'block desktop:hidden')} />
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <RailLink item={item} active={isActive(pathname, item.href)} labelClass={label} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-rule px-12 py-12">
        <RailLink item={settings} active={isActive(pathname, settings.href)} labelClass={label} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand the sidebar ([)' : 'Collapse the sidebar ([)'}
          className="hidden h-rail-item items-center gap-12 rounded-md px-8 text-ui text-ink-muted transition-hover hover:bg-rail-hover hover:text-ink desktop:flex"
        >
          {collapsed ? <IconLayoutSidebarLeftExpand size={16} stroke={1.5} aria-hidden="true" /> : <IconLayoutSidebarLeftCollapse size={16} stroke={1.5} aria-hidden="true" />}
          <span className={label}>{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <AccountMenu {...account} compact={collapsed} />
      </div>
    </aside>
  );
}

function RailLink({ item, active, labelClass, collapsed }: { item: RailItem; active: boolean; labelClass: string; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cx(
        'group relative flex h-rail-item items-center gap-12 rounded-md px-8 text-ui transition-hover',
        active ? 'bg-rail-active font-medium text-ink' : 'text-ink-muted hover:bg-rail-hover hover:text-ink',
      )}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-6 -left-12 w-2 rounded-r-sm bg-accent" /> : null}
      <span aria-hidden="true" className={cx('relative inline-flex size-16 shrink-0 items-center justify-center', active ? 'text-accent-text' : 'text-ink-subtle group-hover:text-ink')}>
        {item.icon}
        {/* Folded, a count that needs action still shows as a dot on the icon. */}
        {item.count && item.tone ? <span className={cx('absolute -right-2 -top-2 size-dot rounded-dot', item.tone === 'stop' ? 'bg-stop' : 'bg-attention', collapsed ? 'block' : 'block desktop:hidden')} /> : null}
      </span>
      <span className={cx('min-w-0 flex-1 truncate', labelClass)}>{item.label}</span>
      {item.count ? (
        <span className={cx('items-center gap-6 font-mono tabular text-num-sm', collapsed ? 'hidden' : 'hidden desktop:inline-flex', item.tone === 'stop' ? 'text-stop' : item.tone === 'attention' ? 'text-attention' : 'text-ink-subtle')}>
          {item.tone ? <span aria-hidden="true" className={cx('size-dot rounded-dot', item.tone === 'stop' ? 'bg-stop' : 'bg-attention')} /> : null}
          {item.count}
          <span className="sr-only">{item.tone ? ' need attention' : ''}</span>
        </span>
      ) : null}
    </Link>
  );
}
