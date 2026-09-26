'use client';

import { usePathname } from 'next/navigation';
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import { initMotion } from '../../motion/engine';
import { pageEnter, refreshScrollTriggers, sectionReveal } from '../../motion/console';
import { LenisProvider } from '../../motion/lenis-provider';

export { RouteTabs, type TabLink } from './tabs';

/** Motion defaults once, Lenis for wheel scrolling, and page.enter on every route change. */
export function ConsoleMotionRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    initMotion();
  }, []);
  return <LenisProvider>{children}</LenisProvider>;
}

/**
 * The page column: one width, one gutter, one rhythm, on every Console page. docs/19 section 4.
 * page.enter runs on each route change.
 */
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
    <div ref={ref} className="mx-auto w-full min-w-0 max-w-page-max px-32 pb-72 pt-24">
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

export interface PageHeaderProps {
  title: string;
  /** One sentence: what the page answers or lets you do. */
  description?: ReactNode;
  /** A status beside the title. */
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * A page's header: the title, one sentence of purpose, and the page's actions. No eyebrow and no
 * ornament; the breadcrumb above already says where you are. docs/19 section 4.
 */
export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <header className={cx('flex flex-wrap items-end justify-between gap-x-24 gap-y-16 pb-20', className)}>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-12">
          <h1 className="text-title-page text-balance text-ink">{title}</h1>
          {badge}
        </div>
        {description ? <p className="measure text-ui text-pretty text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div> : null}
    </header>
  );
}
