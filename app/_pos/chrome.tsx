'use client';

import { formatTime } from '@bliss/shared/format';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { CountBadge, MetaLine, type MetaItem } from '@bliss/ui/components/working';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconBuildingStore, IconCloudCheck, IconCloudOff, IconCloudUpload, IconLayoutDashboard, IconLayoutGrid } from '@tabler/icons-react';
import { switchTo } from '@/lib/pos/session';
import Link from 'next/link';
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';

/**
 * The chrome both staff surfaces wear. docs/16-responsive-and-offline.md.
 *
 * The Floor and the Counter are one product at two stations, so they share one top bar, one surface
 * switcher and one dock. What differs is what goes in them, never how they behave: a waiter who
 * moves from the floor to the counter mid-shift already knows where everything is.
 */

/* ------------------------------------------------------------------ top bar */

/**
 * Three columns, so the centre stays centred without covering either side. 48px on a phone, 56 from
 * a tablet up, 40 on a short screen, and every edge that meets the frame pays back its inset.
 */
export function TopBar({ start, centre, end }: { start: ReactNode; centre: ReactNode; end: ReactNode }) {
  return (
    <header data-topbar="" className="safe-t safe-x relative z-bar shrink-0 border-b border-rule/10 bg-page/20 backdrop-blur-glass">
      <div className="grid h-strip-compact grid-cols-[1fr_auto_1fr] items-center gap-8 px-12 pad:h-strip pad:gap-16 pad:px-16 tablet:px-20 short:h-control-md">
        <div className="flex min-w-0 items-center gap-12 tablet:gap-16">{start}</div>
        {centre}
        <div className="flex min-w-0 items-center justify-end gap-12 tablet:gap-16">{end}</div>
      </div>
    </header>
  );
}

export type Surface = 'floor' | 'counter';

const SURFACES: readonly { key: Surface; label: string; icon: TablerIcon }[] = [
  { key: 'floor', label: 'Floor', icon: IconLayoutGrid },
  { key: 'counter', label: 'Counter', icon: IconBuildingStore },
];

/**
 * Floor and Counter, side by side, and the Console for a manager or owner. The one you are on is
 * marked; the others take you there as yourself: signed straight in when your role belongs there,
 * or to its PIN screen when it does not. Never as whoever that surface last had signed in.
 */
export function SurfaceSwitcher({ current, console: withConsole = false }: { current: Surface; console?: boolean }) {
  const [opening, setOpening] = useState<Surface | 'console' | null>(null);
  const go = (to: Surface | 'console') => {
    setOpening(to);
    void switchTo(to);
  };
  const idle = 'flex h-control-sm items-center gap-6 rounded-dot px-12 text-body-sm text-ink-subtle press-feedback hover:bg-page hover:text-ink';
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
          <button key={s.key} type="button" onClick={() => go(s.key)} disabled={opening !== null} aria-label={`Switch to the ${s.label}`} className={cx(idle, opening === s.key && 'animate-breathe')}>
            <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
            <span className="hidden compact:inline">{s.label}</span>
          </button>
        );
      })}
      {withConsole ? (
        <button type="button" onClick={() => go('console')} disabled={opening !== null} aria-label="Switch to the Console" className={cx(idle, opening === 'console' && 'animate-breathe')}>
          <IconLayoutDashboard size={16} stroke={ICON_STROKE} aria-hidden="true" />
          <span className="hidden desktop:inline">Console</span>
        </button>
      ) : null}
    </nav>
  );
}

/** The time and date, from a tablet up. Rendered after hydration so server and client agree. */
/**
 * The time, as a station shows it: the time alone on a tablet, the time over a short date ("Sat 27
 * Sep") on a laptop, nothing on a phone, where the header needs the room.
 */
export function LiveClock({ timeZone }: { timeZone?: string }) {
  const now = useNow(30_000);
  const hydrated = useHydrated();
  const parts = hydrated ? new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).formatToParts(now) : [];
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = hydrated ? `${part('weekday')} ${part('day')} ${part('month')}` : '';
  return (
    <div className="hidden flex-col items-end leading-none pad:flex" suppressHydrationWarning>
      <span className="font-mono tabular text-body-sm font-medium text-ink">{hydrated ? formatTime(now, timeZone) : ''}</span>
      <span className="mt-2 hidden text-micro text-ink-subtle desktop:block">{day}</span>
    </div>
  );
}

const LINK_STATE: Record<'synced' | 'sending' | 'offline' | 'unreachable', { icon: TablerIcon; tone: string; label: (held: number) => string; short: (held: number) => string | null }> = {
  synced: { icon: IconCloudCheck, tone: 'text-ink-subtle', label: () => 'Everything has reached the server', short: () => null },
  sending: { icon: IconCloudUpload, tone: 'text-info', label: (n) => `Back online, sending ${n} ${n === 1 ? 'order' : 'orders'}`, short: () => 'Sending' },
  offline: { icon: IconCloudOff, tone: 'text-low', label: (n) => `Offline, ${n} ${n === 1 ? 'order' : 'orders'} held on this device`, short: (n) => (n > 0 ? `Offline · ${n}` : 'Offline') },
  unreachable: { icon: IconCloudOff, tone: 'text-low', label: () => 'No connection. Orders are saved on this device.', short: () => 'Offline' },
};

/**
 * What a station is standing on, in one pill at the right of the top bar: the drawer on the Counter
 * (a link to it), then the link to the server as an icon that only takes words when something is
 * wrong. Synced is a quiet cloud with a tick, never a stray dot.
 */
export function StationStatus({
  link,
  heldOrders,
  drawer,
}: {
  link: 'synced' | 'sending' | 'offline' | 'unreachable';
  heldOrders: number;
  drawer?: { href: string; tone: Tone; short: string; long: string };
}) {
  const state = LINK_STATE[link];
  const Glyph = state.icon;
  const short = state.short(heldOrders);
  return (
    <div className="flex h-control-sm shrink-0 items-center rounded-pill border border-rule-raised/30 bg-sunken/60">
      {drawer ? (
        <>
          <Link
            href={drawer.href}
            aria-label={drawer.long}
            title={drawer.long}
            className={cx('flex h-full items-center gap-8 rounded-l-pill pl-12 pr-8 text-body-sm press-feedback transition-hover hover:bg-control', drawer.tone === 'low' ? 'text-low' : 'text-ink-muted hover:text-ink')}
          >
            <Dot tone={drawer.tone} />
            <span className="hidden whitespace-nowrap tablet:inline">{drawer.short}</span>
          </Link>
          <span aria-hidden="true" className="h-16 w-px bg-rule-raised/50" />
        </>
      ) : null}
      <span role="status" aria-live="polite" aria-label={state.label(heldOrders)} title={state.label(heldOrders)} className={cx('flex h-full items-center gap-6 px-12 text-body-sm', state.tone)}>
        <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
        {short ? <span className="whitespace-nowrap">{short}</span> : null}
      </span>
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
  'relative flex h-dock-item min-w-dock-item flex-1 flex-col items-center justify-center gap-2 rounded-sheet press-feedback transition-hover pad:h-dock-item-lg pad:min-w-dock-item-lg pad:flex-none pad:px-16 short:h-control-md short:flex-row short:gap-6 short:px-12';

const IDLE = 'text-ink-muted hover:bg-control/60 hover:text-ink';
const ON = 'bg-accent/[0.18] text-accent ring-1 ring-inset ring-accent/30';

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
      <span className="text-micro font-medium short:hidden">
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
      <span className="text-micro font-medium short:hidden">{label.split(' ')[0]}</span>
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
  'flex items-center gap-6 empty:hidden [&>*]:flex-1 [&_button]:h-control-lg [&_button]:rounded-sheet [&_button]:px-20 [&_button]:text-body short:[&_button]:h-control-md';

export function Dock({ nav, actionRef, inlineFrom = 'pad', label }: { nav: ReactNode; actionRef: Ref<HTMLDivElement>; inlineFrom?: 'pad' | 'tablet'; label: string }) {
  const pad = inlineFrom === 'pad';
  // The dock's height, for notices to rise from just above it (notices.tsx). It changes with the
  // page's action and the orientation, so it is measured rather than assumed.
  const footer = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = footer.current;
    const root = document.documentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => root.style.setProperty('--bliss-dock-h', `${Math.round(el.getBoundingClientRect().height)}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--bliss-dock-h');
    };
  }, []);
  return (
    <footer ref={footer} className="safe-b safe-x shrink-0 [--bliss-gutter-b:8px] [--bliss-gutter-x:8px] pad:[--bliss-gutter-b:12px] pad:[--bliss-gutter-x:16px] short:[--bliss-gutter-b:6px]">
      <div
        className={cx(
          'dock-surface mx-auto flex w-full max-w-[560px] flex-col gap-6 rounded-sheet p-6',
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
export function PageHeader({
  title,
  facts,
  aside,
  rule = true,
  children,
}: {
  title: ReactNode;
  facts?: readonly (MetaItem | null | false)[];
  aside?: ReactNode;
  /** False when a row of figures opens the page: the figures belong with the header, so the rule goes under them (FiguresRow). */
  rule?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={cx('z-10 shrink-0 border-b bg-page/85 px-12 pb-12 pt-12 backdrop-blur-glass pad:px-24 pad:pb-16 pad:pt-20 short:py-6', rule ? 'border-rule-raised/20' : 'border-transparent')}>
      <div className="flex flex-col gap-12 pad:flex-row pad:items-center pad:justify-between pad:gap-x-24">
        <div className="flex min-w-0 flex-wrap items-center gap-x-16 gap-y-8">
          <h1 className="shrink-0 whitespace-nowrap text-title-lg font-medium text-ink pad:text-heading short:text-title">{title}</h1>
          {facts && facts.some(Boolean) ? (
            <>
              <div className="hidden h-24 w-px shrink-0 bg-rule-raised/60 desktop:block" aria-hidden="true" />
              {/* One line, always: when the row is too narrow the pill drops under the title rather than folding up. */}
              <div className="flex max-w-full items-center overflow-x-auto rounded-dot border border-rule-raised/30 bg-sunken/80 px-12 py-4 no-scrollbar pad:py-6 tablet:px-16">
                <MetaLine items={facts} className="w-max whitespace-nowrap" />
              </div>
            </>
          ) : null}
        </div>
        {aside ? <div className="flex shrink-0 items-center gap-12">{aside}</div> : null}
      </div>
      {children ? <div className="mt-12 pad:mt-16 short:mt-6">{children}</div> : null}
    </header>
  );
}

/**
 * A row of figures that opens a page, under a header without its own rule: the rule sits beneath
 * the figures, so the header and its numbers read as one block and the working list starts after.
 */
export function FiguresRow({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={cx('border-b border-rule-raised/30 pb-16 tablet:pb-24', className)}>
      {children}
    </section>
  );
}
