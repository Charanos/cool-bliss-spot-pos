'use client';

import { isCounted } from '@bliss/shared/availability';
import type { AvailabilityState } from '@bliss/shared/domain';
import { type Cents, formatKes } from '@bliss/shared/money';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { FloorDialog } from '@bliss/ui/components/floor/sheet';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowRight, IconPlus, IconReceipt2, IconSearch, IconUser, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGrid, useOpenTabs, useOutlet } from '@/lib/pos/queries';
import { haystack, normalise, score } from '@/lib/pos/search-match';

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

const MAX_ITEMS = 24;
const MAX_QUERY = 60;

/**
 * The station search, the same on the Floor and the Counter: a field in the top bar (an icon on a
 * phone or a tablet upright) that opens a dialog in the middle of the screen. It finds open tabs by
 * table, waiter, tab number or name, named seats, and anything on the menu with its price and how many
 * are in. On a tab or a quick sale, an item is one tap from being added. Ctrl K, Cmd K or / opens it;
 * arrows move, Enter chooses, Escape closes. A query is words, in any order, ignoring accents and
 * apostrophes, so "daniels 750" finds Jack Daniel's 750ml.
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
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('⌘K');
  }, []);

  const openSearch = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => {
    setQuery('');
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('bliss:search', openSearch);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('bliss:search', openSearch);
      window.removeEventListener('keydown', onKey);
    };
  }, [openSearch]);

  const { results, moreItems } = useMemo<{ results: Result[]; moreItems: number }>(() => {
    const words = normalise(query.slice(0, MAX_QUERY)).split(' ').filter(Boolean);
    const out: Result[] = [];
    const openTabs = tabs ?? [];
    const tabHref = (id: string) => `/${surface}/tabs/${id}`;
    const tabRows: { row: Result; score: number }[] = [];
    for (const t of openTabs) {
      const s = words.length === 0 ? 1 : score(words, haystack(t.label, t.table?.label, t.waiterName, t.tab.name, `tab ${t.tab.tabNumber}`, `${t.tab.tabNumber}`));
      if (s === 0) continue;
      tabRows.push({
        score: s,
        row: {
          kind: 'tab',
          key: `tab-${t.tab.id}`,
          title: t.label,
          meta: [t.waiterName, `Tab ${t.tab.tabNumber}`, t.seats.length === 1 ? '1 seat' : `${t.seats.length} seats`].filter(Boolean).join(' · '),
          total: t.total,
          href: tabHref(t.tab.id),
        },
      });
    }
    tabRows.sort((a, b) => b.score - a.score);
    for (const r of tabRows) out.push(r.row);
    if (words.length === 0) return { results: out.slice(0, 6), moreItems: 0 };
    for (const t of openTabs) {
      for (const seat of t.seats) {
        if (!seat.label || score(words, haystack(seat.label)) === 0) continue;
        out.push({ kind: 'seat', key: `seat-${seat.id}`, title: seat.label, meta: `Seat ${seat.seatNo} · ${t.label}`, href: tabHref(t.tab.id) });
      }
    }
    const scored: { tile: NonNullable<typeof grid>['tiles'][number]; score: number }[] = [];
    for (const tile of grid?.tiles ?? []) {
      const s = score(words, haystack(tile.name, tile.categoryName));
      if (s > 0) scored.push({ tile, score: s });
    }
    // Best fit first; what can be sold before what is finished; then the menu's own order.
    scored.sort((a, b) => b.score - a.score || Number(a.tile.state === 'finished') - Number(b.tile.state === 'finished') || a.tile.sort - b.tile.sort);
    for (const { tile } of scored.slice(0, MAX_ITEMS)) {
      out.push({ kind: 'item', key: `item-${tile.variantId}`, variantId: tile.variantId, title: tile.name, meta: tile.categoryName, price: tile.price, state: tile.state, left: isCounted(tile.qtyAvailable) ? Math.max(0, Math.floor(tile.qtyAvailable)) : -1 });
    }
    return { results: out, moreItems: Math.max(0, scored.length - MAX_ITEMS) };
  }, [query, tabs, grid, surface]);

  // Only what can be chosen takes part in the arrow keys: an item with nowhere to go is information.
  const choosable = useMemo(() => results.filter((r) => r.kind !== 'item' || (target && r.state !== 'finished')), [results, target]);
  const activeKey = choosable[Math.min(active, Math.max(0, choosable.length - 1))]?.key;

  // The chosen row stays in view as the arrows move.
  useEffect(() => {
    if (!open || !activeKey) return;
    list.current?.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeKey]);

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
    // A word being composed (a keyboard that builds characters) is not a command yet.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') setActive((i) => (choosable.length ? (i + 1) % choosable.length : 0));
    else if (event.key === 'ArrowUp') setActive((i) => (choosable.length ? (i - 1 + choosable.length) % choosable.length : 0));
    else if (event.key === 'Enter') choose(choosable[Math.min(active, choosable.length - 1)]);
    else return;
    event.preventDefault();
  };

  const q = query.trim();
  return (
    <>
      {/* Narrow: an icon in the bar. */}
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search tabs, seats and the menu"
        aria-haspopup="dialog"
        className="flex size-control-md items-center justify-center rounded-md text-ink-muted press-feedback hover:bg-control hover:text-ink tablet:hidden"
      >
        <IconSearch size={20} stroke={ICON_STROKE} aria-hidden="true" />
      </button>

      {/* Wide: the field, in the bar. It opens the dialog; the typing happens there. */}
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search tabs, seats and the menu"
        aria-haspopup="dialog"
        className="hidden h-control-sm w-search items-center gap-8 rounded-pill border border-rule-raised/40 bg-control px-12 text-left transition-hover hover:border-rule-raised tablet:flex desktop:w-search-wide"
      >
        <IconSearch size={15} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
        <span className="min-w-0 flex-1 truncate text-body-sm text-ink-subtle">Search</span>
        <kbd className="hidden shrink-0 font-mono text-micro text-ink-subtle mouse:inline">{shortcut}</kbd>
      </button>

      <FloorDialog open={open} onClose={close} onClosed={reset} title="Search" hideTitle flush width="lg">
        <div className="flex h-control-lg items-center gap-12 border-b border-rule-raised/40 px-16">
          <IconSearch size={18} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
          <input
            data-autofocus
            type="text"
            inputMode="search"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeKey ? `${listId}-${activeKey}` : undefined}
            aria-label="Search tabs, seats and the menu"
            placeholder="A drink, a table, a waiter, a seat"
            maxLength={MAX_QUERY}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
          />
          {query ? (
            <button type="button" onClick={() => { setQuery(''); setActive(0); }} aria-label="Clear the search" className="flex size-control-sm shrink-0 items-center justify-center rounded-dot text-ink-subtle hover:bg-control hover:text-ink">
              <IconX size={16} stroke={ICON_STROKE} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div ref={list} id={listId} role="listbox" aria-label="Results" className="h-search-results overflow-y-auto overscroll-contain p-8">
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-16 text-center">
              <p className="text-body font-medium text-ink">{q ? `Nothing matches "${q}"` : 'No tabs open'}</p>
              <p className="text-body-sm text-ink-muted">{q ? 'Try fewer words, a table, a waiter, a seat name or a drink.' : 'Type a drink to see its price and how many are in.'}</p>
            </div>
          ) : (
            GROUPS.map((group) => {
              const rows = results.filter((r) => r.kind === group.kind);
              if (rows.length === 0) return null;
              return (
                <div key={group.kind} role="group" aria-label={group.label} className="pb-4">
                  <p className="label-caps flex items-center justify-between px-12 pb-4 pt-8 text-ink-subtle">
                    <span>{group.kind === 'tab' && !q ? 'Open now' : group.label}</span>
                    {group.kind === 'item' && target ? <span className="text-label normal-case text-accent-text">{target.label}</span> : null}
                  </p>
                  {rows.map((r) => (
                    <ResultRow
                      key={r.key}
                      id={`${listId}-${r.key}`}
                      result={r}
                      active={r.key === activeKey}
                      target={target}
                      onChoose={() => choose(r)}
                      onHover={() => {
                        const i = choosable.findIndex((c) => c.key === r.key);
                        if (i >= 0) setActive(i);
                      }}
                    />
                  ))}
                  {group.kind === 'item' && moreItems > 0 ? <p className="px-12 pb-4 pt-8 text-body-sm text-ink-subtle">{moreItems} more. Add a word to narrow it down.</p> : null}
                </div>
              );
            })
          )}
        </div>

        <p className="hidden items-center gap-12 border-t border-rule-raised/40 px-16 py-8 font-mono text-micro text-ink-subtle mouse:flex">
          <span>↑ ↓ to move</span>
          <span>Enter to choose</span>
          <span>Esc to close</span>
        </p>
      </FloorDialog>
    </>
  );
}

function StockWords({ state, left }: { state: AvailabilityState; left: number }) {
  if (state === 'finished') return <span className="rounded-pill bg-sunken px-8 py-2 text-micro text-ink-muted">Finished</span>;
  if (left < 0) return null;
  if (state === 'last_few' || state === 'low') return <span className="rounded-pill bg-low/15 px-8 py-2 font-mono text-micro text-low">{left} left</span>;
  return <span className="font-mono tabular text-micro text-ink-subtle">{left} in stock</span>;
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
        <StockWords state={r.state} left={r.left} />
        <span className={cx('font-mono tabular text-num-sm', r.state === 'finished' ? 'text-ink-subtle' : 'text-ink')}>{r.price ? formatKes(r.price, { decimals: 'whole' }) : 'No price'}</span>
      </span>
    ) : (
      <IconArrowRight size={14} stroke={ICON_STROKE} className="text-ink-subtle" />
    );
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the field, which keeps focus
    <div
      id={id}
      data-key={r.key}
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
