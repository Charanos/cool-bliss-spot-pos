'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { cx } from '@bliss/ui/lib/cx';
import { BlissMark } from '@bliss/ui/components/brand';
import { IconSearch, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import type { WorkspaceLink, StationLink } from '@bliss/ui/components/console/shell';
import { formatKes, type Cents } from '@bliss/shared/money';

export interface DeskNavTonight {
  sales: Cents;
  bills: number;
  open: number;
  hours: number[];
}

export function DeskNav({
  links,
  stations,
  footer,
  tonight,
}: {
  links: WorkspaceLink[];
  stations?: StationLink[];
  footer: ReactNode;
  tonight?: DeskNavTonight;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sections: { title?: string; items: WorkspaceLink[] }[] = [];
  for (const link of links) {
    const sec = link.section;
    const last = sections[sections.length - 1];
    if (last && last.title === sec) {
      last.items.push(link);
    } else {
      sections.push({ title: sec, items: [link] });
    }
  }

  const CollapseIcon = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse;

  return (
    <aside
      data-collapsed={collapsed ? '' : undefined}
      className={cx(
        'group/nav sticky top-0 flex h-dvh shrink-0 flex-col bg-desk select-none relative z-0',
        'transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed ? 'w-[64px]' : 'w-[260px]'
      )}
    >
      {/* Brand Masthead */}
      <div className={cx(
        'flex h-[72px] shrink-0 items-center transition-all duration-300',
        collapsed ? 'justify-center px-0' : 'justify-between px-20'
      )}>
        {!collapsed ? (
          <Link href="/console/overview" className="flex items-center gap-12 group/brand min-w-0 press-feedback" title="Bliss Console">
            <div className="transition-transform duration-300 group-hover/brand:scale-105 group-active/brand:scale-95 shrink-0 text-desk-ink">
              <BlissMark size={32} />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-desk-ink leading-tight truncate">
              Cool Bliss Spot
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cx(
            'flex items-center justify-center shrink-0 rounded-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent',
            collapsed
              ? 'size-40 text-desk-muted hover:text-desk-ink hover:bg-desk-hover'
              : 'size-[28px] text-desk-muted/60 hover:text-desk-ink hover:bg-desk-hover'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon size={collapsed ? 20 : 16} stroke={1.5} />
        </button>
      </div>

      {/* Global Search */}
      {!collapsed && (
        <div className="px-12 mb-12">
          <button className="group flex h-control-sm w-full items-center gap-8 rounded-md border border-transparent bg-desk-hover px-12 text-desk-muted press-feedback hover:border-desk-muted/20 hover:text-desk-ink">
            <IconSearch size={14} stroke={1.5} aria-hidden="true" className="shrink-0" />
            <span className="flex-1 text-left truncate text-body-sm">Search</span>
            <kbd className="shrink-0 rounded-sm bg-desk px-4 font-mono text-micro text-desk-muted group-hover:text-desk-ink">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        aria-label="Workspaces"
        className={cx(
          'min-h-0 flex-1 overflow-y-auto no-scrollbar z-10 flex flex-col',
          collapsed ? 'py-8 px-0' : 'py-8 px-12'
        )}
      >
        {sections.map((group, sIndex) => (
          <div key={group.title ?? sIndex} className={cx('flex flex-col', collapsed ? 'mb-12' : 'mb-16')}>
            {sIndex > 0 && (
              collapsed ? (
                <div className="mx-auto w-[24px] h-px bg-desk-muted/20 my-12 rounded-dot" />
              ) : (
                <div className="flex items-center gap-12 px-12 pt-8 pb-8">
                  <span className="text-micro uppercase tracking-[0.15em] font-bold text-desk-muted/70 leading-none whitespace-nowrap">
                    {group.title}
                  </span>
                  <div className="flex-1 h-px bg-desk-muted/12 rounded-dot" />
                </div>
              )
            )}
            {sIndex === 0 && group.title && !collapsed && (
              <div className="px-12 pt-4 pb-8">
                <span className="text-micro uppercase tracking-[0.15em] font-bold text-desk-muted/70 leading-none">
                  {group.title}
                </span>
              </div>
            )}

            <ul className={cx('flex flex-col gap-2', collapsed ? 'items-center px-12' : '')}>
              {group.items.map((link) => {
                const active = pathname === link.href || pathname.startsWith(link.href + '/');
                const hasDot = Boolean(link.count);
                const dotColor =
                  link.countTone === 'stop' ? 'bg-stop' :
                  link.countTone === 'attention' ? 'bg-attention' :
                  'bg-desk-muted';

                return (
                  <li key={link.href} className={collapsed ? 'w-full' : ''}>
                    {collapsed ? (
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        title={link.label}
                        className={cx(
                          'relative flex items-center justify-center w-full h-control-md rounded-md transition-all duration-200 press-feedback',
                          active
                            ? 'bg-page text-ink shadow-lift ring-1 ring-desk-muted/10'
                            : 'text-desk-muted/80 hover:bg-desk-hover hover:text-desk-ink'
                        )}
                      >
                        {/* no left active bar when collapsed to keep the item centered and perfectly round */}
                        <span
                          aria-hidden="true"
                          className={cx(
                            'inline-flex size-[20px] items-center justify-center transition-all duration-200',
                            active ? 'text-accent' : ''
                          )}
                        >
                          {link.icon}
                        </span>
                        {hasDot && (
                          <span className={cx('absolute top-4 right-4 size-[6px] rounded-dot shadow-sm', dotColor)} />
                        )}
                      </Link>
                    ) : (
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={cx(
                          'group/item relative flex h-[34px] items-center gap-12 rounded-md px-12 text-[13px] font-medium transition-all duration-200 press-feedback',
                          active
                            ? 'bg-page text-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-desk-muted/10'
                            : 'text-desk-muted hover:bg-desk-hover/80 hover:text-desk-ink'
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-accent rounded-r-dot" />
                        )}
                        <span
                          aria-hidden="true"
                          className={cx(
                            'inline-flex size-[18px] shrink-0 items-center justify-center transition-all duration-200',
                            active ? 'text-accent' : 'text-desk-muted/80 group-hover/item:text-desk-ink group-hover/item:scale-110'
                          )}
                        >
                          {link.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate leading-none">{link.label}</span>
                        {link.count ? (
                          <span
                            className={cx(
                              'inline-flex items-center h-[20px] min-w-[20px] px-6 rounded-dot font-mono text-[11px] font-bold leading-none shrink-0 justify-center shadow-sm',
                              link.countTone === 'stop' ? 'bg-stop text-page ring-1 ring-stop/20' :
                              link.countTone === 'attention' ? 'bg-attention text-page ring-1 ring-attention/20' :
                              'bg-desk-muted/20 text-desk-ink ring-1 ring-desk-muted/30'
                            )}
                          >
                            {link.count}
                          </span>
                        ) : null}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Tonight Mini Card */}
        {!collapsed && tonight && (
          <div className="mt-auto px-16 pb-8 pt-16">
            <div className="relative overflow-hidden rounded-[16px] p-16 ring-1 ring-desk-muted/10 bg-gradient-to-b from-page to-desk-hover shadow-lift transition-shadow hover:shadow-key">
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-bold text-desk-muted uppercase tracking-[0.15em]">Tonight</span>
                <span className="size-[8px] rounded-dot bg-poured animate-pulse" />
              </div>
              <div className="text-[20px] font-bold text-desk-ink tracking-tight leading-none mb-4">
                {formatKes(tonight.sales, { decimals: 'whole' })}
              </div>
              <div className="text-[11px] text-desk-muted mb-12">
                {tonight.bills} {tonight.bills === 1 ? 'bill' : 'bills'} {' · '} <span className="text-desk-ink font-medium">{tonight.open} open</span>
              </div>
              <div className="h-[28px] flex items-end gap-[3px] group/chart">
                {tonight.hours.slice(-12).map((v, i, arr) => {
                  const maxVal = Math.max(...arr, 1);
                  const isMax = v === Math.max(...arr) && v > 0;
                  return (
                    <div
                      key={i}
                      className={cx('flex-1 rounded-t-[2px] transition-all duration-300', isMax ? 'bg-accent/80 group-hover/chart:bg-accent' : 'bg-desk-muted/30 group-hover/chart:bg-desk-muted/40')}
                      style={{ height: (v / maxVal * 100) + '%', minHeight: v > 0 ? 2 : 0 }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cx(
        'shrink-0 bg-transparent z-10 relative transition-all duration-300',
        collapsed ? 'px-12 pb-16' : 'px-16 pb-16'
      )}>
        {footer}
      </div>
    </aside>
  );
}