'use client';

import { type Cents, cents, formatKes, scale, shareBps, splitParts } from '@bliss/shared/money';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { chartDraw } from '../../motion/console';

export interface BarDatum {
  key: string;
  label: string;
  value: Cents;
}

/**
 * A single series bar chart for money over time. Following the dataviz method:
 *  - one series, so no legend: the title names it
 *  - thin bars from the baseline with a rounded data end, a 2px gap between bars
 *  - recessive grid, axis labels in JetBrains Mono
 *  - a hover tooltip per bar with a hit target the full column height
 *  - a table view for screen readers
 *
 * Heights come from integer basis points of the maximum, so no float ever touches the money.
 * chart.draw runs once, when the chart first enters view.
 */
export function BarChart({
  data,
  height = 200,
  highlightKey,
  caption,
  tooltipLabel = (d) => d.label,
}: {
  data: readonly BarDatum[];
  height?: number;
  /** The bar the story is about (the peak hour): full strength while the others step back. */
  highlightKey?: string;
  caption: string;
  /** How a bar is named in its tooltip: "23:00". */
  tooltipLabel?: (d: BarDatum) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drawn = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const titleId = useId();
  const max = data.reduce((m, d) => (d.value > m ? d.value : m), 0n as Cents);
  const ceiling = niceCeiling(max);
  const ticks = [ceiling, scale(ceiling, 2n, 3n), scale(ceiling, 1n, 3n)];

  useEffect(() => {
    const el = ref.current;
    if (!el || drawn.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !drawn.current) {
          drawn.current = true;
          chartDraw(Array.from(el.querySelectorAll('[data-bar]')));
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hovered = data.find((d) => d.key === hover);
  // Past fourteen bars, label every second or third so the axis stays legible; the tooltip names each.
  const labelEvery = Math.max(1, Math.ceil(data.length / 14));

  return (
    <figure aria-labelledby={titleId} className="relative">
      <figcaption id={titleId} className="sr-only">
        {caption}
      </figcaption>
      <div ref={ref} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-8 pt-6">
        <div aria-hidden="true" className="relative" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2 font-mono tabular text-num-sm text-ink-subtle" style={{ top: `${(i / 3) * 100}%` }}>
              {shortKes(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden="true" className={cx('absolute inset-x-0 h-px', i === 3 ? 'bg-hairline' : 'bg-grid')} style={{ top: `${(i / 3) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-2" onMouseLeave={() => setHover(null)}>
            {data.map((d) => {
              const bps = ceiling > 0n ? shareBps(d.value, ceiling) : 0;
              const active = hover === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onMouseEnter={() => setHover(d.key)}
                  onFocus={() => setHover(d.key)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.label}, ${formatKes(d.value, { decimals: 'whole' })}`}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center outline-offset-0"
                >
                  <span
                    data-bar=""
                    className={cx(
                      'block w-full max-w-20 rounded-t-sm bg-chart transition-hover',
                      hover ? (active ? 'opacity-100' : 'opacity-40') : highlightKey && d.key !== highlightKey ? 'opacity-60' : 'opacity-100',
                    )}
                    style={{ height: `${bps / 100}%`, minHeight: d.value > 0n ? 2 : 0 }}
                  />
                </button>
              );
            })}
          </div>
          {hovered ? (
            <div role="status" className="pointer-events-none absolute -top-12 right-0 z-popover rounded-md border border-edge bg-card px-12 py-8 shadow-popover">
              <p className="label-caps text-ink-subtle">{tooltipLabel(hovered)}</p>
              <p className="font-mono tabular text-num-md text-ink">{formatKes(hovered.value, { decimals: 'whole' })}</p>
            </div>
          ) : null}
        </div>
        <span aria-hidden="true" />
        <div aria-hidden="true" className="flex gap-2">
          {data.map((d, i) => (
            <span key={d.key} className="min-w-0 flex-1 truncate text-center font-mono tabular text-num-sm text-ink-subtle">
              {i % labelEvery === 0 ? d.label : ''}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{formatKes(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Round the axis ceiling up to a readable number of shillings. */
function niceCeiling(max: Cents): Cents {
  const { shillings } = splitParts(max);
  const steps = [1_000n, 2_000n, 5_000n, 10_000n, 20_000n, 50_000n, 100_000n, 200_000n, 500_000n, 1_000_000n];
  for (const s of steps) {
    const rounded = ((shillings + s - 1n) / s) * s;
    if (rounded / s <= 6n) return cents(rounded * 100n);
  }
  return max;
}

function shortKes(value: Cents): string {
  const { shillings } = splitParts(value);
  if (shillings >= 1_000_000n) return `${shillings / 1_000_000n}m`;
  if (shillings >= 1_000n) return `${shillings / 1_000n}k`;
  return shillings.toString();
}

/** Horizontal share bars with the label and figure always in text, so identity never rests on colour. */
export function ShareBars({ rows }: { rows: readonly { key: string; label: string; value: Cents; detail?: string }[] }) {
  const max = rows.reduce((m, r) => (r.value > m ? r.value : m), 0n as Cents);
  return (
    <ul className="flex flex-col">
      {rows.map((r) => {
        const bps = max > 0n ? shareBps(r.value, max) : 0;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(120px,1fr)_2fr_auto] items-center gap-16 border-b border-rule py-8 last:border-b-0">
            <span className="truncate text-ui text-ink">{r.label}</span>
            <span aria-hidden="true" className="relative h-8 overflow-hidden rounded-sm bg-rule">
              <span className="absolute inset-y-0 left-0 rounded-sm bg-chart" style={{ width: `${bps / 100}%` }} />
            </span>
            <span className="flex items-baseline gap-12 whitespace-nowrap">
              {r.detail ? <span className="font-mono tabular text-num-sm text-ink-subtle">{r.detail}</span> : null}
              <span className="font-mono tabular text-num-md text-ink">{formatKes(r.value, { decimals: 'whole' })}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
