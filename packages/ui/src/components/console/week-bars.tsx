'use client';

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

/**
 * A few nights side by side, drawn to answer "was tonight a good one": each night's takings written
 * over its bar, a dashed line at the usual night (the average of the nights that traded), the night
 * in view at full strength while the rest step back, and each night's detail on hover. Money comes
 * in as whole shillings, already rounded for display. Built on Recharts, coloured by tokens.
 */

export interface NightBar {
  key: string;
  /** Under the bar: "Mon". */
  label: string;
  /** In the hover card: "Monday 28 Sep". */
  title: string;
  shillings: number;
  tabs: number;
}

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function WeekBars({ nights, currentKey, height = 150, caption }: { nights: readonly NightBar[]; currentKey: string; height?: number; caption: string }) {
  const traded = nights.filter((n) => n.shillings > 0);
  const usual = traded.length > 1 ? Math.round(traded.reduce((a, n) => a + n.shillings, 0) / traded.length) : null;
  return (
    <figure aria-label={caption} className="w-full">
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={nights as NightBar[]} margin={{ top: 18, right: 36, bottom: 0, left: 4 }} barCategoryGap="18%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            {usual !== null ? (
              <ReferenceLine y={usual} stroke="var(--color-ink-subtle)" strokeDasharray="3 4" strokeOpacity={0.8} label={{ value: 'usual', position: 'right', fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            ) : null}
            <Tooltip
              cursor={{ fill: 'var(--color-band)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const n = active ? (payload?.[0]?.payload as NightBar | undefined) : undefined;
                if (!n) return null;
                const vs = usual && n.shillings > 0 ? Math.round(((n.shillings - usual) / usual) * 100) : null;
                return (
                  <div className="flex min-w-popover-min flex-col gap-2 rounded-control bg-overlay px-12 py-8 shadow-popover">
                    <span className="text-micro text-ink-subtle">{n.title}</span>
                    <span className="font-mono tabular text-num-md text-ink">
                      <span className="text-micro text-ink-subtle">KES </span>
                      {n.shillings.toLocaleString('en-KE')}
                    </span>
                    <span className="text-micro text-ink-muted">
                      {n.tabs} {n.tabs === 1 ? 'tab' : 'tabs'}
                      {vs !== null ? <span className={vs >= 0 ? 'text-poured' : 'text-low'}>{` · ${vs >= 0 ? '+' : ''}${vs}% on usual`}</span> : null}
                    </span>
                  </div>
                );
              }}
            />
            <Bar dataKey="shillings" radius={[4, 4, 1, 1]} isAnimationActive animationDuration={600} minPointSize={2}>
              {nights.map((n) => (
                <Cell key={n.key} fill={n.key === currentKey ? 'var(--color-accent)' : 'var(--color-chart-muted)'} />
              ))}
              <LabelList dataKey="shillings" position="top" formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? compact(v) : '')} style={{ fill: 'var(--color-ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {nights.map((n) => (
            <tr key={n.key}>
              <th scope="row">{n.title}</th>
              <td>KES {n.shillings.toLocaleString('en-KE')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
