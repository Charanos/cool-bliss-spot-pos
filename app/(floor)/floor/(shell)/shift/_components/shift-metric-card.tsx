'use client';

import type { ReactNode } from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';

export type MetricTone = 'accent' | 'money' | 'poured' | 'served' | 'stop' | 'neutral';

export interface ShiftMetricCardProps {
  label: string;
  value: ReactNode;
  subtitle: ReactNode;
  icon: TablerIcon;
  tone?: MetricTone;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const toneStyles: Record<
  MetricTone,
  {
    iconWrap: string;
    icon: string;
    borderGlow: string;
    topRule: string;
    aura: string;
  }
> = {
  accent: {
    iconWrap: 'bg-accent/15 border border-accent/30 text-accent-text',
    icon: 'text-accent-text',
    borderGlow: 'hover:border-accent/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]',
    topRule: 'from-accent/60 via-accent/20 to-transparent',
    aura: 'from-accent/10 to-transparent',
  },
  money: {
    iconWrap: 'bg-money/15 border border-money/30 text-money',
    icon: 'text-money',
    borderGlow: 'hover:border-money/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-money)_25%,transparent)]',
    topRule: 'from-money/60 via-money/20 to-transparent',
    aura: 'from-money/10 to-transparent',
  },
  poured: {
    iconWrap: 'bg-poured/15 border border-poured/30 text-poured',
    icon: 'text-poured',
    borderGlow: 'hover:border-poured/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-poured)_25%,transparent)]',
    topRule: 'from-poured/60 via-poured/20 to-transparent',
    aura: 'from-poured/10 to-transparent',
  },
  served: {
    iconWrap: 'bg-served/15 border border-served/30 text-served',
    icon: 'text-served',
    borderGlow: 'hover:border-served/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-served)_25%,transparent)]',
    topRule: 'from-served/60 via-served/20 to-transparent',
    aura: 'from-served/10 to-transparent',
  },
  stop: {
    iconWrap: 'bg-stop/15 border border-stop/30 text-stop',
    icon: 'text-stop',
    borderGlow: 'hover:border-stop/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-stop)_25%,transparent)]',
    topRule: 'from-stop/60 via-stop/20 to-transparent',
    aura: 'from-stop/10 to-transparent',
  },
  neutral: {
    iconWrap: 'bg-control border border-rule-raised/50 text-ink-subtle',
    icon: 'text-ink-subtle',
    borderGlow: 'hover:border-rule-raised/80 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)]',
    topRule: 'from-rule-raised/60 via-rule-raised/20 to-transparent',
    aura: 'from-control/15 to-transparent',
  },
};

/**
 * Production-grade tactile metric card for the Floor Waiter Shift console.
 * Complies strictly with docs/12-surface-language.md, bliss/one-pane and bliss/max-font-weight.
 */
export function ShiftMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = 'neutral',
  badge,
  onClick,
  className,
}: ShiftMetricCardProps) {
  const t = toneStyles[tone];

  return (
    <div
      className={cx(
        'relative flex flex-col justify-between overflow-hidden rounded-lg p-18 tablet:p-20 transition-all duration-300 select-none group min-h-[148px]',
        // Sleek frosted glass surface with depth
        'bg-raised/70 backdrop-blur-md border border-rule-raised/40 shadow-lift',
        // Hover dynamics
        t.borderGlow,
        onClick ? 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.99]' : 'hover:-translate-y-0.5',
        className,
      )}
      onClick={onClick}
    >
      {/* Ambient Top Glow Line */}
      <div
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r',
          t.topRule,
        )}
      />

      {/* Subtle Top-Left Ambient Aura */}
      <div
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute -top-16 -left-16 size-40 rounded-dot bg-gradient-to-br blur-2xl opacity-50 transition-opacity group-hover:opacity-90',
          t.aura,
        )}
      />

      {/* ── Top Row: Icon Tile + Title + Status Badge ───────────────── */}
      <div className="relative z-10 flex items-center justify-between gap-10">
        <div className="flex items-center gap-8 min-w-0">
          {/* Proportional 28px Icon Tile */}
          <div
            className={cx(
              'size-[28px] rounded-md flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105',
              t.iconWrap,
            )}
          >
            <Icon size={15} stroke={ICON_STROKE} className={t.icon} />
          </div>

          <span className="text-body-sm font-medium text-ink-subtle truncate leading-tight">
            {label}
          </span>
        </div>

        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {/* ── Center / Bottom: Prominent Metric & Context Subtitle ─────── */}
      <div className="relative z-10 flex flex-col gap-6 mt-12">
        <div className="min-w-0 flex items-baseline leading-none">{value}</div>
        <div className="font-mono text-micro text-ink-subtle truncate flex items-center gap-6">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
