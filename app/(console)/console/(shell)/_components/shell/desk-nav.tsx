'use client';

import type { Cents } from '@bliss/shared/money';
import { BlissMark } from '@bliss/ui/components/brand';
import { Sparkline } from '@bliss/ui/components/console/sparkline';
import { AnimatedMoney } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowUpRight, IconChevronDown, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { setRailCollapsed } from '../../_actions/settings';
import { AccountMenu, type AccountProps } from './account-menu';
import { openCommandMenu } from './command-events';

export interface DeskPage {
  href: string;
  label: string;
  count?: number;
  tone?: 'attention' | 'stop';
}

export interface DeskItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** A number worth knowing: open tabs, items on hold. */
  count?: number;
  /** A count that needs action wears a tone. */
  tone?: 'attention' | 'stop';
  /** The workspace's own pages, listed under it while it is open. */
  pages?: readonly DeskPage[];
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
 * holds the page. docs/19 section 4. What is active is a chip of the sheet's own surface with an
 * accent tick, and the open workspace lists its pages beneath it on a guide line, so the desk, the
 * page tabs and the crumbs always name the same place.
 *
 * Top to bottom: the outlet and its business day with the fold control, search, the workspaces in
 * four groups, tonight's takings, then Settings and the signed-in person. Folded (the `[` key, or
 * the control), it is icons only and a workspace's pages open in a flyout beside it.
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
  // Which workspace lists its pages: the one you are in, unless another was opened by hand.
  const [opened, setOpened] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('⌘K');
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('Ctrl K');
  }, []);
  useEffect(() => setOpened(null), [pathname]);

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

  // Wide from 1280px unless folded; below that the desk is icons only, with names as tooltips.
  const folded = collapsed ? 'true' : 'below';
  const label = collapsed ? 'sr-only' : 'sr-only desktop:not-sr-only';
  const wide = collapsed ? 'hidden' : 'hidden desktop:flex';
  const current = [...groups.flatMap((g) => g.items), settings].find((i) => isActive(pathname, i.href))?.href ?? null;
  const expanded = opened ?? current;

  const ToggleIcon = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse;
  const toggleButton = (className: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={collapsed}
      aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
      title={collapsed ? 'Expand the sidebar ([)' : 'Collapse the sidebar ([)'}
      className={cx('focus-ring-desk flex size-control-sm shrink-0 items-center justify-center rounded-md text-ink-subtle transition-hover hover:bg-desk-hover hover:text-ink', className)}
    >
      <ToggleIcon size={16} stroke={1.5} aria-hidden="true" />
    </button>
  );

  return (
    <aside
      aria-label="Console"
      data-collapsed={collapsed || undefined}
      className={cx('flex h-full shrink-0 flex-col bg-desk transition-card', collapsed ? 'w-desk-nav-collapsed' : 'w-desk-nav-collapsed desktop:w-desk-nav')}
    >
      {/* The outlet, where its business day stands, and the fold control. */}
      <div className={cx('flex h-masthead shrink-0 items-center gap-8', collapsed ? 'justify-center px-12' : 'justify-center px-12 desktop:justify-between desktop:pl-16 desktop:pr-12')}>
        <Link href="/console/overview" className="focus-ring-desk flex min-w-0 items-center gap-12 rounded-md" title={venue.name}>
          <span className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-desk-chip text-ink shadow-chip swell-on-hover">
            <BlissMark size={24} />
          </span>
          <span className={cx('min-w-0 flex-col', wide)}>
            <span className="truncate text-title-card text-ink">{venue.name}</span>
            <span className="flex items-center gap-6 text-body-sm text-ink-muted">
              <span aria-hidden="true" className={cx('size-dot shrink-0 rounded-dot', venue.trading ? 'animate-breathe bg-poured' : 'bg-ink-disabled')} />
              <span className="truncate">{venue.trading ? `Trading, ${venue.day}` : `Closed, ${venue.day}`}</span>
            </span>
          </span>
        </Link>
        {toggleButton(collapsed ? 'hidden' : 'hidden desktop:flex')}
      </div>

      {/* Search and jump: a well sunk into the desk. */}
      <div className="px-12 pb-8">
        <button
          type="button"
          onClick={openCommandMenu}
          title={`Search or jump to (${shortcut})`}
          aria-label="Search or jump to"
          className={cx(
            'focus-ring-desk flex h-control-sm w-full items-center gap-8 rounded-md bg-desk-well text-body-sm text-ink-subtle shadow-well transition-hover hover:text-ink',
            collapsed ? 'justify-center px-0' : 'justify-center px-0 desktop:justify-start desktop:px-12',
          )}
        >
          <IconSearch size={16} stroke={1.5} aria-hidden="true" className="shrink-0" />
          <span className={cx('flex-1 text-left', label)}>Search or jump to</span>
          <kbd className={cx('rounded-sm bg-desk-chip px-6 font-mono text-num-sm text-ink-subtle shadow-chip', collapsed ? 'hidden' : 'hidden desktop:inline')}>{shortcut}</kbd>
        </button>
      </div>

      <nav aria-label="Workspaces" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-12 pb-16 no-scrollbar fade-foot" data-lenis-prevent="">
        {groups.map((group, i) => (
          <div key={group.label} className={i === 0 ? 'pt-8' : 'pt-16'}>
            <div className={cx('items-center gap-8 px-8 pb-6', collapsed ? 'hidden' : 'hidden desktop:flex')}>
              <p className="label-caps shrink-0 text-ink-subtle">{group.label}</p>
              <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
            </div>
            <div aria-hidden="true" className={cx('mx-12 mb-8 h-px bg-hairline', i === 0 ? 'hidden' : collapsed ? 'block' : 'block desktop:hidden')} />
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Workspace
                    item={item}
                    pathname={pathname}
                    folded={folded}
                    labelClass={label}
                    expanded={expanded === item.href}
                    onExpand={(open) => setOpened(open ? item.href : current === item.href ? '' : null)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {/* Tonight rides at the foot of the list and scrolls with it, so it never hides a workspace. */}
        {tonight ? <TonightCard tonight={tonight} className={cx('mt-auto shrink-0', collapsed ? 'hidden' : 'hidden desktop:flex')} /> : null}
      </nav>

      <div className="flex shrink-0 flex-col gap-8 px-12 pb-12 pt-4">
        <div className="flex flex-col gap-2">
          <Workspace item={settings} pathname={pathname} folded={folded} labelClass={label} expanded={expanded === settings.href} onExpand={(open) => setOpened(open ? settings.href : '')} />
          <div className={cx('justify-center', collapsed ? 'flex' : 'hidden')}>{toggleButton('')}</div>
        </div>
        <div className="border-t border-hairline pt-8">
          <AccountMenu {...account} compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function CountPill({ count, tone, className }: { count: number; tone?: 'attention' | 'stop'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-count min-w-count shrink-0 items-center justify-center rounded-pill px-6 font-mono tabular text-num-sm',
        tone === 'stop' ? 'bg-stop text-stop-ink' : tone === 'attention' ? 'bg-attention text-accent-ink' : 'bg-desk-chip text-ink-muted shadow-chip',
        className,
      )}
    >
      {count}
      <span className="sr-only">{tone ? ' need attention' : ''}</span>
    </span>
  );
}

/**
 * One workspace on the desk. Open, its pages hang beneath it on a guide line; folded, they open in a
 * flyout beside the icon, on hover or from the keyboard.
 */
function Workspace({
  item,
  pathname,
  folded,
  labelClass,
  expanded,
  onExpand,
}: {
  item: DeskItem;
  pathname: string;
  folded: 'true' | 'below';
  labelClass: string;
  expanded: boolean;
  onExpand: (open: boolean) => void;
}) {
  const active = isActive(pathname, item.href);
  const pages = item.pages && item.pages.length > 1 ? item.pages : null;
  const listId = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const [flyout, setFlyout] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | null>(null);
  const wideOnly = folded === 'true' ? 'hidden' : 'hidden desktop:flex';

  const showFlyout = () => {
    if (!pages || (folded === 'below' && window.matchMedia('(min-width: 1280px)').matches)) return;
    if (timer.current) window.clearTimeout(timer.current);
    const r = anchor.current?.getBoundingClientRect();
    if (r) setFlyout({ top: r.top, left: r.right + 8 });
  };
  const hideFlyout = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlyout(null), 120);
  };

  return (
    <div ref={anchor} onMouseEnter={showFlyout} onMouseLeave={hideFlyout}>
      <div className="relative flex items-center">
        <Link
          href={item.href}
          aria-current={active && pathname === item.href ? 'page' : undefined}
          title={item.label}
          onFocus={showFlyout}
          onKeyDown={(e) => e.key === 'Escape' && setFlyout(null)}
          className={cx(
            'focus-ring-desk group relative flex h-nav-row min-w-0 flex-1 items-center gap-12 rounded-md text-ui transition-hover',
            folded === 'true' ? 'justify-center px-0' : 'justify-center px-0 desktop:justify-start desktop:px-12',
            active ? 'bg-desk-active font-medium text-ink shadow-chip' : 'text-ink-muted hover:bg-desk-hover hover:text-ink',
          )}
        >
          {active ? <span aria-hidden="true" className="absolute left-0 top-1/2 h-16 w-4 -translate-y-1/2 rounded-r-sm bg-accent" /> : null}
          <span aria-hidden="true" className={cx('relative inline-flex size-16 shrink-0 items-center justify-center transition-hover', active ? 'text-accent-text' : 'text-ink-subtle group-hover:scale-110 group-hover:text-ink')}>
            {item.icon}
            {item.count && item.tone ? <span className={cx('absolute -right-4 -top-4 size-dot rounded-dot ring-2 ring-desk', item.tone === 'stop' ? 'bg-stop' : 'bg-attention', folded === 'true' ? 'block' : 'block desktop:hidden')} /> : null}
          </span>
          <span className={cx('min-w-0 flex-1 truncate', labelClass)}>{item.label}</span>
          {item.count ? <CountPill count={item.count} tone={item.tone} className={cx(wideOnly, pages ? 'mr-24' : null)} /> : null}
        </Link>
        {pages ? (
          <button
            type="button"
            onClick={() => onExpand(!expanded)}
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={expanded ? `Hide the pages in ${item.label}` : `Show the pages in ${item.label}`}
            className={cx('focus-ring-desk absolute right-4 size-row-compact items-center justify-center rounded-sm text-ink-subtle transition-hover hover:bg-desk-hover hover:text-ink', wideOnly)}
          >
            <IconChevronDown size={14} stroke={1.75} aria-hidden="true" className={cx('transition-hover', expanded ? 'rotate-180' : null)} />
          </button>
        ) : null}
      </div>

      {pages ? (
        <div id={listId} className={cx('grid transition-card', folded === 'true' ? 'hidden' : 'hidden desktop:grid', expanded ? 'grid-rows-open' : 'grid-rows-shut')}>
          <ul className="ml-20 flex min-h-0 flex-col gap-2 overflow-hidden border-l border-hairline pl-8" aria-label={`${item.label} pages`}>
            {pages.map((p, i) => {
              const here = pathname === p.href || pathname.startsWith(`${p.href}/`);
              return (
                <li key={p.href} className={i === 0 ? 'pt-4' : i === pages.length - 1 ? 'pb-4' : undefined}>
                  <Link
                    href={p.href}
                    aria-current={here ? 'page' : undefined}
                    tabIndex={expanded ? undefined : -1}
                    className={cx(
                      'focus-ring-desk relative flex h-nav-sub items-center gap-8 rounded-sm px-8 text-body-sm transition-hover',
                      here ? 'font-medium text-ink' : 'text-ink-subtle hover:bg-desk-hover hover:text-ink',
                    )}
                  >
                    {here ? <span aria-hidden="true" className="absolute -left-8 top-1/2 h-12 w-2 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-accent" /> : null}
                    <span className="min-w-0 flex-1 truncate">{p.label}</span>
                    {p.count ? <span className={cx('font-mono tabular text-num-sm', p.tone === 'stop' ? 'text-stop' : p.tone === 'attention' ? 'text-attention' : 'text-ink-subtle')}>{p.count}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {flyout && pages && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="menu"
              tabIndex={-1}
              aria-label={item.label}
              onKeyDown={(e) => e.key === 'Escape' && setFlyout(null)}
              onMouseEnter={() => timer.current && window.clearTimeout(timer.current)}
              onMouseLeave={hideFlyout}
              style={{ top: flyout.top, left: flyout.left }}
              className="fixed z-popover w-popover-min rounded-md border border-edge bg-card p-4 shadow-popover"
            >
              <p className="label-caps px-8 pb-4 pt-6 text-ink-subtle">{item.label}</p>
              {pages.map((p) => {
                const here = pathname === p.href || pathname.startsWith(`${p.href}/`);
                return (
                  <Link
                    key={p.href}
                    role="menuitem"
                    href={p.href}
                    onClick={() => setFlyout(null)}
                    className={cx('flex min-h-row-compact items-center gap-8 rounded-sm px-8 text-body-sm transition-hover hover:bg-control focus-visible:bg-control', here ? 'font-medium text-ink' : 'text-ink-muted')}
                  >
                    <span className="flex-1">{p.label}</span>
                    {p.count ? <span className={cx('font-mono tabular text-num-sm', p.tone === 'stop' ? 'text-stop' : p.tone === 'attention' ? 'text-attention' : 'text-ink-subtle')}>{p.count}</span> : null}
                  </Link>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Tonight's takings as they stand: the settled figure, the shape of the night by hour with its peak
 * in accent, and what is still open. It gives way first when the screen is short.
 */
function TonightCard({ tonight, className }: { tonight: Tonight; className?: string }) {
  return (
    <Link href="/console/overview" className={cx('focus-ring-desk group flex-col gap-8 rounded-card p-16 tonight-surface transition-hover hover:shadow-card-hover', className)}>
      <span className="flex items-center justify-between gap-8">
        <span className="flex items-center gap-6">
          <span className="label-caps text-ink-subtle">{tonight.label}</span>
          {tonight.label === 'Tonight' ? <span aria-hidden="true" className="size-dot rounded-dot bg-poured animate-breathe" /> : null}
        </span>
        <IconArrowUpRight size={14} stroke={1.5} aria-hidden="true" className="text-ink-subtle transition-hover nudge-on-hover group-hover:text-ink" />
      </span>
      <AnimatedMoney value={tonight.netSales} size="num-lg" animation="metric.count" fromZeroOnMount decimals="whole" />
      <Sparkline values={tonight.byHour} label={tonight.peakHour ? `Sales by hour, busiest at ${tonight.peakHour}` : 'Sales by hour'} highlight="peak" />
      <span className="flex items-center justify-between gap-8 text-body-sm text-ink-muted">
        <span className="tabular">
          {tonight.bills} {tonight.bills === 1 ? 'bill' : 'bills'}
        </span>
        <span className="tabular font-medium text-ink">{tonight.openTabs} open</span>
      </span>
    </Link>
  );
}
