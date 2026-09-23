'use client';

import { formatDate, formatTime } from '@bliss/shared/format';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { CountBadge, MetaLine, type MetaItem } from '@bliss/ui/components/working';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconBuildingStore, IconLayoutGrid } from '@tabler/icons-react';
import Link from 'next/link';
import { type ReactNode, type Ref, useEffect, useSyncExternalStore } from 'react';

/**
 * The chrome both staff surfaces wear. docs/16-responsive-and-offline.md.
 *
 * The Floor and the Counter are one product at two stations, so they share one top bar, one surface
 * switcher and one dock. What differs is what goes in them, never how they behave: a waiter who
 * moves from the floor to the counter mid-shift already knows where everything is.
 */

/* ----------------------------------------------------------- quiet chrome */

/*
 * On a phone, or a tablet held upright, the chrome steps aside while you read. Scrolling a list
 * down folds the top bar away, trims each page header to its title and turns the dock to icons;
 * scrolling up, or reaching the top, brings them back. Wider screens have the room and keep
 * everything. Scrolling inside a dialog never counts.
 */

let collapsed = false;
const collapseListeners = new Set<() => void>();

function setCollapsed(next: boolean) {
  if (collapsed === next) return;
  collapsed = next;
  for (const l of collapseListeners) l();
}

/** Whether the chrome is folded away right now. */
export function useChromeCollapsed(): boolean {
  return useSyncExternalStore(
    (l) => {
      collapseListeners.add(l);
      return () => collapseListeners.delete(l);
    },
    () => collapsed,
    () => false,
  );
}

/** Mounted once by each shell: follows scrolling anywhere in the page and folds the chrome. */
export function useQuietChrome(): void {
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 959px)');
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || !narrow.matches) return;
      if (el.closest('[role="dialog"], dialog')) return;
      const top = el.scrollTop;
      const before = last.get(el) ?? top;
      last.set(el, top);
      if (top < 24) setCollapsed(false);
      else if (top - before > 6) setCollapsed(true);
      else if (before - top > 6) setCollapsed(false);
    };
    const onWidth = () => {
      if (!narrow.matches) setCollapsed(false);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    narrow.addEventListener('change', onWidth);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      narrow.removeEventListener('change', onWidth);
      setCollapsed(false);
    };
  }, []);
}

/** Folds its content to nothing and back, height animated, so the page reflows smoothly. */
function Fold({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid transition-[grid-template-rows,opacity] duration-200 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0', className)} aria-hidden={open ? undefined : true} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ top bar */

/**
 * Three columns, so the centre stays centred without covering either side. 48px on a phone, 56 from
 * a tablet up, 40 on a short screen, and every edge that meets the frame pays back its inset.
 */
export function TopBar({ start, centre, end }: { start: ReactNode; centre: ReactNode; end: ReactNode }) {
  const folded = useChromeCollapsed();
  return (
    <header className="safe-t safe-x relative z-10 shrink-0 border-b border-rule/10 bg-page/20 backdrop-blur-glass">
      <Fold open={!folded}>
        <div className="grid h-strip-compact grid-cols-[1fr_auto_1fr] items-center gap-8 px-12 pad:h-strip pad:gap-16 pad:px-16 tablet:px-20 short:h-control-md">
          <div className="flex min-w-0 items-center gap-12 tablet:gap-16">{start}</div>
          {centre}
          <div className="flex min-w-0 items-center justify-end gap-12 tablet:gap-16">{end}</div>
        </div>
      </Fold>
    </header>
  );
}

export type Surface = 'floor' | 'counter';

const SURFACES: readonly { key: Surface; label: string; href: string; icon: TablerIcon }[] = [
  { key: 'floor', label: 'Floor', href: '/floor/tabs', icon: IconLayoutGrid },
  { key: 'counter', label: 'Counter', href: '/counter/orders', icon: IconBuildingStore },
];

/** Floor and Counter, side by side. The one you are on is marked, the other is a link. */
export function SurfaceSwitcher({ current }: { current: Surface }) {
  return (
    <nav aria-label="Surfaces" className="flex items-center gap-2 rounded-dot border border-rule-raised/30 bg-sunken/50 p-2">
      {SURFACES.map((s) => {
        const Glyph = s.icon;
        return s.key === current ? (
          <span key={s.key} aria-current="page" className="flex h-control-sm items-center gap-6 rounded-dot bg-accent/15 px-12 text-body-sm font-medium text-accent-text">
            <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
            <span>{s.label}</span>
          </span>
        ) : (
          <Link key={s.key} href={s.href} aria-label={`Switch to the ${s.label}`} className="flex h-control-sm items-center gap-6 rounded-dot px-12 text-body-sm text-ink-subtle press-feedback hover:bg-page hover:text-ink">
            <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
            <span className="hidden compact:inline">{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The time and date, from a tablet up. Rendered after hydration so server and client agree. */
export function LiveClock({ timeZone }: { timeZone?: string }) {
  const now = useNow(30_000);
  const hydrated = useHydrated();
  return (
    <div className="hidden text-right pad:block" suppressHydrationWarning>
      <div className="font-mono tabular text-body-sm font-medium text-ink">{hydrated ? formatTime(now, timeZone) : ''}</div>
      <div className="text-micro text-ink-subtle">{hydrated ? formatDate(now, timeZone) : ''}</div>
    </div>
  );
}

/* --------------------------------------------------------------------- dock */

export interface DockItem {
  href: string;
  label: string;
  icon: TablerIcon;
  /** A count on the icon: open tabs, waiting tickets. */
  badge?: number;
  badgeTone?: 'accent' | 'stop';
  /** A status on the icon when a count would say too much: the drawer, a sync problem. */
  dot?: Tone;
  dotLabel?: string;
  /** A keyboard shortcut, shown as a hint on a desktop. */
  shortcut?: string;
}

const ITEM =
  'relative flex h-dock-item min-w-dock-item flex-1 flex-col items-center justify-center gap-2 rounded-[18px] press-feedback transition-colors duration-[160ms] pad:h-dock-item-lg pad:min-w-dock-item-lg pad:flex-none pad:px-16 short:h-control-md short:flex-row short:gap-6 short:px-12 group-data-folded/dock:h-control-lg';

const IDLE = 'text-ink-muted hover:bg-control/60 hover:text-ink';
const ON = 'bg-accent/[0.18] text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-accent)_30%,transparent)]';

/**
 * A dock item. The whole box is the target: 52px on a phone, 56 from a tablet up, which clears the
 * 48px floor minimum. The one you are on sits in a soft accent pill. docs/06 section 6.1.
 */
export function DockLink({ item, active }: { item: DockItem; active: boolean }) {
  const Glyph = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.shortcut ? `${item.label} (${item.shortcut})` : undefined}
      className={cx(ITEM, active ? ON : IDLE)}
    >
      <span className="relative">
        <Glyph size={22} stroke={ICON_STROKE} aria-hidden="true" />
        {item.badge ? <CountBadge count={item.badge} tone={item.badgeTone ?? 'accent'} className="absolute -right-12 -top-6 ring-2 ring-page" /> : null}
        {item.dot ? (
          <span aria-hidden="true" className="absolute -right-4 -top-2">
            <Dot tone={item.dot} />
          </span>
        ) : null}
      </span>
      <span className="text-micro font-medium short:hidden group-data-folded/dock:hidden">
        {item.label}
        {item.badge ? <span className="sr-only">, {item.badge}</span> : null}
        {item.dot && item.dotLabel ? <span className="sr-only">, {item.dotLabel}</span> : null}
      </span>
    </Link>
  );
}

/** A dock item that acts rather than navigates, such as search. */
export function DockButton({ label, icon: Glyph, onClick, shortcut }: { label: string; icon: TablerIcon; onClick: () => void; shortcut?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={shortcut ? `${label} (${shortcut})` : undefined} className={cx(ITEM, IDLE)}>
      <Glyph size={22} stroke={ICON_STROKE} aria-hidden="true" />
      <span className="text-micro font-medium short:hidden group-data-folded/dock:hidden">{label.split(' ')[0]}</span>
    </button>
  );
}

/**
 * The dock. It floats over the page on every screen, and still sits in the flow of the shell's
 * column, so the view above it ends where it begins and nothing is ever covered.
 *
 * The page's primary action lives in it, through BaseAction, so the thing to do next is always in
 * the same place under the thumb. Below `inlineFrom` the action sits in a full width row above the
 * nav; from there up it joins the nav in one pill.
 *
 *   floor    inline from `pad`: a waiter's actions are one button
 *   counter  inline from `tablet`: settling carries an amount, and a 768 tablet needs the room
 */
/**
 * The page's action, sized to the dock rather than to the page: 48px tall (40 on a short screen),
 * the dock's own rounding, body type. Pages pass their usual buttons; the dock sets the size, so a
 * primary action reads as part of the rack instead of a slab laid on top of it.
 */
const DOCK_ACTION =
  'flex items-center gap-6 empty:hidden [&>*]:flex-1 [&_button]:h-control-lg [&_button]:rounded-[18px] [&_button]:px-20 [&_button]:text-body short:[&_button]:h-control-md';

export function Dock({ nav, actionRef, inlineFrom = 'pad', label }: { nav: ReactNode; actionRef: Ref<HTMLDivElement>; inlineFrom?: 'pad' | 'tablet'; label: string }) {
  const pad = inlineFrom === 'pad';
  const folded = useChromeCollapsed();
  return (
    <footer data-folded={folded || undefined} className="group/dock safe-b safe-x shrink-0 [--bliss-gutter-b:8px] [--bliss-gutter-x:8px] pad:[--bliss-gutter-b:12px] pad:[--bliss-gutter-x:16px] short:[--bliss-gutter-b:6px]">
      <div
        className={cx(
          'dock-surface mx-auto flex w-full max-w-[560px] flex-col gap-6 rounded-[24px] p-6',
          pad ? 'pad:w-fit pad:max-w-none pad:flex-row pad:items-center pad:gap-12' : 'pad:max-w-[640px] tablet:w-fit tablet:max-w-none tablet:flex-row tablet:items-center tablet:gap-12',
        )}
      >
        <div ref={actionRef} className={cx(DOCK_ACTION, pad ? 'pad:order-last pad:[&>*]:flex-none' : 'tablet:order-last tablet:[&>*]:flex-none')} />
        <nav aria-label={label} className={cx('flex items-center justify-between gap-2', pad ? 'pad:gap-8' : 'pad:gap-8 tablet:justify-start')}>
          {nav}
        </nav>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- page header */

/**
 * A working page's header, the same on both surfaces: the title, a pill of live facts, whatever
 * the page needs on the right, and its filters underneath. One row from a tablet held upright,
 * half the padding on a short screen.
 */
export function PageHeader({ title, facts, aside, children }: { title: ReactNode; facts?: readonly (MetaItem | null | false)[]; aside?: ReactNode; children?: ReactNode }) {
  const folded = useChromeCollapsed();
  return (
    <header className={cx('z-10 shrink-0 border-b border-rule-raised/20 bg-page/85 px-12 backdrop-blur-glass transition-[padding] duration-200 pad:px-24', folded ? 'py-8' : 'pb-12 pt-12 pad:pb-16 pad:pt-20 short:py-6')}>
      <div className="flex flex-col gap-12 pad:flex-row pad:items-center pad:justify-between pad:gap-x-24">
        <div className="flex min-w-0 flex-wrap items-center gap-x-16 gap-y-8">
          <h1 className={cx('shrink-0 whitespace-nowrap font-medium text-ink transition-[font-size] duration-200', folded ? 'text-title' : 'text-title-lg pad:text-heading short:text-title')}>{title}</h1>
          {facts && facts.some(Boolean) && !folded ? (
            <>
              <div className="hidden h-24 w-px shrink-0 bg-rule-raised/60 desktop:block" aria-hidden="true" />
              {/* One line, always: when the row is too narrow the pill drops under the title rather than folding up. */}
              <div className="flex max-w-full items-center overflow-x-auto rounded-dot border border-rule-raised/30 bg-sunken/80 px-12 py-4 no-scrollbar pad:py-6 tablet:px-16">
                <MetaLine items={facts} className="w-max whitespace-nowrap" />
              </div>
            </>
          ) : null}
        </div>
        {aside && !folded ? <div className="flex shrink-0 items-center gap-12">{aside}</div> : null}
      </div>
      {children ? (
        <Fold open={!folded}>
          <div className="mt-12 pad:mt-16 short:mt-6">{children}</div>
        </Fold>
      ) : null}
    </header>
  );
}
