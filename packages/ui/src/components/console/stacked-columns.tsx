'use client';

import { useId, useState } from 'react';
import { cx } from '../../lib/cx';
import { type Tone, dotTone } from '../status';

export interface ColumnSeries {
  key: string;
  label: string;
  tone: Tone;
}

export interface ColumnDatum {
  key: string;
  label: string;
  /** One figure per series, by series key. */
  values: Record<string, number>;
}

/**
 * A few columns, each stacked from its series (days of a week, each split by outcome). Following
 * the dataviz method: a 2px gap between stacked segments, the first series on the baseline, a
 * legend above for two or more series, a hover card per column with a hit target the full column
 * height, the total over each column, and a table for screen readers.
 */
export function StackedColumns({ data, series, caption, height = 140, className }: { data: readonly ColumnDatum[]; series: readonly ColumnSeries[]; caption: string; height?: number; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const titleId = useId();
  const totals = data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const active = data.find((d) => d.key === hover) ?? null;

  return (
    <figure aria-labelledby={titleId} className={cx('flex flex-col gap-12', className)}>
      <figcaption id={titleId} className="sr-only">
        {caption}
      </figcaption>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-16 gap-y-4">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-6 text-micro text-ink-muted">
            <span className={cx('size-dot rounded-dot', dotTone[s.tone])} />
            {s.label}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="relative grid gap-8" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => {
          const total = totals[i]!;
          const on = hover === d.key;
          return (
            <div key={d.key} onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover((h) => (h === d.key ? null : h))} className="flex flex-col items-center gap-6">
              <span className={cx('font-mono tabular text-micro', total > 0 ? 'text-ink' : 'text-ink-disabled')}>{total}</span>
              <div className={cx('flex w-full max-w-40 flex-col-reverse gap-2 rounded-sm transition-hover', hover && !on && 'opacity-60')} style={{ height }}>
                {total === 0 ? (
                  <span className="h-2 w-full rounded-sm bg-band-strong" />
                ) : (
                  series.map((s, j) => {
                    const v = d.values[s.key] ?? 0;
                    if (v <= 0) return null;
                    return <span key={s.key} className={cx('gauge-grow-y w-full rounded-sm', dotTone[s.tone])} style={{ height: `${((v / max) * 94).toFixed(2)}%`, animationDelay: `${i * 50 + j * 40}ms` }} />;
                  })
                )}
              </div>
              <span className={cx('text-micro', on ? 'text-ink' : 'text-ink-subtle')}>{d.label}</span>
            </div>
          );
        })}
        {active ? (
          <div className="pointer-events-none absolute top-0 right-0 z-raised flex min-w-popover-min flex-col gap-4 rounded-control bg-overlay px-12 py-8 shadow-popover">
            <span className="text-body-sm font-medium text-ink">{active.label}</span>
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-8 text-body-sm">
                <span className={cx('size-dot rounded-dot', dotTone[s.tone])} />
                <span className="flex-1 text-ink-muted">{s.label}</span>
                <span className="font-mono tabular text-ink">{active.values[s.key] ?? 0}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{d.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
