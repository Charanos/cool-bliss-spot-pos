'use client';

import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { cx } from '../../../lib/cx';

/** The page numbers to show: the first, the last, and two either side of where you are, with gaps. */
function pageList(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => keep.add(n));
  const sorted = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

/**
 * The foot of a long table or grid: how much you are seeing of how much, how many to a page, and
 * the pages, numbered, with the ends one step away. Everything lives in the address, so a page
 * can be shared and the back button returns to it.
 */
export function Pagination({
  page,
  pages,
  total,
  perPage,
  perPageOptions,
  noun,
  onPage,
  onPerPage,
}: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  perPageOptions: readonly number[];
  noun: [string, string];
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const step = 'inline-flex size-control-sm items-center justify-center rounded-md text-ink-muted transition-hover hover:bg-control hover:text-ink disabled:pointer-events-none disabled:text-ink-disabled';
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-16 px-20 py-12">
      <div className="flex items-center gap-16 text-body-sm text-ink-muted">
        <span className="tabular">
          Showing{' '}
          <span className="font-medium text-ink">
            {from}–{to}
          </span>{' '}
          of <span className="font-medium text-ink">{total.toLocaleString('en-KE')}</span> {total === 1 ? noun[0] : noun[1]}
        </span>
        <label className="flex items-center gap-8">
          <span>Per page</span>
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="h-control-sm rounded-md border border-edge bg-card px-8 text-body-sm tabular text-ink transition-hover hover:border-edge-strong"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="First page" disabled={page <= 1} onClick={() => onPage(1)} className={step}>
            <IconChevronsLeft size={16} stroke={1.5} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
            <IconChevronLeft size={16} stroke={1.5} aria-hidden="true" />
          </button>
          {pageList(page, pages).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="inline-flex w-control-sm justify-center text-body-sm text-ink-subtle">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                aria-label={`Page ${n}`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => onPage(n)}
                className={cx('inline-flex h-control-sm min-w-control-sm items-center justify-center rounded-md px-8 font-mono tabular text-num-sm transition-hover', n === page ? 'bg-ink text-page' : 'text-ink-muted hover:bg-control hover:text-ink')}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
            <IconChevronRight size={16} stroke={1.5} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Last page" disabled={page >= pages} onClick={() => onPage(pages)} className={step}>
            <IconChevronsRight size={16} stroke={1.5} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
