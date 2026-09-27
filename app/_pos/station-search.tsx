'use client';

import type { AvailabilityState } from '@bliss/shared/domain';
import { type Cents, formatKes } from '@bliss/shared/money';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { useDismiss, useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowRight, IconPlus, IconReceipt2, IconSearch, IconUser, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGrid, useOpenTabs, useOutlet } from '@/lib/pos/queries';

/* ------------------------------------------------------------ where an item goes */

type ItemTarget = { label: string; add: (variantId: string) => void };
let itemTarget: ItemTarget | null = null;
const targetListeners = new Set<() => void>();

/**
 * A page that can take an item from search says so while it is open: a Floor tab ("Add to Table 4,
 * seat 2") or the Counter's quick sale. Without one, items in search show their price and whether
 * they are in, and nothing more.
 */
export function useSearchTarget(label: string | null, add: (variantId: string) => void) {
  const latest = useRef(add);
  latest.current = add;
  useEffect(() => {
    if (!label) return undefined;
    const mine: ItemTarget = { label, add: (id) => latest.current(id) };
    itemTarget = mine;
    targetListeners.forEach((l) => l());
    return () => {
      if (itemTarget === mine) itemTarget = null;
      targetListeners.forEach((l) => l());
    };
  }, [label]);
}

function useItemTarget(): ItemTarget | null {
  return useSyncExternalStore(
    (l) => {
      targetListeners.add(l);
      return () => targetListeners.delete(l);
    },
    () => itemTarget,
    () => null,
  );
}

/** Open the search from anywhere: a shortcut, a dock button, an empty state. */
export function openStationSearch() {
  window.dispatchEvent(new Event('bliss:search'));
}

/* ------------------------------------------------------------------ the search */

type Result =
  | { kind: 'tab'; key: string; title: string; meta: string; total: Cents; href: string }
  | { kind: 'seat'; key: string; title: string; meta: string; href: string }
  | { kind: 'item'; key: string; variantId: string; title: string; meta: string; price: Cents | null; state: AvailabilityState; left: number };

const GROUPS: { kind: Result['kind']; label: string }[] = [
  { kind: 'tab', label: 'Open tabs' },
  { kind: 'seat', label: 'Named seats' },
  { kind: 'item', label: 'On the menu' },
];

/**
 * The station search, the same on the Floor and the Counter: a field in the top bar (an icon on a
 * phone or a tablet upright) whose results drop down beneath it. It finds open tabs by table, waiter,
 * tab number or name, named seats, and anything on the menu with its price and whether it is in. On a
 * tab or a quick sale, an item is one tap from being added. Ctrl K, Cmd K or / opens it; arrows move,
 * Enter chooses, Escape closes.
 */
export function StationSearch({ surface }: { surface: 'floor' | 'counter' }) {
  const router = useRouter();
  const outlet = useOutlet();
  const now = useNow(60_000);
  const tabs = useOpenTabs();
  const grid = useGrid(now, outlet?.timezone);
  const target = useItemTarget();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const barInput = useRef<HTMLInputElement>(null);
  const panelInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('⌘K');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    barInput.current?.blur();
  }, []);
  useDismiss(wrap, open, close);

  const focusField = useCallback(() => {
    setOpen(true);
    // The bar's own field on a wide screen; the panel's on a narrow one, where the bar has an icon.
    requestAnimationFrame(() => {
      const bar = barInput.current;
      if (bar && bar.offsetParent !== null) bar.focus();
      else panelInput.current?.focus();
    });
  }, []);

  useEffect(() => {
    const onOpen = () => focusField();
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusField();
      }
    };
    window.addEventListener('bliss:search', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('bliss:search', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [focusField]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    const list = tabs ?? [];
    const tabHref = (id: string) => `/${surface}/tabs/${id}`;
    const matches = (...fields: (string | number | null | undefined)[]) => fields.some((f) => f !== null && f !== undefined && String(f).toLowerCase().includes(q));
    for (const t of list) {
      if (q && !matches(t.label, t.table?.label, t.waiterName, t.tab.name, `tab ${t.tab.tabNumber}`)) continue;
      out.push({
        kind: 'tab',
        key: `tab-${t.tab.id}`,
        title: t.label,
        meta: [t.waiterName, `Tab ${t.tab.tabNumber}`, t.seats.length === 1 ? '1 seat' : `${t.seats.length} seats`].filter(Boolean).join(' · '),
        total: t.total,
        href: tabHref(t.tab.id),
      });
    }
    if (!q) return out.slice(0, 6);
    for (const t of list) {
      for (const seat of t.seats) {
        if (!seat.label || !seat.label.toLowerCase().includes(q)) continue;
        out.push({ kind: 'seat', key: `seat-${seat.id}`, title: seat.label, meta: `Seat ${seat.seatNo} · ${t.label}`, href: tabHref(t.tab.id) });
      }
    }
    const items = (grid?.tiles ?? []).filter((tile) => matches(tile.name, tile.categoryName)).slice(0, 8);
    for (const tile of items) {
      out.push({ kind: 'item', key: `item-${tile.variantId}`, variantId: tile.variantId, title: tile.name, meta: tile.categoryName, price: tile.price, state: tile.state, left: tile.qtyAvailable });
    }
    return out;
  }, [query, tabs, grid, surface]);

  // Only what can be chosen takes part in the arrow keys: an item with nowhere to go is information.
  const choosable = results.filter((r) => r.kind !== 'item' || (target && r.state !== 'finished'));
  const choose = (r: Result | undefined) => {
    if (!r) return;
    if (r.kind === 'item') {
      if (!target || r.state === 'finished') return;
      target.add(r.variantId);
      close();
      return;
    }
    router.push(r.href);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((i) => (choosable.length ? (i + 1) % choosable.length : 0));
    else if (event.key === 'ArrowUp') setActive((i) => (choosable.length ? (i - 1 + choosable.length) % choosable.length : 0));
    else if (event.key === 'Enter') choose(choosable[active]);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  const activeKey = choosable[active]?.key;
  const field = (ref: React.RefObject<HTMLInputElement | null>, className: string) => (
    <input
      ref={ref}
      type="search"
      role="combobox"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={open && activeKey ? `${listId}-${activeKey}` : undefined}
      aria-label="Search tabs, seats and the menu"
      placeholder="Search"
      value={query}
      onFocus={() => setOpen(true)}
      onChange={(e) => {
        setQuery(e.target.value);
        setActive(0);
        setOpen(true);
      }}
      onKeyDown={onKeyDown}
      className={cx('min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden', className)}
    />
  );

  return (
    <div ref={wrap} className="relative flex items-center">
      {/* Narrow: an icon in the bar. */}
      <button
        type="button"
        onClick={() => (open ? close() : focusField())}
        aria-label="Search tabs, seats and the menu"
        className="flex size-control-md items-center justify-center rounded-md text-ink-muted press-feedback hover:bg-control hover:text-ink tablet:hidden"
      >
        <IconSearch size={20} stroke={ICON_STROKE} aria-hidden="true" />
      </button>

      {/* Wide: the field itself, in the bar. */}
      <label
        className={cx(
          'hidden h-control-sm w-search items-center gap-8 rounded-pill border px-12 transition-hover tablet:flex desktop:w-search-wide',
          open ? 'border-accent/40 bg-raised ring-2 ring-accent/15' : 'border-rule-raised/40 bg-control hover:border-rule-raised',
        )}
      >
        <IconSearch size={15} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
        {field(barInput, '')}
        {query ? (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear the search" className="flex size-20 shrink-0 items-center justify-center rounded-dot text-ink-subtle hover:bg-control-hover hover:text-ink">
            <IconX size={13} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 font-mono text-micro text-ink-subtle mouse:inline">{shortcut}</kbd>
        )}
      </label>

      {open ? (
        <div
          className={cx(
            'listbox-surface sheet-rise z-popover flex flex-col overflow-hidden rounded-sheet',
            // Narrow: under the bar, the width of the screen. Wide: under the field.
            'fixed inset-x-12 top-search-drop tablet:absolute tablet:inset-x-auto tablet:left-0 tablet:top-full tablet:mt-8 tablet:w-search-panel',
          )}
        >
          <div className="flex h-control-md items-center gap-8 border-b border-rule-raised/30 px-12 tablet:hidden">
            <IconSearch size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
            {field(panelInput, 'text-body')}
            <button type="button" onClick={close} aria-label="Close the search" className="flex size-control-sm items-center justify-center rounded-dot text-ink-subtle hover:bg-control hover:text-ink">
              <IconX size={16} stroke={ICON_STROKE} aria-hidden="true" />
            </button>
          </div>

          <div id={listId} role="listbox" aria-label="Results" className="max-h-search-results overflow-y-auto overscroll-contain p-6">
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-16 py-24 text-center">
                <p className="text-body font-medium text-ink">{query.trim() ? `Nothing matches "${query.trim()}"` : 'No tabs open'}</p>
                <p className="text-body-sm text-ink-muted">{query.trim() ? 'Try a table, a waiter, a seat name or a drink.' : 'Type a drink to see its price and whether it is in.'}</p>
              </div>
            ) : (
              GROUPS.map((group) => {
                const rows = results.filter((r) => r.kind === group.kind);
                if (rows.length === 0) return null;
                return (
                  <div key={group.kind} role="group" aria-label={group.label} className="pb-4">
                    <p className="label-caps flex items-center justify-between px-12 pb-4 pt-8 text-ink-subtle">
                      <span>{group.kind === 'tab' && !query.trim() ? 'Open now' : group.label}</span>
                      {group.kind === 'item' && target ? <span className="text-label normal-case text-accent-text">{target.label}</span> : null}
                    </p>
                    {rows.map((r) => (
                      <ResultRow key={r.key} id={`${listId}-${r.key}`} result={r} active={r.key === activeKey} target={target} onChoose={() => choose(r)} onHover={() => {
                        const i = choosable.findIndex((c) => c.key === r.key);
                        if (i >= 0) setActive(i);
                      }} />
                    ))}
                  </div>
                );
              })
            )}
          </div>

          <p className="hidden items-center gap-12 border-t border-rule-raised/30 px-16 py-8 font-mono text-micro text-ink-subtle mouse:flex">
            <span>↑ ↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({ id, result: r, active, target, onChoose, onHover }: { id: string; result: Result; active: boolean; target: ItemTarget | null; onChoose: () => void; onHover: () => void }) {
  const actionable = r.kind !== 'item' || (Boolean(target) && r.state !== 'finished');
  const icon: ReactNode =
    r.kind === 'tab' ? <IconReceipt2 size={16} stroke={ICON_STROKE} /> : r.kind === 'seat' ? <IconUser size={16} stroke={ICON_STROKE} /> : actionable ? <IconPlus size={16} stroke={ICON_STROKE} /> : <IconSearch size={16} stroke={ICON_STROKE} />;
  const trailing =
    r.kind === 'tab' ? (
      <span className="font-mono tabular text-num-sm text-ink">{formatKes(r.total, { decimals: 'whole' })}</span>
    ) : r.kind === 'item' ? (
      <span className="flex items-center gap-8">
        {r.state === 'finished' ? (
          <span className="rounded-pill bg-sunken px-8 py-2 text-micro text-ink-muted">Finished</span>
        ) : r.state === 'last_few' || r.state === 'low' ? (
          <span className="rounded-pill bg-low/15 px-8 py-2 font-mono text-micro text-low">{r.left} left</span>
        ) : null}
        <span className={cx('font-mono tabular text-num-sm', r.state === 'finished' ? 'text-ink-subtle' : 'text-ink')}>{r.price ? formatKes(r.price, { decimals: 'whole' }) : 'No price'}</span>
      </span>
    ) : (
      <IconArrowRight size={14} stroke={ICON_STROKE} className="text-ink-subtle" />
    );
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the field, which keeps focus
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={actionable ? undefined : true}
      onMouseMove={actionable ? onHover : undefined}
      onClick={actionable ? onChoose : undefined}
      className={cx('flex min-h-row items-center gap-12 rounded-control px-8 py-6 transition-hover', actionable ? 'cursor-pointer' : 'cursor-default', active ? 'bg-accent-wash' : actionable ? 'hover:bg-control/60' : null)}
    >
      <span aria-hidden="true" className={cx('flex size-control-sm shrink-0 items-center justify-center rounded-md', active ? 'bg-accent text-accent-ink' : 'bg-control text-ink-muted')}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate text-body-sm font-medium', r.kind === 'item' && r.state === 'finished' ? 'text-ink-subtle' : 'text-ink')}>{r.title}</span>
        <span className="truncate text-label text-ink-muted">{r.meta}</span>
      </span>
      <span className="shrink-0">{trailing}</span>
    </div>
  );
}
