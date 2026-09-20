'use client';

import type { ReactNode } from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';

export type MetricTileTone = 'neutral' | 'stop' | 'poured' | 'accent' | 'served' | 'attention';

export interface SettingsMetricTileProps {
  label: string;
  value: ReactNode;
  subtitle?: string;
  icon?: TablerIcon;
  tone?: MetricTileTone;
  className?: string;
}

const toneStyles: Record<
  MetricTileTone,
  {
    wrap: string;
    icon: string;
  }
> = {
  neutral: {
    wrap: 'bg-control/60 border-rule-raised/30',
    icon: 'text-ink-subtle',
  },
  stop: {
    wrap: 'bg-stop/10 border-stop/30',
    icon: 'text-stop',
  },
  poured: {
    wrap: 'bg-poured/10 border-poured/30',
    icon: 'text-poured',
  },
  accent: {
    wrap: 'bg-accent/10 border-accent/30',
    icon: 'text-accent-text',
  },
  served: {
    wrap: 'bg-served/10 border-served/30',
    icon: 'text-served',
  },
  attention: {
    wrap: 'bg-attention/10 border-attention/30',
    icon: 'text-attention',
  },
};

/**
 * Compact operational metric tile for Settings panels.
 * Conforms strictly to bliss/one-pane and bliss/max-font-weight.
 */
export function SettingsMetricTile({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = 'neutral',
  className,
}: SettingsMetricTileProps) {
  const t = toneStyles[tone];

  return (
    <div
      className={cx(
        'rounded-lg border p-16 tablet:p-20 flex flex-col justify-between gap-10 transition-all',
        t.wrap,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-10">
        <span className="font-mono text-micro uppercase tracking-wider text-ink-subtle truncate">
          {label}
        </span>
        {Icon ? <Icon size={16} stroke={ICON_STROKE} className={t.icon} /> : null}
      </div>

      <div className="flex items-baseline gap-6 leading-none">
        <span className="font-mono tabular text-title-lg font-medium text-ink">
          {value}
        </span>
        {subtitle ? (
          <span className="font-mono text-micro text-ink-subtle truncate">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
