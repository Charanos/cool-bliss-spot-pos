'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import { initMotion } from '../../motion/engine';
import { pageEnter, refreshScrollTriggers, sectionReveal } from '../../motion/console';
import { LenisProvider } from '../../motion/lenis-provider';
import { BlissMark } from '../brand';

export interface WorkspaceLink {
  href: string;
  label: string;
  /** A rendered Tabler icon. Rendered on the server so the link list can cross into this client component. */
  icon: ReactNode;
  count?: number;
  countTone?: 'default' | 'attention' | 'stop';
}

/** Motion defaults once, Lenis for wheel scrolling, and page.enter on every route change. */
export function ConsoleMotionRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    initMotion();
  }, []);
  return <LenisProvider>{children}</LenisProvider>;
}

/** The content region of a Console page: page.enter on every route change. */
export function ConsolePage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pageEnter(el);
    refreshScrollTriggers();
  }, [pathname]);

  return (
    <div ref={ref} className="min-w-0 px-32 pb-56 pt-32">
      {children}
    </div>
  );
}

/** A section that reveals as it scrolls in (section.reveal). Renders a plain section otherwise. */
export function RevealSection(props: ComponentProps<'section'>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const tween = sectionReveal(el);
    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
    };
  }, []);
  return <section ref={ref} {...props} />;
}

/** The 220px rail: every workspace, one level, the current one marked by a 3px edge rather than a fill. */
export function ConsoleRail({ links, footer }: { links: WorkspaceLink[]; footer: ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-rail-console shrink-0 flex-col border-r border-hairline">
      <Link href="/console/overview" className="flex h-[64px] shrink-0 items-center gap-8 px-20">
        <BlissMark size={24} />
        <span className="text-subtitle text-ink">bliss</span>
        <span className="text-subtitle text-ink-subtle">console</span>
      </Link>
      <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto px-8 py-8" data-lenis-prevent="">
        <ul className="flex flex-col gap-2">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'relative flex h-[40px] items-center gap-12 rounded-sm px-12 text-body press-feedback',
                    active ? 'text-ink' : 'text-ink-muted hover:bg-control hover:text-ink',
                  )}
                >
                  {active ? <span aria-hidden="true" className="absolute inset-y-[8px] -left-8 w-[3px] rounded-r-sm bg-accent" /> : null}
                  <span aria-hidden="true" className={cx('inline-flex', active ? 'text-accent-text' : 'text-ink-subtle')}>
                    {link.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  {link.count ? (
                    <span className={cx('font-mono tabular text-num-sm', link.countTone === 'stop' ? 'text-stop' : link.countTone === 'attention' ? 'text-attention' : 'text-ink-subtle')}>
                      {link.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-hairline p-12">{footer}</div>
    </aside>
  );
}

export interface TabLink {
  href: string;
  label: string;
  count?: number;
}

/**
 * Route based tabs: every tab is a URL. The current tab carries a 2px underline in the accent.
 * docs/10 N2. Rendered as links, so middle click, share and back all work.
 */
export function RouteTabs({ tabs, label }: { tabs: TabLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mt-20 border-b border-hairline">
      <ul className="-mb-px flex gap-24 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative inline-flex h-[44px] items-center gap-8 whitespace-nowrap text-body press-feedback',
                  active ? 'text-ink' : 'text-ink-subtle hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count !== undefined ? <span className="font-mono tabular text-num-sm text-ink-subtle">{tab.count}</span> : null}
                {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-24 gap-y-12">
      <div className="min-w-0 flex-1">
        <h1 className="text-title-lg text-ink">{title}</h1>
        {description ? <p className="mt-4 text-body text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div> : null}
    </div>
  );
}
