'use client';

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Tonight hour by hour against a usual night of the same weekday: tonight as bars, the usual night
 * as a line over them, so an hour running behind or ahead reads at once. The busiest hour of
 * tonight is at full strength, hours still to come are left empty, and each hour's pair of figures
 * and the difference show on hover. Money comes in as whole shillings. Built on Recharts.
 */

export interface HourPair {
  /** "22:00" */
  hour: string;
  tonight: number;
  usual: number | null;
}

const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function HourCompare({ hours, usualLabel, caption, height = 240 }: { hours: readonly HourPair[]; usualLabel: string; caption: string; height?: number }) {
  const peak = hours.reduce((m, h) => (h.tonight > m.tonight ? h : m), hours[0] ?? { hour: '', tonight: 0, usual: null });
  const hasUsual = hours.some((h) => (h.usual ?? 0) > 0);
  return (
    <figure aria-label={caption} className="flex w-full flex-col gap-8">
      <ul aria-hidden="true" className="flex flex-wrap items-center gap-x-16 gap-y-4 text-micro text-ink-muted">
        <li className="flex items-center gap-6">
          <span className="size-8 rounded-sm bg-accent" />
          Tonight
        </li>
        {hasUsual ? (
          <li className="flex items-center gap-6">
            <span className="h-2 w-16 rounded-pill bg-ink-subtle" />
            {usualLabel}
          </li>
        ) : null}
      </ul>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hours as HourPair[]} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeDasharray="2 4" />
            <XAxis dataKey="hour" tickFormatter={(h: string) => h.slice(0, 2)} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            <YAxis width={40} tickCount={4} tickFormatter={(v: number) => compact(v)} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            <Tooltip
              cursor={{ fill: 'var(--color-band)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const h = active ? (payload?.[0]?.payload as HourPair | undefined) : undefined;
                if (!h) return null;
                const diff = h.usual ? h.tonight - h.usual : null;
                return (
                  <div className="flex min-w-popover-min flex-col gap-4 rounded-control bg-overlay px-12 py-8 shadow-popover">
                    <span className="font-mono text-micro text-ink-subtle">
                      {h.hour} to {h.hour.slice(0, 2)}:59
                    </span>
                    <span className="flex items-baseline justify-between gap-16 text-body-sm">
                      <span className="text-ink-muted">Tonight</span>
                      <span className="font-mono tabular text-ink">{h.tonight.toLocaleString('en-KE')}</span>
                    </span>
                    {h.usual !== null ? (
                      <span className="flex items-baseline justify-between gap-16 text-body-sm">
                        <span className="text-ink-muted">{usualLabel}</span>
                        <span className="font-mono tabular text-ink-muted">{h.usual.toLocaleString('en-KE')}</span>
                      </span>
                    ) : null}
                    {diff !== null && h.usual ? (
                      <span className={diff >= 0 ? 'text-micro text-poured' : 'text-micro text-low'}>
                        {diff >= 0 ? 'Ahead by ' : 'Behind by '}KES {Math.abs(diff).toLocaleString('en-KE')}
                      </span>
                    ) : null}
                  </div>
                );
              }}
            />
            <Bar dataKey="tonight" radius={[4, 4, 1, 1]} isAnimationActive animationDuration={600}>
              {hours.map((h) => (
                <Cell key={h.hour} fill={h.hour === peak.hour && h.tonight > 0 ? 'var(--color-accent)' : 'var(--color-chart-muted)'} />
              ))}
            </Bar>
            {hasUsual ? <Line type="monotone" dataKey="usual" stroke="var(--color-ink-subtle)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: 'var(--color-ink-subtle)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive animationDuration={800} /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">Tonight</th>
            <th scope="col">{usualLabel}</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h.hour}>
              <th scope="row">{h.hour}</th>
              <td>KES {h.tonight.toLocaleString('en-KE')}</td>
              <td>{h.usual === null ? 'None' : `KES ${h.usual.toLocaleString('en-KE')}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
