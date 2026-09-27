'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import { initMotion } from '../../motion/engine';
import { pageEnter, refreshScrollTriggers } from '../../motion/console';
import { LenisProvider, useLenis } from '../../motion/lenis-provider';

export { RouteTabs, type TabLink } from './tabs';

/** Motion defaults once, Lenis for wheel scrolling inside the sheet, and page.enter on every route change. */
export function ConsoleMotionRoot({ children, scrollerId }: { children: ReactNode; scrollerId?: string }) {
  useEffect(() => {
    initMotion();
  }, []);
  return <LenisProvider wrapperId={scrollerId}>{children}</LenisProvider>;
}

/**
 * The floating sheet, docs/19 section 4: one raised surface on the sunken desk that holds the page.
 * It scrolls on its own, so the desk and its navigation stay put, and its header rides at its top.
 * The scroller's first child is what Lenis measures, so the header and the page share it.
 */
export function ConsoleSheet({ scrollerId, header, children }: { scrollerId: string; header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 justify-center py-sheet-inset pr-sheet-inset">
      <div className="sheet-scope relative flex w-full min-w-0 max-w-sheet-max flex-col overflow-hidden rounded-sheet bg-page shadow-sheet">
        <div id={scrollerId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          <div className="flex min-h-full flex-col">
            {header}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The page column: one width, one gutter, one rhythm, on every Console page. docs/19 section 4.
 * page.enter runs on each route change.
 */
export function ConsolePage({ children, scrollerId }: { children: ReactNode; scrollerId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A new page starts at its top. The sheet is the scroller, so the router's own reset (which
    // moves the window) does not reach it.
    if (scrollerId) lenis?.scrollTo(0, { immediate: true });
    pageEnter(el);
    refreshScrollTriggers();
  }, [pathname, scrollerId, lenis]);

  return (
    <div ref={ref} className="mx-auto flex w-full min-w-0 max-w-page-max flex-col gap-32 px-32 pb-72 pt-24">
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  /** The workspace the page belongs to, in capitals above the title. */
  eyebrow?: string;
  title: string;
  /** One sentence: what the page answers or lets you do. */
  description?: ReactNode;
  /** A status beside the title. */
  badge?: ReactNode;
  /** The one figure the page is about, set beside the title: stock at cost, tonight's takings. */
  aside?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * A page's header: the title, one sentence of purpose, and the page's actions. No eyebrow and no
 * ornament; the breadcrumb above already says where you are. docs/19 section 4.
 */
export function PageHeader({ eyebrow, title, description, badge, aside, actions, className }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-24">
      <header className={cx('flex flex-wrap items-end justify-between gap-x-32 gap-y-16 pb-8', className)}>
        <div className="flex min-w-0 flex-col gap-6">
          {eyebrow ? <p className="label-caps text-accent-text">{eyebrow}</p> : null}
          <div className="flex min-w-0 flex-wrap items-center gap-12">
            <h1 className="text-title-page text-balance text-ink">{title}</h1>
            {badge}
          </div>
          {description ? <p className="measure text-ui text-pretty text-ink-muted">{description}</p> : null}
        </div>
        {aside || actions ? (
          <div className="flex shrink-0 flex-wrap items-end gap-24">
            {aside ? <div className={cx('flex items-end gap-24', actions ? 'border-r border-rule pr-24' : null)}>{aside}</div> : null}
            {actions ? <div className="flex flex-wrap items-center gap-8">{actions}</div> : null}
          </div>
        ) : null}
      </header>
      <div aria-hidden="true" className="rule-fade" />
    </div>
  );
}

/** A figure beside a page title: a label in capitals over the value. Two at most. */
export function HeaderFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-4">
      <span className="label-caps text-ink-subtle">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
