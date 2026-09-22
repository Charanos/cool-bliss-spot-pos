import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

export type MetricTone = 'accent' | 'money' | 'poured' | 'served' | 'stop' | 'low' | 'neutral';

export interface MetricTileProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon: TablerIcon;
  tone?: MetricTone;
  badge?: ReactNode;
  className?: string;
}

const TONE: Record<MetricTone, { tile: string; rule: string }> = {
  accent: { tile: 'bg-accent/15 text-accent-text', rule: 'from-accent/60 via-accent/20 to-transparent' },
  money: { tile: 'bg-money/15 text-money', rule: 'from-money/60 via-money/20 to-transparent' },
  poured: { tile: 'bg-poured/15 text-poured', rule: 'from-poured/60 via-poured/20 to-transparent' },
  served: { tile: 'bg-served/15 text-served', rule: 'from-served/60 via-served/20 to-transparent' },
  stop: { tile: 'bg-stop/15 text-stop', rule: 'from-stop/60 via-stop/20 to-transparent' },
  low: { tile: 'bg-low/15 text-low', rule: 'from-low/60 via-low/20 to-transparent' },
  neutral: { tile: 'bg-control text-ink-subtle', rule: 'from-rule-raised/60 via-rule-raised/20 to-transparent' },
};

/**
 * A metric on a working surface: the Floor's shift, the Counter's drawer and bills. One figure and
 * the one line that says what it counts, on a glass pane with a hairline of its tone across the top.
 *
 * It sizes itself to what it holds rather than to a fixed height, so a phone in portrait gets
 * readable tiles instead of tall boxes with a number floating in them.
 */
export function MetricTile({ label, value, subtitle, icon: Icon, tone = 'neutral', badge, className }: MetricTileProps) {
  const t = TONE[tone];
  return (
    <div
      className={cx(
        'relative flex min-w-0 flex-col gap-12 overflow-hidden rounded-md border border-rule-raised/40 bg-raised/70 p-12 backdrop-blur-glass pad:gap-16 pad:rounded-lg pad:p-16',
        className,
      )}
    >
      <span aria-hidden="true" className={cx('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r', t.rule)} />

      <div className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-center gap-8">
          <span className={cx('flex size-24 shrink-0 items-center justify-center rounded-sm', t.tile)}>
            <Icon size={14} stroke={ICON_STROKE} aria-hidden="true" />
          </span>
          <span className="min-w-0 text-body-sm text-ink-subtle">{label}</span>
        </div>
        {/* The tone already says this; on a phone the words would cost the label its room. */}
        {badge ? <span className="hidden shrink-0 compact:block">{badge}</span> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-baseline">{value}</div>
        {subtitle ? <p className="text-micro text-ink-subtle">{subtitle}</p> : null}
      </div>
    </div>
  );
}
