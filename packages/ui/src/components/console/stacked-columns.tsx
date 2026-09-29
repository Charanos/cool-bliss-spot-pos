'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

const FILL: Record<Tone, string> = {
  poured: 'var(--color-poured)',
  served: 'var(--color-served)',
  low: 'var(--color-low)',
  stop: 'var(--color-stop)',
  info: 'var(--color-info)',
  neutral: 'var(--color-ink-subtle)',
  accent: 'var(--color-accent)',
};

/**
 * A few columns, each stacked from its series (days of a week, each split by outcome), following
 * the dataviz method: the first series on the baseline, the total over each column, a legend above,
 * a whole-number scale, a hover card per column with every series and its share, and a table for
 * screen readers. Built on Recharts, coloured by tokens.
 */
export function StackedColumns({ data, series, caption, height = 140, className }: { data: readonly ColumnDatum[]; series: readonly ColumnSeries[]; caption: string; height?: number; className?: string }) {
  const rows = data.map((d) => ({ key: d.key, label: d.label, total: series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0), ...d.values }));
  const top = series.at(-1)?.key;
  return (
    <figure aria-label={caption} className={cx('flex flex-col gap-8', className)}>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-16 gap-y-4">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-6 text-micro text-ink-muted">
            <span className={cx('size-8 rounded-sm', dotTone[s.tone])} />
            {s.label}
          </li>
        ))}
      </ul>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeDasharray="2 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            <YAxis width={28} allowDecimals={false} tickCount={3} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            <Tooltip
              cursor={{ fill: 'var(--color-band)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const r = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                if (!r) return null;
                const rec = r as unknown as Record<string, number>;
                return (
                  <div className="flex min-w-popover-min flex-col gap-4 rounded-control bg-overlay px-12 py-8 shadow-popover">
                    <span className="flex items-baseline justify-between gap-12">
                      <span className="text-body-sm font-medium text-ink">{r.label}</span>
                      <span className="font-mono tabular text-micro text-ink-subtle">{r.total} in all</span>
                    </span>
                    {series.map((s) => {
                      const v = rec[s.key] ?? 0;
                      return (
                        <span key={s.key} className="flex items-center gap-8 text-body-sm">
                          <span className={cx('size-dot rounded-dot', dotTone[s.tone])} />
                          <span className="flex-1 text-ink-muted">{s.label}</span>
                          <span className="font-mono tabular text-ink">{v}</span>
                          <span className="w-40 text-right font-mono tabular text-micro text-ink-subtle">{r.total > 0 ? `${Math.round((v / r.total) * 100)}%` : ''}</span>
                        </span>
                      );
                    })}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={FILL[s.tone]} radius={s.key === top ? [3, 3, 0, 0] : 0} isAnimationActive animationDuration={600}>
                {s.key === top ? <LabelList dataKey="total" position="top" formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : '')} style={{ fill: 'var(--color-ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} /> : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
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
