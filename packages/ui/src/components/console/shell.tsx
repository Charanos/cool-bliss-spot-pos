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
  countTone?: 'default' | 'attention' | 'stop' | 'poured' | 'info';
  section?: string;
  shortcut?: string;
}

export interface StationLink {
  href: string;
  label: string;
  icon: ReactNode;
  subtitle?: string;
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
    <div ref={ref} className="min-w-0 px-24 tablet:px-32 pb-[96px] pt-24">
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

/** The 220px rail: every workspace, grouped into operational sections, with quick station links and operator footer. */
export function ConsoleRail({
  links,
  stations,
  footer,
}: {
  links: WorkspaceLink[];
  stations?: StationLink[];
  footer: ReactNode;
}) {
  const pathname = usePathname();

  // Group links by section
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

  return (
    <aside className="sticky top-0 flex h-dvh w-rail-console shrink-0 flex-col border-r border-hairline/40 bg-raised/80 backdrop-blur-glass select-none relative overflow-hidden">
      {/* Background Subtle Ambient Spots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[120px] -left-[120px] size-[320px] rounded-full bg-accent/5 blur-[90px]" />
        <div className="absolute top-[40%] -right-[80px] size-[240px] rounded-full bg-poured/5 blur-[90px]" />
      </div>

      {/* Brand Masthead: Perfectly aligned with TopBar h-[56px] */}
      <div className="flex h-[56px] shrink-0 items-center px-20 border-b border-hairline/40 bg-transparent z-10 relative">
        <Link href="/console/overview" className="flex items-center gap-12 group min-w-0 press-feedback" title="Bliss Console">
          <div className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95 shrink-0 text-ink">
            <BlissMark size={32} />
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-subtitle font-medium tracking-tight text-ink">bliss</span>
            <span className="text-subtitle font-normal tracking-tight text-ink-subtle">console</span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto no-scrollbar py-12 z-10 flex flex-col" data-lenis-prevent="">
        {sections.map((group, sIndex) => (
          <div key={group.title ?? sIndex} className="flex flex-col px-8 mb-4 last:mb-0">
            {group.title ? (
              <div className="px-6 pb-4 pt-4 text-micro uppercase tracking-[0.12em] font-medium text-ink-subtle">
                {group.title}
              </div>
            ) : null}
            <ul className="flex flex-col gap-[2px]">
              {group.items.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex h-[36px] items-center gap-8 rounded-[8px] px-12 text-body-sm transition-all duration-150 press-feedback',
                        active
                          ? 'bg-page dark:bg-control-hover/70 text-ink font-medium shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/25 dark:ring-hairline/40 dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)]'
                          : 'text-ink-subtle hover:bg-control/80 hover:text-ink',
                      )}
                    >
                      {/* Subtle top-edge sheen on active */}
                      {active ? (
                        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[8px] bg-gradient-to-r from-transparent via-glint/50 to-transparent" />
                      ) : null}
                      {/* Icon */}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'inline-flex size-[18px] shrink-0 items-center justify-center transition-all duration-150',
                          active ? 'text-accent-text' : 'text-ink-subtle group-hover:text-ink',
                        )}
                      >
                        {link.icon}
                      </span>
                      {/* Label */}
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      {/* Count Badge */}
                      {link.count ? (
                        <span
                          className={cx(
                            'inline-flex items-center h-[18px] min-w-[18px] px-[6px] rounded-full font-mono tabular text-badge leading-none shrink-0 justify-center shadow-sm ring-1 ring-hairline/20',
                            link.countTone === 'stop'
                              ? 'bg-stop-wash text-stop'
                              : link.countTone === 'attention'
                                ? 'bg-attention/15 text-attention'
                                : link.countTone === 'poured'
                                  ? 'bg-poured-wash text-poured'
                                  : link.countTone === 'info'
                                    ? 'bg-accent-wash text-accent-text'
                                    : 'bg-control text-ink-subtle',
                          )}
                        >
                          {link.count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Stations */}
        {stations && stations.length > 0 ? (
          <div className="mt-auto border-t border-hairline/40 px-8 pt-8 pb-4">
            <p className="px-6 pb-4 pt-4 text-micro uppercase tracking-[0.12em] font-medium text-ink-subtle">
              Stations
            </p>
            <ul className="flex flex-col gap-2">
              {stations.map((st) => (
                <li key={st.href}>
                  <Link
                    href={st.href}
                    className="group flex h-[40px] items-center gap-8 rounded-[8px] px-6 hover:bg-control/60 transition-all duration-150 press-feedback"
                  >
                    {/* App-like Icon chip */}
                    <span className="inline-flex size-[24px] shrink-0 items-center justify-center rounded-[6px] bg-control/60 text-ink-subtle ring-1 ring-hairline/15 shadow-[0_1px_2px_rgba(0,0,0,0.04)] group-hover:bg-raised group-hover:text-ink transition-all duration-150">
                      {st.icon}
                    </span>
                    {/* Label */}
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink-muted group-hover:text-ink transition-colors">
                      {st.label}
                    </span>
                    {/* Elegant Pill Badge */}
                    {st.subtitle ? (
                      <span className="shrink-0 text-micro font-medium uppercase tracking-[0.06em] text-ink-subtle px-[6px] py-[2px] rounded-full bg-control ring-1 ring-hairline/20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        {st.subtitle}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>

      {/* Footer / User Profile & Controls */}
      <div className="shrink-0 border-t border-hairline/70 px-16 pt-12 pb-12 bg-transparent z-10 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-hairline/60 to-transparent" />
        {footer}
      </div>
    </aside>
  );
}

export interface TabLink {
  href: string;
  label: string;
  count?: number;
}

/**
 * Route based tabs: every tab is a URL. The current tab carries an accent highlight.
 * docs/10 N2. Rendered as links, so middle click, share and back all work.
 */
export function RouteTabs({ tabs, label }: { tabs: TabLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mt-20 flex">
      <ul className="flex items-center gap-4 rounded-full bg-control/20 p-[4px] ring-1 ring-hairline/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative inline-flex h-[32px] items-center gap-8 rounded-full px-16 text-body-sm transition-all duration-200 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-accent/50',
                  active 
                    ? 'bg-page text-ink font-medium shadow-[0_2px_8px_rgba(0,0,0,0.08),_0_0_0_1px_rgba(0,0,0,0.03)]' 
                    : 'text-ink-subtle hover:text-ink hover:bg-control/40',
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined ? (
                  <span
                    className={cx(
                      'inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-[6px] font-mono tabular text-[10px] font-bold leading-none tracking-wide transition-colors duration-200',
                      active ? 'bg-accent/10 text-accent-text' : 'bg-control/50 text-ink-subtle group-hover:bg-control/80',
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

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, badge, actions }: PageHeaderProps) {
  return (
    <div className="relative flex flex-col gap-6 pb-6">
      {eyebrow ? (
        <div className="text-micro font-mono uppercase tracking-wider text-ink-subtle/80 flex items-center gap-6">
          <span>{eyebrow}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-24 gap-y-12">
        <div className="flex items-center gap-12 min-w-0 flex-wrap">
          <h1 className="text-title-lg tablet:text-heading font-medium text-ink leading-tight tracking-tight">{title}</h1>
          {badge ? <div>{badge}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div> : null}
      </div>
      {description ? <p className="text-body-sm tablet:text-body text-ink-subtle max-w-3xl leading-relaxed">{description}</p> : null}
    </div>
  );
}
