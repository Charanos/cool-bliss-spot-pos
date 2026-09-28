import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { type Tone, dotTone } from '../status';

/**
 * Gauges for a figure against its whole: a ring for one share (a score, how much of the menu is
 * priced), a segmented bar for how a whole splits into states, and a funnel for how far things got.
 * Each says its figures in text beside or under the shape, so the shape is never the only carrier,
 * and each draws in once on arrival (gauge-sweep, gauge-grow-x). Server safe. docs/19 section 3.
 */

const strokeTone: Record<Tone, string> = {
  poured: 'stroke-poured',
  served: 'stroke-served',
  low: 'stroke-low',
  stop: 'stroke-stop',
  info: 'stroke-info',
  neutral: 'stroke-ink-subtle',
  accent: 'stroke-accent',
};

const ringSize = { sm: 'size-control-xl', md: 'size-72', lg: 'size-96' } as const;

/**
 * A ring filled to `value` (0 to 1) in its tone, on a quiet track, with anything in its middle.
 * `label` names it for a screen reader, as a meter.
 */
export function RingGauge({
  value,
  tone = 'accent',
  size = 'md',
  label,
  children,
  className,
}: {
  value: number;
  tone?: Tone;
  size?: keyof typeof ringSize;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const share = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const pct = Math.round(share * 1000) / 10;
  const stroke = size === 'sm' ? 10 : size === 'md' ? 8 : 7;
  const r = 50 - stroke / 2;
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cx('relative inline-flex shrink-0 items-center justify-center', ringSize[size], className)}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
        <circle cx={50} cy={50} r={r} fill="none" strokeWidth={stroke} className="stroke-band-strong" />
        {pct > 0 ? (
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} 100`}
            className={cx('gauge-sweep', strokeTone[tone])}
          />
        ) : null}
      </svg>
      {children !== undefined ? <span className="relative flex flex-col items-center justify-center text-center">{children}</span> : null}
    </span>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

/**
 * A whole split into its states, as one bar of segments with a 2px gap between them, and a legend
 * under it with every state's count (none left out, so a zero still reads). Colour, word and count
 * together.
 */
export function SegmentBar({ segments, label, legend = true, className }: { segments: readonly Segment[]; label: string; legend?: boolean; className?: string }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className={cx('flex flex-col gap-12', className)}>
      <div role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`} className="flex h-12 w-full gap-2 overflow-hidden rounded-pill">
        {total === 0 ? (
          <span className="h-full w-full rounded-pill bg-band-strong" />
        ) : (
          shown.map((s, i) => (
            <span
              key={s.key}
              className={cx('gauge-grow-x h-full first:rounded-l-pill last:rounded-r-pill', dotTone[s.tone])}
              style={{ flexGrow: s.value, flexBasis: 0, animationDelay: `${i * 80}ms` } as CSSProperties}
            />
          ))
        )}
      </div>
      {legend ? (
        <ul className="flex flex-wrap gap-x-20 gap-y-8">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-8 text-body-sm">
              <span aria-hidden="true" className={cx('size-dot rounded-dot', dotTone[s.tone])} />
              <span className="text-ink-muted">{s.label}</span>
              <span className="font-mono tabular text-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * How far things got, stage by stage: each stage a labelled bar against the first, with its count
 * and its share of the first. For messages: made, sent, delivered, read.
 */
export function Funnel({ stages, className }: { stages: readonly { key: string; label: string; value: number; tone?: Tone }[]; className?: string }) {
  const first = Math.max(1, stages[0]?.value ?? 0);
  return (
    <ol className={cx('flex flex-col gap-12', className)}>
      {stages.map((s, i) => {
        const share = Math.min(1, s.value / first);
        return (
          <li key={s.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-12">
            <span className="truncate text-body-sm text-ink-muted">{s.label}</span>
            <span aria-hidden="true" className="relative h-8 overflow-hidden rounded-pill bg-band-strong">
              {s.value > 0 ? <span className={cx('gauge-grow-x absolute inset-y-0 left-0 rounded-pill', dotTone[s.tone ?? 'accent'])} style={{ width: `${(share * 100).toFixed(1)}%`, animationDelay: `${i * 90}ms` }} /> : null}
            </span>
            <span className="flex items-baseline gap-8 font-mono tabular">
              <span className="text-num-sm text-ink">{s.value}</span>
              {i > 0 ? <span className="w-40 text-right text-micro text-ink-subtle">{stages[0]!.value > 0 ? `${Math.round(share * 100)}%` : '–'}</span> : <span className="w-40" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
