'use client';

import { formatBps } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { gsap, isInstant, isReduced, play, vars } from '../../motion/engine';
import { ICON_STROKE } from '../icon';
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

export interface MetricProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  delta?: { bps: number; against: string } | null;
  tone?: 'default' | 'attention';
}

/**
 * A headline figure on the Console overview. The card is the one raised surface; nothing inside it
 * carries a background or a border. docs/10 N1.
 */
export function Metric({ label, value, detail, delta, tone = 'default' }: MetricProps) {
  const up = delta ? delta.bps >= 0 : false;
  return (
    <RevealSection className="flex min-w-0 flex-col gap-8 rounded-md border border-hairline bg-raised p-20 shadow-raised">
      <h2 className="text-label text-ink-subtle">{label}</h2>
      <div className={cx('font-mono tabular text-title-lg tracking-[-0.03em]', tone === 'attention' ? 'text-attention' : 'text-ink')}>{value}</div>
      <div className="flex min-h-[19px] flex-wrap items-center gap-x-12 gap-y-4 text-body-sm">
        {delta ? (
          <span className={cx('inline-flex items-center gap-4', up ? 'text-poured' : 'text-low')}>
            {up ? <IconArrowUpRight size={16} stroke={ICON_STROKE} aria-hidden="true" /> : <IconArrowDownRight size={16} stroke={ICON_STROKE} aria-hidden="true" />}
            <span className="font-mono tabular">{formatBps(delta.bps, { signed: true })}</span>
            <span>vs {delta.against}</span>
          </span>
        ) : null}
        {detail ? <span className="text-ink-subtle">{detail}</span> : null}
      </div>
    </RevealSection>
  );
}

export function MoneyFigure({ value, delayMs }: { value: Cents; delayMs?: number }) {
  void delayMs;
  return <AnimatedMoney value={value} animation="metric.count" size="title-lg" fromZeroOnMount tone="default" />;
}
