'use client';

import type { ReactNode } from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';

export type SettingsTone = 'accent' | 'poured' | 'attention' | 'served' | 'stop' | 'neutral';

export interface SettingsCardProps {
  icon: TablerIcon;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  tone?: SettingsTone;
  children: ReactNode;
  className?: string;
}

const toneMap: Record<
  SettingsTone,
  {
    iconWrap: string;
    icon: string;
    topRule: string;
    borderHover: string;
  }
> = {
  accent: {
    iconWrap: 'bg-accent/15 border border-accent/30 text-accent-text',
    icon: 'text-accent-text',
    topRule: 'from-accent/60 via-accent/20 to-transparent',
    borderHover: 'hover:border-accent/40',
  },
  poured: {
    iconWrap: 'bg-poured/15 border border-poured/30 text-poured',
    icon: 'text-poured',
    topRule: 'from-poured/60 via-poured/20 to-transparent',
    borderHover: 'hover:border-poured/40',
  },
  attention: {
    iconWrap: 'bg-attention/15 border border-attention/30 text-attention',
    icon: 'text-attention',
    topRule: 'from-attention/60 via-attention/20 to-transparent',
    borderHover: 'hover:border-attention/40',
  },
  served: {
    iconWrap: 'bg-served/15 border border-served/30 text-served',
    icon: 'text-served',
    topRule: 'from-served/60 via-served/20 to-transparent',
    borderHover: 'hover:border-served/40',
  },
  stop: {
    iconWrap: 'bg-stop/15 border border-stop/30 text-stop',
    icon: 'text-stop',
    topRule: 'from-stop/60 via-stop/20 to-transparent',
    borderHover: 'hover:border-stop/40',
  },
  neutral: {
    iconWrap: 'bg-control border border-rule-raised/50 text-ink-subtle',
    icon: 'text-ink-subtle',
    topRule: 'from-rule-raised/60 via-rule-raised/20 to-transparent',
    borderHover: 'hover:border-rule-raised/80',
  },
};

/**
 * Production-grade frosted glass Bento card for Floor Settings console.
 * Strictly adheres to docs/12-surface-language.md, bliss/one-pane and bliss/max-font-weight.
 */
export function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
  tone = 'neutral',
  children,
  className,
}: SettingsCardProps) {
  const t = toneMap[tone];

  return (
    <div
      className={cx(
        'relative flex flex-col overflow-hidden rounded-lg p-20 tablet:p-24 desktop:p-32 transition-all duration-200 select-none group',
        // Sleek frosted glass surface with depth
        'bg-raised/70 backdrop-blur-md border border-rule-raised/40 shadow-lift',
        t.borderHover,
        className,
      )}
    >
      {/* Ambient Top Glow Line */}
      <div
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r',
          t.topRule,
        )}
      />

      {/* ── Header Row ────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col tablet:flex-row tablet:items-center justify-between gap-16 tablet:gap-12 pb-16 tablet:pb-20 border-b border-rule-raised/25">
        <div className="flex items-center gap-12 min-w-0">
          <div
            className={cx(
              'size-[32px] rounded-md flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105',
              t.iconWrap,
            )}
          >
            <Icon size={18} stroke={ICON_STROKE} className={t.icon} />
          </div>

          <div className="flex flex-col min-w-0">
            <h2 className="text-title font-medium tracking-tight text-ink truncate leading-tight">
              {title}
            </h2>
            {subtitle ? (
              <span className="font-mono text-micro text-ink-subtle truncate mt-2">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8 shrink-0">
          {badge ? <div>{badge}</div> : null}
          {action ? <div>{action}</div> : null}
        </div>
      </div>

      {/* ── Content Body ─────────────────────────────────────────── */}
      <div className="relative z-10 pt-16 tablet:pt-20 flex flex-col gap-16 flex-1">
        {children}
      </div>
    </div>
  );
}
