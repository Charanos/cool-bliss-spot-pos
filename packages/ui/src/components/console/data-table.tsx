'use client';

import { IconArrowDown, IconArrowUp, IconChevronDown, IconDownload, IconLayoutGrid, IconLayoutRows, IconSearch, IconSelector, IconX, IconCheck } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../hooks';
import { cx } from '../../lib/cx';
import { tableRowsEnter } from '../../motion/console';
import type { ActionItem } from '../action-list';
import { FilterChips } from '../choice';
import { EmptyState } from '../feedback';
import { Switch } from '../fields';
import { Button } from '../button';
import { ICON_STROKE } from '../icon';
import { OverflowMenu } from '../menu';
import { useDismiss } from '../../hooks';
import { createPortal } from 'react-dom';
import { downloadCsv, exportFilename, toCsv } from './csv';
import { useUrlState } from './url-state';

export interface Column<Row> {
  key: string;
  header: string;
  /** A CSS grid track: '120px', 'minmax(200px, 2fr)'. */
  width: string;
  align?: 'left' | 'right';
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => number | string | bigint | null;
  csv?: (row: Row) => string | number | null;
  /** Hidden from the column menu and always shown. */
  fixed?: boolean;
  /** Let the cell wrap instead of truncating, for text whose whole value matters, such as a reason. */
  wrap?: boolean;
  /** In the CSV only: a detail the screen shows inside another cell. */
  exportOnly?: boolean;
}

export type FilterDef<Row> =
  | { kind: 'select'; key: string; label: string; options: readonly { value: string; label: string }[]; test: (row: Row, value: string) => boolean }
  | { kind: 'chips'; key: string; label: string; options: readonly { value: string; label: string }[]; test: (row: Row, value: string) => boolean }
  | { kind: 'toggle'; key: string; label: string; test: (row: Row) => boolean };

export interface DataTableProps<Row> {
  id: string;
  caption: string;
  rows: readonly Row[];
  columns: readonly Column<Row>[];
  rowKey: (row: Row) => string;
  search?: { placeholder: string; test: (row: Row, query: string) => boolean };
  filters?: readonly FilterDef<Row>[];
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Empty because nothing has happened yet, or because everything is fine. */
  empty: { title: string; body: string; action?: ReactNode };
  rowActions?: (row: Row) => ActionItem[];
  /**
   * Where a row leads. The first cell becomes a real link, so the row is reachable by keyboard, opens
   * in a new tab on middle click and reads as a link; a click anywhere else on the row follows it too.
   */
  rowHref?: (row: Row) => string;
  exportName?: string;
  exportDate?: string;
  /** Embedded tables in a pane keep their state local rather than in the URL. */
  urlState?: boolean;
  toolbar?: boolean;
  maxHeight?: string;
  footer?: ReactNode;
  /** Server backed controls, such as a location or date range, shown ahead of the filters. */
  leading?: ReactNode;
  rowTone?: (row: Row) => 'default' | 'muted' | 'attention';
  /** Render as a full card with border and shadow, or flush without structural background. */
  variant?: 'card' | 'naked';
  pageSize?: number;
}

const VIRTUAL_THRESHOLD = 50;

/**
 * The Console data table. docs/06-design-system.md section 6.6:
 *  - sticky header in label type, numeric columns right aligned in JetBrains Mono
 *  - no zebra striping, a 1px rule between rows
 *  - 44px comfortable or 36px compact, persisted per table
 *  - sort, filter and column visibility in the query string
 *  - virtualised above 50 rows
 *  - four distinct states: loading skeleton (the route's loading.tsx), empty because nothing has
 *    happened, empty because filters exclude everything, and error (the route's error.tsx)
 */
export function FilterDropdown({ 
  label, 
  value, 
  onChange, 
  options,
  allLabel = 'All'
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  options: readonly { value: string; label: string }[];
  allLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(menuRef, open, close);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const below = rect.bottom + 4 + menu.height <= window.innerHeight;
    const top = below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - menu.height);
    const left = Math.min(window.innerWidth - menu.width - 8, rect.left);
    setPosition({ top, left });
    menuRef.current.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => nodes[(next + nodes.length) % nodes.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(nodes.length - 1);
    else if (event.key === 'Tab' || event.key === 'Escape') setOpen(false);
    else return;
    event.preventDefault();
  };

  const selectedLabel = options.find((o) => o.value === value)?.label ?? (allLabel ?? '');

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'relative flex h-[30px] items-center rounded-full pl-12 pr-[30px] text-left outline-none',
          'bg-control/20 ring-1 ring-hairline/50',
          'transition-all duration-150 hover:bg-control/40 hover:ring-hairline/80',
          'focus-visible:ring-accent/50 focus-visible:shadow-[0_0_0_3px_rgba(var(--color-accent)/0.10)]',
          open ? 'bg-control/40 ring-hairline/80' : '',
          value ? 'ring-accent/40 bg-accent/[0.05]' : '',
        )}
      >
        {/* Label prefix */}
        <span className={cx(
          'pointer-events-none shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] pr-6',
          value ? 'text-accent-text' : 'text-ink-subtle/70',
        )}>{label}</span>
        {/* Hairline divider */}
        <span className="w-[1px] h-[10px] bg-hairline/80 shrink-0 mr-6" aria-hidden />
        {/* Value */}
        <span className={cx(
          'pointer-events-none text-body-sm font-medium truncate',
          value ? 'text-ink' : 'text-ink-subtle',
        )}>
          {selectedLabel}
        </span>
        <IconChevronDown
          size={11}
          stroke={2.5}
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute right-[9px] shrink-0 transition-transform duration-200',
            value ? 'text-accent-text' : 'text-ink-subtle/60',
            open ? 'rotate-180' : ''
          )}
        />
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          data-lenis-prevent=""
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          className={cx(
            'fixed z-50 min-w-[172px] rounded-[16px] overflow-hidden',
            'border border-hairline/80',
            'bg-overlay shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]',
            'py-4',
          )}
        >
          {(allLabel === null ? options : [{ value: '', label: allLabel }, ...options]).map((o, i) => {
            const active = (value ?? '') === o.value;
            return (
              <button
                key={o.value}
                role="menuitem"
                type="button"
                onClick={() => { onChange(o.value); close(); }}
                className={cx(
                  'relative flex w-full items-center px-12 py-[8px] text-left text-body-sm outline-none',
                  'transition-colors duration-75',
                  active
                    ? 'font-medium text-accent-text bg-accent/[0.08]'
                    : 'font-normal text-ink-subtle hover:bg-control/30 focus-visible:bg-control/30 hover:text-ink',
                )}
              >
                {/* Apple-style checkmark for active item */}
                <div className="w-[16px] mr-8 shrink-0 flex items-center justify-center">
                  {active ? <IconCheck size={14} stroke={2.5} className="text-accent-text" aria-hidden="true" /> : null}
                </div>
                {o.label}
              </button>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

export function DataTable<Row>({
  id,
  caption,
  rows,
  columns,
  rowKey,
  search,
  filters = [],
  defaultSort,
  empty,
  rowActions,
  rowHref,
  exportName,
  exportDate,
  urlState = true,
  toolbar = true,
  maxHeight = 'calc(100dvh - 300px)',
  footer,
  leading,
  rowTone,
  variant = 'card',
  pageSize: explicitPageSize,
}: DataTableProps<Row>) {
  const url = useUrlState();
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, string>>({});
  const read = (key: string) => (urlState ? url.get(key) : (local[key] ?? null));
  const write = (patch: Record<string, string | null>) => {
    if (urlState) url.set(patch);
    else setLocal((current) => {
      const next = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') delete next[k];
        else next[k] = v;
      }
      return next;
    });
  };

  const [storedDensity, setStoredDensity] = usePersistentState<'comfortable' | 'compact'>(`bliss.table.${id}.density`, 'comfortable', ['comfortable', 'compact']);
  const density = (read('density') as 'comfortable' | 'compact' | null) ?? storedDensity;

  const isGridView = read('view') === 'grid';
  const toggleView = () => write({ view: isGridView ? null : 'grid' });
  const rowHeight = density === 'compact' ? 36 : 44;

  const hidden = new Set((read('hide') ?? '').split(',').filter(Boolean));
  const visibleColumns = columns.filter((c) => !c.exportOnly && (c.fixed || !hidden.has(c.key)));
  const template = [...visibleColumns.map((c) => c.width), rowActions ? '48px' : null].filter(Boolean).join(' ');

  const query = read('q') ?? '';
  const sortParam = read('sort');
  const [sortKey, sortDir] = sortParam ? (sortParam.split('.') as [string, 'asc' | 'desc']) : [defaultSort?.key ?? null, defaultSort?.dir ?? 'asc'];

  const filtered = useMemo(() => {
    let out = rows.filter((row) =>
      filters.every((f) => {
        const value = urlState ? url.get(f.key) : (local[f.key] ?? null);
        if (!value) return true;
        return f.kind === 'toggle' ? f.test(row) : f.test(row, value);
      }),
    );
    if (search && query.trim()) out = out.filter((row) => search.test(row, query.trim().toLowerCase()));
    const column = columns.find((c) => c.key === sortKey);
    if (column?.sortValue) {
      const dir = sortDir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) => {
        const av = column.sortValue!(a);
        const bv = column.sortValue!(b);
        if (av === bv) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av < bv ? -1 : 1) * dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- url params are read through `url`
  }, [rows, filters, search, query, sortKey, sortDir, columns, url.params, local]);

  const activeFilters = filters.some((f) => read(f.key)) || query.trim().length > 0;

  const pageSize = explicitPageSize ?? 50;
  const pageParam = read('page');
  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  
  const paginated = useMemo(() => {
    return filtered.slice((validPage - 1) * pageSize, validPage * pageSize);
  }, [filtered, validPage, pageSize]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = paginated.length > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: paginated.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: virtual,
  });

  // table.row.enter when a filter changes the data set, never for rows scrolled into view.
  const filterSignature = `${filters.map((f) => read(f.key) ?? '').join('|')}|${query}`;
  const firstSignature = useRef(filterSignature);
  useEffect(() => {
    if (firstSignature.current === filterSignature) return;
    firstSignature.current = filterSignature;
    const rowsEls = Array.from(scrollRef.current?.querySelectorAll('[data-row]') ?? []);
    tableRowsEnter(rowsEls);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature is the trigger
  }, [filterSignature]);

  const toggleSort = (key: string) => {
    const dir = sortKey === key && sortDir === 'asc' ? 'desc' : sortKey === key && sortDir === 'desc' ? null : 'asc';
    write({ sort: dir ? `${key}.${dir}` : null });
  };

  const clearFilters = () => write(Object.fromEntries([...filters.map((f) => [f.key, null] as const), ['q', null] as const]));

  const exportCsv = () => {
    const params = new URLSearchParams(urlState ? window.location.search : new URLSearchParams(local).toString());
    const exportable = columns.filter((c) => c.csv);
    downloadCsv(
      exportFilename(exportName ?? id, params, exportDate ?? new Date().toISOString().slice(0, 10)),
      toCsv(
        exportable.map((c) => c.header),
        filtered.map((row) => exportable.map((c) => c.csv!(row))),
      ),
    );
  };

  const renderRow = (row: Row, index: number, style?: React.CSSProperties) => {
    const tone = rowTone?.(row) ?? 'default';
    const href = rowHref?.(row);
    return (
      <div
        key={rowKey(row)}
        data-row=""
        role="row"
        tabIndex={href ? 0 : undefined}
        aria-rowindex={index + 2}
        style={{ gridTemplateColumns: template, ...(virtual ? { height: rowHeight } : { minHeight: rowHeight }), ...style }}
        onKeyDown={
          href
            ? (event) => {
                if (event.key === 'Enter') {
                  if (event.metaKey || event.ctrlKey) window.open(href, '_blank');
                  else router.push(href);
                }
              }
            : undefined
        }
        onClick={
          href
            ? (event) => {
                // The link in the first cell handles itself; so do buttons and menus inside the row.
                if ((event.target as HTMLElement).closest('a, button, [role="menu"]')) return;
                if (event.metaKey || event.ctrlKey) window.open(href, '_blank');
                else router.push(href);
              }
            : undefined
        }
        className={cx(
          'group grid items-start gap-16 border-b border-hairline/50 transition-colors duration-100 last:border-b-0',
          variant === 'card' && 'px-24',
          href && 'cursor-pointer hover:bg-control/30 focus-visible:bg-control/30',
          tone === 'muted' && 'opacity-60',
          // A mark, not a fill: a 3px edge on the rows that need a second look.
          tone === 'attention' && 'relative before:absolute before:inset-y-[8px] before:left-0 before:w-[3px] before:rounded-r-sm before:bg-attention',
        )}
      >
        {visibleColumns.map((c, i) => (
          <div key={c.key} role="cell" className={cx('min-w-0 py-[12px]', c.wrap ? '' : 'truncate', c.align === 'right' ? 'text-right' : 'text-left')}>
            {href && i === 0 ? (
              <Link href={href} className="block min-w-0 rounded-sm outline-offset-4 hover:underline hover:decoration-hairline hover:underline-offset-4">
                {c.cell(row)}
              </Link>
            ) : (
              c.cell(row)
            )}
          </div>
        ))}
        {rowActions ? (
          <div role="cell" className="flex justify-end opacity-100 focus-within:opacity-100 desktop:opacity-0 desktop:group-hover:opacity-100" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <OverflowMenu label="Row actions" size="sm" items={rowActions(row)} />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-col">
      {toolbar ? (
        <div className="mb-20 flex flex-wrap items-center gap-8">
          {/* ── Filter pills ─────────────────────────────── */}
          {leading}
          {filters.map((f) =>
            f.kind === 'select' ? (
              <FilterDropdown
                key={f.key}
                label={f.label}
                value={read(f.key) ?? ''}
                onChange={(val) => write({ [f.key]: val || null })}
                options={f.options}
              />
            ) : f.kind === 'chips' ? (
              <FilterChips
                key={f.key}
                label={f.label}
                size="sm"
                value={read(f.key) ?? ''}
                onChange={(v) => write({ [f.key]: v || null })}
                options={[{ value: '', label: 'All' }, ...f.options]}
              />
            ) : (
              <label key={f.key} className="flex items-center gap-8 cursor-pointer group">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle transition-colors group-hover:text-ink">{f.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(read(f.key))}
                  onClick={() => write({ [f.key]: read(f.key) ? null : '1' })}
                  style={read(f.key) ? { backgroundColor: '#34C759', border: 'none' } : undefined}
                  className={cx(
                    'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-250 outline-none',
                    !read(f.key) && 'bg-control/30 ring-1 ring-inset ring-hairline/40'
                  )}
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: '#ffffff' }}
                    className={cx(
                      'size-[18px] rounded-full transition-transform duration-250 ease-out shadow-sm',
                      read(f.key) ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    )}
                  />
                </button>
              </label>
            ),
          )}

          {/* ── Search ───────────────────────────────────── */}
          {search ? (
            <div className={cx(
              'relative flex h-[30px] items-center gap-8 rounded-full px-12',
              'bg-control/30 ring-1 ring-hairline/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-sm',
              'transition-all duration-150',
              'focus-within:bg-control/50 focus-within:ring-accent/40 focus-within:shadow-[0_0_0_3px_rgba(var(--color-accent)/0.08)] focus-within:w-[240px]',
              query ? 'w-[240px] ring-accent/40' : 'w-[160px]',
            )}>
              <IconSearch size={13} stroke={2} aria-hidden="true" className="shrink-0 text-ink-subtle" />
              <input
                type="search"
                placeholder={search.placeholder}
                value={query}
                onChange={(e) => write({ q: e.target.value || null })}
                autoComplete="off"
                spellCheck={false}
                aria-label={search.placeholder}
                className="h-full min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-subtle"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => write({ q: null })}
                  aria-label="Clear search"
                  className="-mr-4 inline-flex size-[20px] shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-control hover:text-ink"
                >
                  <IconX size={11} stroke={2.5} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-6">
            <span
              className="inline-flex h-[28px] items-center rounded-full px-12 font-mono tabular text-micro text-ink-subtle ring-1 ring-hairline/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              aria-live="polite"
            >
              {filtered.length === rows.length ? `${rows.length}` : `${filtered.length}/${rows.length}`}
              <span className="ml-4 text-ink-subtle/60">rows</span>
            </span>
            <button
              type="button"
              onClick={toggleView}
              aria-label={isGridView ? "Switch to list view" : "Switch to grid view"}
              className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full ring-1 ring-hairline/30 bg-control/20 text-ink-subtle transition-all duration-150 hover:bg-control/50 hover:ring-hairline/60 hover:text-ink shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              {isGridView ? <IconLayoutRows size={14} stroke={ICON_STROKE} aria-hidden="true" /> : <IconLayoutGrid size={14} stroke={ICON_STROKE} aria-hidden="true" />}
            </button>
            <OverflowMenu
              label="Table settings"
              size="md"
              trigger={
                <span className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full ring-1 ring-hairline/30 bg-control/20 text-ink-subtle transition-all duration-150 hover:bg-control/50 hover:ring-hairline/60 hover:text-ink shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <IconSelector size={14} stroke={ICON_STROKE} aria-hidden="true" />
                </span>
              }
              items={[
                {
                  key: 'density',
                  label: density === 'compact' ? 'Comfortable rows' : 'Compact rows',
                  onSelect: () => {
                    const next = density === 'compact' ? 'comfortable' : 'compact';
                    setStoredDensity(next);
                    write({ density: next });
                  },
                },
                ...columns
                  .filter((c) => !c.fixed && !c.exportOnly)
                  .map((c) => ({
                    key: `col-${c.key}`,
                    label: `${hidden.has(c.key) ? 'Show' : 'Hide'} ${c.header.toLowerCase()}`,
                    onSelect: () => {
                      const next = new Set(hidden);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      write({ hide: [...next].join(',') || null });
                    },
                  })),
              ]}
            />
            {exportName !== undefined || columns.some((c) => c.csv) ? (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex h-[28px] items-center gap-6 rounded-full px-12 text-body-sm font-medium text-ink-subtle ring-1 ring-hairline/30 bg-control/20 transition-all duration-150 hover:bg-control/50 hover:ring-hairline/60 hover:text-ink shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <IconDownload size={13} stroke={2} aria-hidden="true" />
                Export CSV
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The table or grid container */}
      <div className={cx(
        'min-w-0 overflow-x-hidden',
        !isGridView && variant === 'card' && 'rounded-[16px] border border-hairline/60 bg-control/10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
        isGridView && 'grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-3 xl:grid-cols-4'
      )}>
      
      {!isGridView && (
        <div role="table" aria-label={caption} aria-rowcount={filtered.length + 1} className="w-max min-w-full">
          <div role="rowgroup">
            <div role="row" style={{ gridTemplateColumns: template }} className={cx('grid min-h-[44px] items-center gap-16 border-b border-hairline/80', variant === 'card' ? 'bg-raised/60 px-24 rounded-t-[16px]' : '')}>
              {visibleColumns.map((c) => {
                const sorted = sortKey === c.key;
                return (
                  <div
                    key={c.key}
                    role="columnheader"
                    aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
                    className={cx('min-w-0', c.align === 'right' && 'text-right')}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cx('inline-flex max-w-full items-center gap-4 text-label', sorted ? 'text-ink' : 'text-ink-subtle hover:text-ink', c.align === 'right' && 'flex-row-reverse')}
                      >
                        <span className="truncate">{c.header}</span>
                        {sorted ? (
                          sortDir === 'asc' ? (
                            <IconArrowUp size={12} stroke={2} aria-hidden="true" />
                          ) : (
                            <IconArrowDown size={12} stroke={2} aria-hidden="true" />
                          )
                        ) : (
                          <IconSelector size={12} stroke={ICON_STROKE} aria-hidden="true" className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      <span className="truncate text-label text-ink-subtle">{c.header}</span>
                    )}
                  </div>
                );
              })}
              {rowActions ? <div role="columnheader" aria-label="Actions" /> : null}
            </div>
          </div>

          <div ref={scrollRef} role="rowgroup" data-lenis-prevent="" className="overflow-y-auto overscroll-contain" style={{ maxHeight: virtual ? maxHeight : undefined }}>
            {filtered.length === 0 ? (
              rows.length === 0 ? (
                <EmptyState className="px-24" title={empty.title} body={empty.body} action={empty.action} />
              ) : (
                <EmptyState
                  className="px-24 py-32"
                  align="center"
                  title="No results for these filters"
                  body="Try widening the date range or clearing the category."
                  action={
                    activeFilters ? (
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : virtual ? (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((item) =>
                  renderRow(paginated[item.index]!, item.index, { position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)` }),
                )}
              </div>
            ) : (
              paginated.map((row, i) => renderRow(row, i))
            )}
          </div>
          {footer ? <div className="border-t border-hairline/80 px-24 py-12">{footer}</div> : null}
          {totalPages > 1 && !footer ? (
            <div className="flex items-center justify-between border-t border-hairline/80 px-24 py-12 bg-raised/30 rounded-b-[16px]">
              <span className="text-body-sm text-ink-subtle">
                Page <span className="font-medium text-ink">{validPage}</span> of <span className="font-medium text-ink">{totalPages}</span>
              </span>
              <div className="flex items-center gap-8">
                <Button variant="secondary" onClick={() => write({ page: validPage > 2 ? String(validPage - 1) : null })} disabled={validPage <= 1}>
                  Previous
                </Button>
                <Button variant="secondary" onClick={() => write({ page: String(validPage + 1) })} disabled={validPage >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {isGridView && filtered.length === 0 && (
        <div className="col-span-full">
          {rows.length === 0 ? (
            <EmptyState className="px-24 py-32" align="center" title={empty.title} body={empty.body} action={empty.action} />
          ) : (
            <EmptyState
              className="px-24 py-32"
              align="center"
              title="No results for these filters"
              body="Try widening the date range or clearing the category."
              action={
                activeFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      {isGridView && paginated.length > 0 && (
        <>
          {paginated.map((row, i) => {
            const primaryColumn = visibleColumns[0];
            const detailColumns = visibleColumns.slice(1);
            
            return (
            <div
              key={rowKey(row)}
              className="group flex flex-col overflow-hidden rounded-[16px] bg-page ring-1 ring-hairline/40 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:ring-hairline/70 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
              onClick={rowHref ? () => {
                const href = rowHref(row);
                router.push(href);
              } : undefined}
              role={rowHref ? 'button' : 'article'}
              tabIndex={rowHref ? 0 : undefined}
            >
              {/* Card Header (Primary Column) */}
              {primaryColumn && (
                <div className="flex items-start justify-between gap-12 bg-control/20 px-16 py-12 border-b border-hairline/40">
                  <div className="flex flex-col min-w-0">
                     <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle mb-[2px]">{primaryColumn.header}</span>
                     <div className="text-body font-medium text-ink truncate">{primaryColumn.cell(row)}</div>
                  </div>
                  {rowActions ? (
                    <div className="shrink-0 -mr-4 -mt-4 opacity-100 focus-within:opacity-100 desktop:opacity-0 desktop:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <OverflowMenu label="Row actions" size="sm" items={rowActions(row)} />
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* Card Body (Detail Columns) */}
              <div className="flex flex-col gap-8 px-16 py-12 flex-1 min-h-0">
                {detailColumns.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-16 min-w-0">
                    <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-ink-subtle shrink-0 mt-[2px]">{c.header}</span>
                    <div className="text-body-sm text-ink text-right flex-1 flex justify-end min-w-0">
                      {c.cell(row)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </>
      )}

      {isGridView && totalPages > 1 ? (
        <div className="col-span-full flex items-center justify-between border-t border-hairline/80 px-24 py-12 bg-raised/30 rounded-b-[16px]">
          <span className="text-body-sm text-ink-subtle">
            Page <span className="font-medium text-ink">{validPage}</span> of <span className="font-medium text-ink">{totalPages}</span>
          </span>
          <div className="flex items-center gap-8">
            <Button variant="secondary" onClick={() => write({ page: validPage > 2 ? String(validPage - 1) : null })} disabled={validPage <= 1}>
              Previous
            </Button>
            <Button variant="secondary" onClick={() => write({ page: String(validPage + 1) })} disabled={validPage >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      </div>
    </div>
  );
}

/** A numeric cell: JetBrains Mono, tabular figures, right aligned by its column. */
export function NumCell({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'muted' | 'stop' | 'low' | 'poured' }) {
  return (
    <span className={cx('font-mono tabular text-body-sm', tone === 'muted' ? 'text-ink-subtle' : tone === 'stop' ? 'text-stop font-medium' : tone === 'low' ? 'text-low font-medium' : tone === 'poured' ? 'text-poured font-medium' : 'text-ink')}>
      {children}
    </span>
  );
}

/** Two lines in one cell: a name and a quiet detail. */
export function StackCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-body-sm font-medium text-ink leading-tight">{primary}</span>
      {secondary ? <span className="truncate text-micro text-ink-subtle mt-[2px]">{secondary}</span> : null}
    </span>
  );
}
