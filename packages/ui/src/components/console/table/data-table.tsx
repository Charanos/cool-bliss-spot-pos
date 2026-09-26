'use client';

import { IconArrowDown, IconArrowUp, IconDownload, IconLayoutGrid, IconLayoutRows, IconSelector, IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../../hooks';
import { cx } from '../../../lib/cx';
import { tableRowsEnter } from '../../../motion/console';
import type { ActionItem } from '../../action-list';
import { Button, IconButton } from '../../button';
import { FilterChips } from '../../choice';
import { EmptyState } from '../../feedback';
import { ICON_STROKE } from '../../icon';
import { OverflowMenu } from '../../menu';
import { Card, CardHeader, CardStats, Stat } from '../card';
import { downloadCsv, exportFilename, toCsv } from '../csv';
import { FilterSelect } from '../filter-select';
import { ResultCount, SearchInput, ToggleChip, Toolbar } from '../toolbar';
import { useUrlState } from '../url-state';
import { Pagination } from './pagination';

export interface Column<Row> {
  key: string;
  header: string;
  /** A CSS grid track: '120px', 'minmax(200px, 2fr)'. */
  width: string;
  align?: 'left' | 'right';
  cell: (row: Row, ctx: { grid: boolean }) => ReactNode;
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
  /** What one row is, for the count: ['bill', 'bills']. */
  noun?: [string, string];
  search?: { placeholder: string; test: (row: Row, query: string) => boolean };
  filters?: readonly FilterDef<Row>[];
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Empty because nothing has happened yet, or because everything is fine. */
  empty: { title: string; body: string; action?: ReactNode };
  /** Empty because the filters exclude everything. Says what to change, in this table's words. */
  emptyFiltered?: { title: string; body: string };
  rowActions?: (row: Row) => ActionItem[];
  /**
   * Where a row leads. The first cell becomes a real link that covers the row, so the row is one tab
   * stop, reads as a link and opens in a new tab on middle click.
   */
  rowHref?: (row: Row) => string;
  exportName?: string;
  exportDate?: string;
  /** Embedded tables keep their state local rather than in the URL. */
  urlState?: boolean;
  toolbar?: boolean;
  maxHeight?: string;
  footer?: ReactNode;
  /** Server backed controls, such as a location or date range, shown ahead of the filters. */
  leading?: ReactNode;
  rowTone?: (row: Row) => 'default' | 'muted' | 'attention';
  /** On a card surface of its own, or flush inside a card that already has one. */
  variant?: 'card' | 'naked';
  pageSize?: number;
  /** Offer a grid of cards as a second view. With no renderer, cards are built from the columns. */
  gridView?: boolean;
  renderGridCard?: (row: Row) => ReactNode;
}

const VIRTUAL_THRESHOLD = 50;
const DEFAULT_FILTERED = { title: 'Nothing matches these filters', body: 'Clear the filters or the search to see every row again.' };

/**
 * The Console data table. docs/06 section 6.6 and docs/19 section 3:
 *  - header in label type on a band, numeric columns right aligned in JetBrains Mono
 *  - no zebra striping, a 1px rule between rows
 *  - 44px comfortable or 36px compact, persisted per table
 *  - sort, filter, view and column visibility in the query string
 *  - wide tables scroll sideways inside their card; nothing is clipped
 *  - virtualised above 50 rows on a page
 *  - four states: loading (the route's loading.tsx), empty because nothing has happened, empty
 *    because the filters exclude everything, and error (the route's error.tsx)
 */
export function DataTable<Row>({
  id,
  caption,
  rows,
  columns,
  rowKey,
  noun = ['row', 'rows'],
  search,
  filters = [],
  defaultSort,
  empty,
  emptyFiltered = DEFAULT_FILTERED,
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
  pageSize = 50,
  gridView = false,
  renderGridCard,
}: DataTableProps<Row>) {
  const url = useUrlState();
  const [local, setLocal] = useState<Record<string, string>>({});
  const read = (key: string) => (urlState ? url.get(key) : (local[key] ?? null));
  const write = (patch: Record<string, string | null>) => {
    if (urlState) {
      url.set(patch);
      return;
    }
    setLocal((current) => {
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
  const gridAvailable = gridView || Boolean(renderGridCard);
  const isGrid = gridAvailable && read('view') === 'grid';
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
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(read('page') ?? '1', 10) || 1), pages);
  const offset = (page - 1) * pageSize;
  const shown = useMemo(() => filtered.slice(offset, offset + pageSize), [filtered, offset, pageSize]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = !isGrid && shown.length > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({ count: shown.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 12, enabled: virtual });

  // table.row.enter when a filter changes the data set, never for rows scrolled into view.
  const filterSignature = `${filters.map((f) => read(f.key) ?? '').join('|')}|${query}`;
  const firstSignature = useRef(filterSignature);
  useEffect(() => {
    if (firstSignature.current === filterSignature) return;
    firstSignature.current = filterSignature;
    tableRowsEnter(Array.from(scrollRef.current?.querySelectorAll('[data-row]') ?? []));
  }, [filterSignature]);

  const toggleSort = (key: string) => {
    const dir = sortKey === key && sortDir === 'asc' ? 'desc' : sortKey === key && sortDir === 'desc' ? null : 'asc';
    write({ sort: dir ? `${key}.${dir}` : null, page: null });
  };
  const clearFilters = () => write(Object.fromEntries([...filters.map((f) => [f.key, null] as const), ['q', null] as const, ['page', null] as const]));
  const exportable = columns.filter((c) => c.csv);

  const exportCsv = () => {
    const params = new URLSearchParams(urlState ? window.location.search : new URLSearchParams(local).toString());
    downloadCsv(
      exportFilename(exportName ?? id, params, exportDate ?? new Date().toISOString().slice(0, 10)),
      toCsv(
        exportable.map((c) => c.header),
        filtered.map((row) => exportable.map((c) => c.csv!(row))),
      ),
    );
  };

  const emptyView =
    rows.length === 0 ? (
      <EmptyState className="px-20" title={empty.title} body={empty.body} action={empty.action} />
    ) : (
      <EmptyState
        className="px-20"
        title={emptyFiltered.title}
        body={emptyFiltered.body}
        action={
          activeFilters ? (
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );

  const renderRow = (row: Row, index: number, style?: React.CSSProperties) => {
    const tone = rowTone?.(row) ?? 'default';
    const href = rowHref?.(row);
    return (
      <div
        key={rowKey(row)}
        data-row=""
        role="row"
        aria-rowindex={offset + index + 2}
        style={{ gridTemplateColumns: template, ...(virtual ? { height: rowHeight } : { minHeight: rowHeight }), ...style }}
        className={cx(
          'group relative grid items-center gap-16 border-b border-rule last:border-b-0 transition-hover',
          variant === 'card' ? 'px-20' : null,
          href && 'hover:bg-rail-hover focus-within:bg-rail-hover',
          tone === 'muted' && 'text-ink-subtle',
          // A mark, not a fill: a 2px edge on the rows that need a second look.
          tone === 'attention' && 'before:absolute before:inset-y-8 before:left-0 before:w-2 before:rounded-r-sm before:bg-attention',
        )}
      >
        {visibleColumns.map((c, i) => (
          <div key={c.key} role="cell" className={cx('min-w-0', density === 'compact' ? 'py-6' : 'py-12', c.wrap ? null : 'truncate', c.align === 'right' ? 'text-right' : 'text-left')}>
            {href && i === 0 ? (
              <Link href={href} className="link-stretched block min-w-0 rounded-sm focus-visible:outline-offset-2">
                {c.cell(row, { grid: false })}
              </Link>
            ) : (
              c.cell(row, { grid: false })
            )}
          </div>
        ))}
        {rowActions ? (
          <div role="cell" className="relative z-raised flex justify-end desktop:opacity-0 desktop:group-hover:opacity-100 desktop:group-focus-within:opacity-100 transition-hover">
            <OverflowMenu label="Row actions" size="sm" items={rowActions(row)} />
          </div>
        ) : null}
      </div>
    );
  };

  const defaultCard = (row: Row) => {
    const [primary, ...rest] = visibleColumns;
    const href = rowHref?.(row);
    return (
      <Card as="article" interactive={Boolean(href)} className="h-full">
        {primary ? (
          <CardHeader
            band
            href={href}
            title={primary.cell(row, { grid: true })}
            actions={rowActions ? <OverflowMenu label="Row actions" size="sm" items={rowActions(row)} /> : undefined}
          />
        ) : null}
        <CardStats columns={2}>
          {rest.map((c) => (
            <Stat key={c.key} label={c.header}>
              {c.cell(row, { grid: true })}
            </Stat>
          ))}
        </CardStats>
      </Card>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-16">
      {toolbar ? (
        <Toolbar
          label={`${caption} filters`}
          end={
            <>
              <ResultCount shown={filtered.length} total={rows.length} noun={noun} />
              {gridAvailable ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon={isGrid ? IconLayoutRows : IconLayoutGrid}
                  label={isGrid ? 'Show as a list' : 'Show as cards'}
                  onClick={() => write({ view: isGrid ? null : 'grid' })}
                />
              ) : null}
              <OverflowMenu
                label="Table settings"
                size="sm"
                trigger={<IconAdjustmentsHorizontal size={16} stroke={ICON_STROKE} aria-hidden="true" />}
                items={[
                  {
                    key: 'density',
                    label: density === 'compact' ? 'Comfortable rows' : 'Compact rows',
                    onSelect: () => {
                      const next = density === 'compact' ? 'comfortable' : 'compact';
                      setStoredDensity(next);
                      write({ density: next === 'comfortable' ? null : next });
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
              {exportable.length > 0 ? (
                <Button size="sm" variant="outline" icon={IconDownload} onClick={exportCsv}>
                  Export
                </Button>
              ) : null}
            </>
          }
        >
          {leading}
          {filters.map((f) =>
            f.kind === 'select' ? (
              <FilterSelect key={f.key} label={f.label} value={read(f.key) ?? ''} onChange={(v) => write({ [f.key]: v || null, page: null })} options={f.options} />
            ) : f.kind === 'chips' ? (
              <FilterChips key={f.key} label={f.label} size="sm" value={read(f.key) ?? ''} onChange={(v) => write({ [f.key]: v || null, page: null })} options={[{ value: '', label: 'All' }, ...f.options]} />
            ) : (
              <ToggleChip key={f.key} pressed={Boolean(read(f.key))} onChange={(on) => write({ [f.key]: on ? '1' : null, page: null })}>
                {f.label}
              </ToggleChip>
            ),
          )}
          {search ? <SearchInput value={query} onChange={(v) => write({ q: v || null, page: null })} placeholder={search.placeholder} /> : null}
        </Toolbar>
      ) : null}

      {isGrid ? (
        filtered.length === 0 ? (
          <div className="card-surface">{emptyView}</div>
        ) : (
          <>
            <ul aria-label={caption} className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
              {shown.map((row) => (
                <li key={rowKey(row)} className="min-w-0">
                  {renderGridCard ? renderGridCard(row) : defaultCard(row)}
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <div className="card-surface">
                <Pagination page={page} pages={pages} onPage={(p) => write({ page: p > 1 ? String(p) : null })} />
              </div>
            ) : null}
          </>
        )
      ) : (
        <div className={cx('min-w-0', variant === 'card' && 'overflow-hidden card-surface')}>
          <div className="scroll-x">
            <div role="table" aria-label={caption} aria-rowcount={filtered.length + 1} className="w-max min-w-full">
              <div role="rowgroup">
                <div role="row" aria-rowindex={1} style={{ gridTemplateColumns: template }} className={cx('grid min-h-row-compact items-center gap-16 border-b border-edge', variant === 'card' ? 'card-band px-20' : null)}>
                  {visibleColumns.map((c) => {
                    const sorted = sortKey === c.key;
                    return (
                      <div
                        key={c.key}
                        role="columnheader"
                        aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
                        className={cx('flex min-w-0 items-center', c.align === 'right' && 'justify-end')}
                      >
                        {c.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className={cx('inline-flex max-w-full items-center gap-4 rounded-sm text-label transition-hover', sorted ? 'text-ink' : 'text-ink-subtle hover:text-ink', c.align === 'right' && 'flex-row-reverse')}
                          >
                            <span className="truncate">{c.header}</span>
                            {sorted ? (
                              sortDir === 'asc' ? (
                                <IconArrowUp size={12} stroke={2} aria-hidden="true" />
                              ) : (
                                <IconArrowDown size={12} stroke={2} aria-hidden="true" />
                              )
                            ) : (
                              <IconSelector size={12} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-disabled" />
                            )}
                          </button>
                        ) : (
                          <span className="truncate text-label text-ink-subtle">{c.header}</span>
                        )}
                      </div>
                    );
                  })}
                  {rowActions ? (
                    <div role="columnheader">
                      <span className="sr-only">Actions</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                ref={scrollRef}
                role="rowgroup"
                {...(virtual ? { 'data-lenis-prevent': '' } : {})}
                className={cx(virtual && 'overflow-y-auto overscroll-contain')}
                style={{ maxHeight: virtual ? maxHeight : undefined }}
              >
                {filtered.length === 0 ? (
                  <div role="row">
                    <div role="cell">{emptyView}</div>
                  </div>
                ) : virtual ? (
                  <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((item) => renderRow(shown[item.index]!, item.index, { position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)` }))}
                  </div>
                ) : (
                  shown.map((row, i) => renderRow(row, i))
                )}
              </div>
            </div>
          </div>
          {footer ? <div className="border-t border-edge card-band-strong px-20 py-12">{footer}</div> : null}
          {pages > 1 ? <Pagination page={page} pages={pages} onPage={(p) => write({ page: p > 1 ? String(p) : null })} /> : null}
        </div>
      )}
    </div>
  );
}
