'use client';

import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * A measure over time, drawn to be read, not admired: its own scale, the time along the bottom, a
 * band where it turns worrying and a line where it turns bad, the latest reading marked, and every
 * reading on hover with the word for it. Built on Recharts; every colour is a token, so it follows
 * the theme. docs/19 section 3.
 */

export interface TrendPoint {
  at: number;
  value: number | null;
}

const C = {
  line: 'var(--color-chart)',
  fillTop: 'var(--color-chart)',
  grid: 'var(--color-grid)',
  axis: 'var(--color-ink-subtle)',
  warn: 'var(--color-low)',
  fail: 'var(--color-stop)',
  dot: 'var(--color-accent)',
  surface: 'var(--color-card)',
} as const;

function clock(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at);
}

function fmt(value: number, decimals: number): string {
  return value.toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function TrendChart({
  points,
  unit,
  label,
  timeZone,
  decimals = 0,
  warnAt,
  failAt,
  warnLabel = 'Slow',
  failLabel = 'Too slow',
  height = 132,
}: {
  points: readonly TrendPoint[];
  unit: string;
  label: string;
  timeZone: string;
  decimals?: number;
  /** Above this the reading is worth a look: a faint band from here up. */
  warnAt?: number;
  /** Above this it is wrong: a dashed line, and a stronger band. */
  failAt?: number;
  warnLabel?: string;
  failLabel?: string;
  height?: number;
}) {
  const gradient = useId().replace(/:/g, '');
  const data = points.filter((p) => p.value !== null) as { at: number; value: number }[];
  const values = data.map((p) => p.value);
  const peak = Math.max(0, ...values);
  // The scale always shows the warning line when there is one, so a calm hour reads as calm, not as a cliff.
  const ceiling = Math.max(peak * 1.15, warnAt !== undefined ? warnAt * 1.2 : 0, 1);
  const top = failAt !== undefined && peak >= failAt ? peak * 1.15 : ceiling;
  const word = (v: number) => (failAt !== undefined && v >= failAt ? failLabel : warnAt !== undefined && v >= warnAt ? warnLabel : 'Normal');

  return (
    <figure aria-label={label} className="w-full">
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.fillTop} stopOpacity={0.28} />
                <stop offset="100%" stopColor={C.fillTop} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="2 4" />
            {warnAt !== undefined ? <ReferenceArea y1={warnAt} y2={failAt ?? top} fill={C.warn} fillOpacity={0.07} ifOverflow="hidden" /> : null}
            {failAt !== undefined && top > failAt ? <ReferenceArea y1={failAt} y2={top} fill={C.fail} fillOpacity={0.08} ifOverflow="hidden" /> : null}
            {warnAt !== undefined ? (
              <ReferenceLine y={warnAt} stroke={C.warn} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: `${warnLabel} ${fmt(warnAt, 0)}`, position: 'insideTopRight', fill: C.warn, fontSize: 10, fontFamily: 'var(--font-mono)' }} ifOverflow="extendDomain" />
            ) : null}
            {failAt !== undefined && top > failAt ? (
              <ReferenceLine y={failAt} stroke={C.fail} strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: `${failLabel} ${fmt(failAt, 0)}`, position: 'insideTopRight', fill: C.fail, fontSize: 10, fontFamily: 'var(--font-mono)' }} />
            ) : null}
            <XAxis
              dataKey="at"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => clock(v, timeZone)}
              tick={{ fill: C.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={36}
              tickCount={4}
            />
            <YAxis
              width={40}
              domain={[0, top]}
              tickCount={3}
              tickFormatter={(v: number) => fmt(v, v < 10 && decimals > 0 ? decimals : 0)}
              tick={{ fill: C.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: C.axis, strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as { at: number; value: number } | undefined) : undefined;
                if (!p) return null;
                const w = word(p.value);
                return (
                  <div className="flex min-w-popover-min flex-col gap-2 rounded-control bg-overlay px-12 py-8 shadow-popover">
                    <span className="font-mono text-micro text-ink-subtle">{clock(p.at, timeZone)}</span>
                    <span className="font-mono tabular text-num-md text-ink">
                      {fmt(p.value, decimals)} <span className="text-micro text-ink-subtle">{unit}</span>
                    </span>
                    <span className={w === 'Normal' ? 'text-micro text-poured' : w === warnLabel ? 'text-micro text-low' : 'text-micro text-stop'}>{w}</span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={C.line}
              strokeWidth={2}
              fill={`url(#${gradient})`}
              isAnimationActive
              animationDuration={700}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === data.length - 1 && props.cx !== undefined && props.cy !== undefined ? (
                  <g key="last">
                    <circle cx={props.cx} cy={props.cy} r={6} fill={C.dot} fillOpacity={0.2} />
                    <circle cx={props.cx} cy={props.cy} r={3} fill={C.dot} stroke={C.surface} strokeWidth={1.5} />
                  </g>
                ) : (
                  <g key={`d${props.index}`} />
                )
              }
              activeDot={{ r: 4, fill: C.dot, stroke: C.surface, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((p) => (
            <tr key={p.at}>
              <th scope="row">{clock(p.at, timeZone)}</th>
              <td>
                {fmt(p.value, decimals)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
