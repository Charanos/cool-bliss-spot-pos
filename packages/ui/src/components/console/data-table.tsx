'use client';

import { IconArrowDown, IconArrowUp, IconDownload, IconLayoutRows, IconSelector } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../hooks';
import { cx } from '../../lib/cx';
import { tableRowsEnter } from '../../motion/console';
import type { ActionItem } from '../action-list';
import { Button } from '../button';
import { FilterChips } from '../choice';
import { EmptyState } from '../feedback';
import { SearchField, SelectField, Switch } from '../fields';
import { ICON_STROKE } from '../icon';
import { OverflowMenu } from '../menu';
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = filtered.length > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: filtered.length,
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
        aria-rowindex={index + 2}
        style={{ gridTemplateColumns: template, ...(virtual ? { height: rowHeight } : { minHeight: rowHeight }), ...style }}
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
          'group grid items-center gap-16 border-b border-rule px-16',
          href && 'cursor-pointer hover:bg-sunken',
          tone === 'muted' && 'opacity-60',
          // A mark, not a fill: a 3px edge on the rows that need a second look.
          tone === 'attention' && 'relative before:absolute before:inset-y-[8px] before:left-0 before:w-[3px] before:rounded-r-sm before:bg-attention',
        )}
      >
        {visibleColumns.map((c, i) => (
          <div key={c.key} role="cell" className={cx('min-w-0', c.wrap ? 'py-8' : 'truncate', c.align === 'right' ? 'text-right' : 'text-left')}>
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
          <div role="cell" className="flex justify-end opacity-100 focus-within:opacity-100 desktop:opacity-0 desktop:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <OverflowMenu label="Row actions" size="sm" items={rowActions(row)} />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-col">
      {toolbar ? (
        <div className="flex flex-wrap items-end gap-x-16 gap-y-12 pb-16">
          {leading}
          {filters.map((f) =>
            f.kind === 'select' ? (
              <div key={f.key} className="w-[180px]">
                <SelectField label={f.label} value={read(f.key) ?? ''} onChange={(e) => write({ [f.key]: e.target.value || null })} options={[{ value: '', label: 'All' }, ...f.options]} />
              </div>
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
              <div key={f.key} className="w-[220px]">
                <Switch label={f.label} checked={Boolean(read(f.key))} onChange={(v) => write({ [f.key]: v ? '1' : null })} />
              </div>
            ),
          )}
          {search ? (
            <div className="w-[240px]">
              <SearchField label="Search" hideLabel placeholder={search.placeholder} value={query} onChange={(e) => write({ q: e.target.value || null })} onClear={() => write({ q: null })} />
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-4">
            <span className="mr-8 font-mono tabular text-num-sm text-ink-subtle" aria-live="polite">
              {filtered.length === rows.length ? `${rows.length} rows` : `${filtered.length} of ${rows.length}`}
            </span>
            <OverflowMenu
              label="Table view"
              size="md"
              trigger={<IconLayoutRows size={20} stroke={ICON_STROKE} aria-hidden="true" />}
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
              <Button variant="ghost" size="md" icon={IconDownload} onClick={exportCsv}>
                Export CSV
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* One horizontal scroller for header and body together: the inner block is as wide as its tracks. */}
      <div className="min-w-0 overflow-x-auto">
      <div role="table" aria-label={caption} aria-rowcount={filtered.length + 1} className="w-max min-w-full">
        <div role="rowgroup">
          <div role="row" style={{ gridTemplateColumns: template }} className="grid min-h-[36px] items-center gap-16 border-b border-hairline px-16">
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
              <EmptyState className="px-16" title={empty.title} body={empty.body} action={empty.action} />
            ) : (
              <EmptyState
                className="px-16"
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
                renderRow(filtered[item.index]!, item.index, { position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)` }),
              )}
            </div>
          ) : (
            filtered.map((row, i) => renderRow(row, i))
          )}
        </div>
        {footer ? <div className="border-t border-hairline px-16 py-12">{footer}</div> : null}
      </div>
      </div>
    </div>
  );
}

/** A numeric cell: JetBrains Mono, tabular figures, right aligned by its column. */
export function NumCell({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'muted' | 'stop' | 'low' | 'poured' }) {
  return (
    <span className={cx('font-mono tabular text-num', tone === 'muted' ? 'text-ink-subtle' : tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : tone === 'poured' ? 'text-poured' : 'text-ink')}>
      {children}
    </span>
  );
}

/** Two lines in one cell: a name and a quiet detail. */
export function StackCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate text-body text-ink">{primary}</span>
      {secondary ? <span className="truncate text-body-sm text-ink-subtle">{secondary}</span> : null}
    </span>
  );
}
