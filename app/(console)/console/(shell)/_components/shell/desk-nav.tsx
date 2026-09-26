'use client';

import type { Cents } from '@bliss/shared/money';
import { BlissMark } from '@bliss/ui/components/brand';
import { Sparkline } from '@bliss/ui/components/console/sparkline';
import { AnimatedMoney } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowUpRight, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState, useTransition } from 'react';
import { setRailCollapsed } from '../../_actions/settings';
import { AccountMenu, type AccountProps } from './account-menu';
import { openCommandMenu } from './command-events';

export interface DeskItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** A number worth knowing: open tabs, items on hold. */
  count?: number;
  /** A count that needs action wears a tone and a dot. */
  tone?: 'attention' | 'stop';
}

export interface DeskGroup {
  label: string;
  items: readonly DeskItem[];
}

export interface Tonight {
  /** "Tonight" while the business day is trading, "Last night" after it closes. */
  label: string;
  netSales: Cents;
  bills: number;
  openTabs: number;
  byHour: readonly number[];
  peakHour: string | null;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The desk: the sunken ground the Console's navigation sits on, beside the one floating sheet that
 * holds the page. docs/19 section 4. It has no surface of its own and no edge; what is active is a
 * chip of the sheet's own surface, raised by a hair, so the eye reads "this is where the sheet is".
 *
 * Top to bottom: the outlet and its business day, search, the workspaces in four groups named for
 * the job, tonight's takings as they stand, then Settings, the fold and the signed-in person.
 * It folds to icons (the `[` key, or the control at its foot), remembered per browser, and folds
 * itself below 1280px, where the tables need the width.
 */
export function DeskNav({
  venue,
  groups,
  settings,
  account,
  tonight,
  initialCollapsed,
}: {
  venue: { name: string; day: string; trading: boolean };
  groups: readonly DeskGroup[];
  settings: DeskItem;
  account: AccountProps;
  tonight: Tonight | null;
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

  // Labels show from 1280px unless folded; below that the desk is icons only, with names as tooltips.
  const label = collapsed ? 'sr-only' : 'sr-only desktop:not-sr-only';
  const wide = collapsed ? 'hidden' : 'hidden desktop:flex';

  return (
    <aside
      aria-label="Console"
      data-collapsed={collapsed || undefined}
      className={cx('flex h-full shrink-0 flex-col bg-desk transition-card', collapsed ? 'w-desk-nav-collapsed' : 'w-desk-nav-collapsed desktop:w-desk-nav')}
    >
      {/* The outlet, and where its business day stands. Level with the sheet's header. */}
      <div className={cx('flex h-bar shrink-0 items-center', collapsed ? 'justify-center px-8' : 'justify-center px-8 desktop:justify-start desktop:px-16')}>
        <Link href="/console/overview" className="flex min-w-0 items-center gap-12 rounded-md" title={venue.name}>
          <span className="flex size-control-sm shrink-0 items-center justify-center rounded-md bg-desk-active text-ink shadow-chip">
            <BlissMark size={24} />
          </span>
          <span className={cx('min-w-0 flex-col', wide)}>
            <span className="truncate text-title-card text-ink">{venue.name}</span>
            <span className="flex items-center gap-6 text-body-sm text-ink-muted">
              <span aria-hidden="true" className={cx('size-dot shrink-0 rounded-dot', venue.trading ? 'animate-breathe bg-poured' : 'bg-ink-disabled')} />
              <span className="truncate">{venue.trading ? `Trading · ${venue.day}` : `Closed · ${venue.day}`}</span>
            </span>
          </span>
        </Link>
      </div>

      {/* Search and jump: a well sunk into the desk. */}
      <div className={cx('pb-8 pt-4', collapsed ? 'px-8' : 'px-8 desktop:px-12')}>
        <button
          type="button"
          onClick={openCommandMenu}
          title={`Search or jump to (${shortcut})`}
          className={cx(
            'flex h-control-sm w-full items-center gap-8 rounded-md bg-desk-well text-body-sm text-ink-subtle shadow-well transition-hover hover:text-ink',
            collapsed ? 'justify-center px-0' : 'justify-center px-0 desktop:justify-start desktop:px-8',
          )}
        >
          <IconSearch size={16} stroke={1.5} aria-hidden="true" className="shrink-0" />
          <span className={cx('flex-1 text-left', label)}>Search or jump to</span>
          <kbd className={cx('rounded-sm bg-desk-active px-4 font-mono text-num-sm text-ink-subtle shadow-chip', collapsed ? 'hidden' : 'hidden desktop:inline')}>{shortcut}</kbd>
        </button>
      </div>

      <nav aria-label="Workspaces" className={cx('min-h-0 flex-1 overflow-y-auto pb-12 no-scrollbar', collapsed ? 'px-8' : 'px-8 desktop:px-12')} data-lenis-prevent="">
        {groups.map((group, i) => (
          <div key={group.label} className={i === 0 ? 'pt-8' : 'pt-20'}>
            <p className={cx('label-caps px-8 pb-6 text-ink-subtle', collapsed ? 'hidden' : 'hidden desktop:block')}>{group.label}</p>
            <div aria-hidden="true" className={cx('mx-8 mb-8 h-px bg-hairline', i === 0 ? 'hidden' : collapsed ? 'block' : 'block desktop:hidden')} />
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <DeskLink item={item} active={isActive(pathname, item.href)} labelClass={label} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {tonight ? <TonightCard tonight={tonight} className={cx('mx-12 mb-8', wide)} /> : null}

      <div className={cx('flex flex-col gap-2 pb-12 pt-4', collapsed ? 'px-8' : 'px-8 desktop:px-12')}>
        <DeskLink item={settings} active={isActive(pathname, settings.href)} labelClass={label} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand the sidebar ([)' : 'Collapse the sidebar ([)'}
          className={cx(
            'hidden h-rail-item items-center gap-12 rounded-md text-ui text-ink-muted transition-hover hover:bg-desk-hover hover:text-ink desktop:flex',
            collapsed ? 'justify-center px-0' : 'px-8',
          )}
        >
          {collapsed ? <IconLayoutSidebarLeftExpand size={16} stroke={1.5} aria-hidden="true" /> : <IconLayoutSidebarLeftCollapse size={16} stroke={1.5} aria-hidden="true" />}
          <span className={label}>{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <div className="mt-6">
          <AccountMenu {...account} compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function DeskLink({ item, active, labelClass, collapsed }: { item: DeskItem; active: boolean; labelClass: string; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cx(
        'group relative flex h-rail-item items-center gap-12 rounded-md text-ui transition-hover',
        collapsed ? 'justify-center px-0' : 'justify-center px-0 desktop:justify-start desktop:px-8',
        active ? 'bg-desk-active font-medium text-ink shadow-chip' : 'text-ink-muted hover:bg-desk-hover hover:text-ink',
      )}
    >
      <span aria-hidden="true" className={cx('relative inline-flex size-16 shrink-0 items-center justify-center', active ? 'text-accent-text' : 'text-ink-subtle group-hover:text-ink')}>
        {item.icon}
        {/* Folded, a count that needs action still shows as a dot on the icon. */}
        {item.count && item.tone ? <span className={cx('absolute -right-2 -top-2 size-dot rounded-dot', item.tone === 'stop' ? 'bg-stop' : 'bg-attention', collapsed ? 'block' : 'block desktop:hidden')} /> : null}
      </span>
      <span className={cx('min-w-0 flex-1 truncate', labelClass)}>{item.label}</span>
      {item.count ? (
        <span
          className={cx(
            'items-center gap-6 font-mono tabular text-num-sm',
            collapsed ? 'hidden' : 'hidden desktop:inline-flex',
            item.tone === 'stop' ? 'text-stop' : item.tone === 'attention' ? 'text-attention' : 'text-ink-subtle',
          )}
        >
          {item.tone ? <span aria-hidden="true" className={cx('size-dot rounded-dot', item.tone === 'stop' ? 'bg-stop' : 'bg-attention')} /> : null}
          {item.count}
          <span className="sr-only">{item.tone ? ' need attention' : ''}</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Tonight's takings as they stand, on the desk: the settled figure, the shape of the night by hour,
 * and what is still open. A well in the desk, not a card: it is the desk's own reading, and the
 * Overview is one click away for the rest.
 */
function TonightCard({ tonight, className }: { tonight: Tonight; className?: string }) {
  return (
    <Link href="/console/overview" className={cx('group flex-col gap-8 rounded-card bg-desk-well p-12 shadow-well transition-hover hover:bg-desk-active', className)}>
      <span className="flex items-center justify-between gap-8">
        <span className="label-caps text-ink-subtle">{tonight.label}</span>
        <IconArrowUpRight size={14} stroke={1.5} aria-hidden="true" className="text-ink-subtle transition-hover group-hover:text-ink" />
      </span>
      <AnimatedMoney value={tonight.netSales} size="num-lg" animation="metric.count" fromZeroOnMount decimals="whole" />
      <Sparkline values={tonight.byHour} label={tonight.peakHour ? `Sales by hour, busiest at ${tonight.peakHour}` : 'Sales by hour'} highlight="peak" />
      <span className="flex items-center justify-between gap-8 text-body-sm text-ink-muted">
        <span className="tabular">
          {tonight.bills} {tonight.bills === 1 ? 'bill' : 'bills'}
        </span>
        <span className="tabular">{tonight.openTabs} open</span>
      </span>
    </Link>
  );
}
