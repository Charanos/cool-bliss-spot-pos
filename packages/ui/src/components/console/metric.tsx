'use client';

import { formatBps } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { type ReactNode, useEffect, useRef, useState, isValidElement } from 'react';
import { cx } from '../../lib/cx';
import { gsap, isInstant, isReduced, play, vars } from '../../motion/engine';
import { ICON_STROKE, type TablerIcon } from '../icon';
import { AnimatedMoney } from '../money';
import { RevealSection } from './shell';

/** A whole number that counts up from zero on first paint only. metric.count. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-KE'), delayMs = 0 }: { value: number; format?: (n: number) => string; delayMs?: number }) {
  const [shown, setShown] = useState(() => (isInstant() || isReduced() ? value : 0));
  const started = useRef(false);
  useEffect(() => {
    if (started.current || isInstant() || isReduced()) {
      setShown(value);
      return undefined;
    }
    started.current = true;
    const proxy = { n: 0 };
    const animation = play('metric.count', () => gsap.to(proxy, { ...vars('metric.count', { n: value, onUpdate: () => setShown(proxy.n) }), delay: delayMs / 1000 }));
    if (!animation) setShown(value);
    return () => {
      animation?.progress(1).kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only
  }, [value]);
  return <>{format(shown)}</>;
}

export type MetricTone = 'default' | 'attention' | 'poured' | 'stop' | 'info';

export interface MetricProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  delta?: { bps: number; against: string } | null;
  tone?: MetricTone;
  icon?: TablerIcon | ReactNode;
  badge?: ReactNode;
  className?: string;
}

const toneMap: Record<
  MetricTone,
  {
    topRule: string;
    iconWrap: string;
    icon: string;
    valueTone: string;
  }
> = {
  default: {
    topRule: 'from-accent/50 via-accent/15 to-transparent',
    iconWrap: 'bg-control text-ink-subtle',
    icon: 'text-ink-subtle',
    valueTone: 'text-ink',
  },
  attention: {
    topRule: 'from-attention/60 via-attention/20 to-transparent',
    iconWrap: 'bg-attention/15 text-attention',
    icon: 'text-attention',
    valueTone: 'text-attention',
  },
  poured: {
    topRule: 'from-poured/60 via-poured/20 to-transparent',
    iconWrap: 'bg-poured-wash text-poured',
    icon: 'text-poured',
    valueTone: 'text-ink',
  },
  stop: {
    topRule: 'from-stop/60 via-stop/20 to-transparent',
    iconWrap: 'bg-stop-wash text-stop',
    icon: 'text-stop',
    valueTone: 'text-stop',
  },
  info: {
    topRule: 'from-accent/60 via-accent/20 to-transparent',
    iconWrap: 'bg-accent-wash text-accent-text',
    icon: 'text-accent-text',
    valueTone: 'text-ink',
  },
};

function renderBentoIcon(icon: TablerIcon | ReactNode, toneIconClass: string, size = 18) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in icon)) {
    const Glyph = icon as TablerIcon;
    return <Glyph size={size} stroke={ICON_STROKE} className={toneIconClass} aria-hidden="true" />;
  }
  return null;
}

/**
 * A headline figure on the Console overview and workspace dashboards.
 * Elevated to Bento-grade fidelity matching Floor and Counter surfaces:
 * - Ambient top glow highlight
 * - Crisp header row with eyebrow label and icon slot
 * - JetBrains Mono tabular headline
 * - Refined comparison delta chip
 */
export function Metric({ label, value, detail, delta, tone = 'default', icon, badge, className }: MetricProps) {
  const up = delta ? delta.bps >= 0 : false;
  const t = toneMap[tone];

  return (
    <RevealSection
      className={cx(
        'group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[16px] bg-page p-20 ring-1 ring-hairline/30 shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:ring-hairline/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),_0_1px_3px_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      {/* Ambient Top Glow Line */}
      <div aria-hidden="true" className={cx('pointer-events-none absolute inset-x-0 top-0 h-[1px] opacity-60 bg-gradient-to-r', t.topRule)} />

      {/* Header Row: Label + Icon / Badge */}
      <div className="flex items-start justify-between gap-12 pb-12">
        <div className="flex items-center gap-8">
          {icon ? (
            <div className={cx('flex size-[30px] shrink-0 items-center justify-center rounded-[8px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105', t.iconWrap)}>
              {renderBentoIcon(icon, t.icon, 16)}
            </div>
          ) : null}
          <h2 className="text-body-sm font-medium text-ink-subtle">{label}</h2>
        </div>
        <div className="flex items-center gap-8 shrink-0">
          {badge ? <div>{badge}</div> : null}
        </div>
      </div>

      {/* Headline Value */}
      <div className={cx('font-mono tabular text-title-lg tracking-tight leading-none pt-4 pb-12', t.valueTone)}>
        {value}
      </div>

      {/* Footer Comparison & Context */}
      <div className="flex min-h-[22px] flex-wrap items-center gap-x-10 gap-y-4 text-body-sm">
        {delta ? (
          <span
            className={cx(
              'inline-flex items-center gap-4 rounded-full px-8 py-[2px] text-micro font-medium uppercase tracking-[0.06em]',
              up ? 'bg-poured/10 text-poured' : 'bg-attention/15 text-attention',
            )}
          >
            {up ? <IconArrowUpRight size={13} stroke={2} aria-hidden="true" /> : <IconArrowDownRight size={13} stroke={2} aria-hidden="true" />}
            <span className="tabular">{formatBps(delta.bps, { signed: true })}</span>
            <span className="text-ink-subtle font-normal">vs {delta.against}</span>
          </span>
        ) : null}
        {detail ? <span className="text-body-sm text-ink-subtle">{detail}</span> : null}
      </div>
    </RevealSection>
  );
}

export interface ConsoleBentoCardProps {
  icon?: TablerIcon | ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  tone?: MetricTone;
  children: ReactNode;
  className?: string;
}

/**
 * Production-grade Bento panel for Console dashboards, mirroring the visual language
 * of Floor and Counter cards: ambient glow top rule, crisp header, one-pane elevation.
 */
export function ConsoleBentoCard({
  icon,
  title,
  subtitle,
  badge,
  action,
  tone = 'default',
  children,
  className,
}: ConsoleBentoCardProps) {
  const t = toneMap[tone];

  return (
    <div className={cx('flex flex-col h-full min-h-0', className)}>
      {/* Unguarded Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-12 mb-20 px-4">
        <div className="flex items-center gap-12 min-w-0">
          {icon ? (
            <div className={cx('flex size-[36px] items-center justify-center rounded-[10px] shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ring-1 ring-black/5 transition-transform duration-200 hover:scale-105', t.iconWrap)}>
              {renderBentoIcon(icon, t.icon, 20)}
            </div>
          ) : null}
          <div className="flex flex-col min-w-0">
            <h2 className="text-subtitle font-medium text-ink truncate leading-tight">{title}</h2>
            {subtitle ? <span className="mt-2 text-body-sm text-ink-subtle truncate">{subtitle}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-8 shrink-0">
          {badge ? <div>{badge}</div> : null}
          {action ? <div>{action}</div> : null}
        </div>
      </div>

      {/* Card Body Container */}
      <RevealSection
        className="group relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-[16px] bg-page ring-1 ring-hairline/30 shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:ring-hairline/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),_0_1px_3px_rgba(0,0,0,0.02)]"
      >
        {/* Ambient Top Glow Line inside the card body */}
        <div aria-hidden="true" className={cx('pointer-events-none absolute inset-x-0 top-0 h-[1px] opacity-60 bg-gradient-to-r', t.topRule)} />
        
        <div className="relative z-10 flex flex-col flex-1 p-20 tablet:p-24">{children}</div>
      </RevealSection>
    </div>
  );
}

export function MoneyFigure({ value, delayMs }: { value: Cents; delayMs?: number }) {
  void delayMs;
  return <AnimatedMoney value={value} animation="metric.count" size="title-lg" fromZeroOnMount tone="default" />;
}
