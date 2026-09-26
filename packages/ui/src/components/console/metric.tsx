'use client';

import { formatBps } from '@bliss/shared/format';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { gsap, isInstant, isReduced, play, vars } from '../../motion/engine';
import type { TablerIcon } from '../icon';
import type { Tone } from '../status';
import { Card, CardBody, CardHeader, IconTile } from './card';

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
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

export type MetricTone = 'default' | 'attention' | 'poured' | 'stop' | 'info';

const iconTone: Record<MetricTone, Tone> = { default: 'neutral', attention: 'low', poured: 'poured', stop: 'stop', info: 'accent' };
const valueTone: Record<MetricTone, string> = { default: 'text-ink', attention: 'text-low', poured: 'text-ink', stop: 'text-stop', info: 'text-ink' };

export interface MetricProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** A change against a comparison: "+4.2% vs last Friday". Up reads as good unless `invert`. */
  delta?: { bps: number; against: string; invert?: boolean } | null;
  tone?: MetricTone;
  icon?: TablerIcon | ReactNode;
  badge?: ReactNode;
  /** A link on the whole card, to the view the figure comes from. */
  href?: string;
  className?: string;
}

/**
 * A headline figure: a label, the figure in mono, and a line of context. One card of the Card
 * family; a row of them sits in a MetricGrid so their figures share a baseline.
 */
export function Metric({ label, value, detail, delta, tone = 'default', icon, badge, href, className }: MetricProps) {
  const id = useId();
  const good = delta ? (delta.bps >= 0) !== Boolean(delta.invert) : false;
  return (
    <Card as="article" aria-labelledby={id} interactive={Boolean(href)} className={cx('min-h-kpi-min', className)}>
      <CardHeader title={<span className="text-body-sm font-medium text-ink-muted">{label}</span>} titleId={id} level="h3" href={href} actions={badge ?? (icon ? <IconTile icon={icon} tone={iconTone[tone]} /> : null)} className="pb-8" />
      <CardBody className="flex flex-col justify-between gap-12">
        <p className={cx('font-mono tabular text-num-kpi', valueTone[tone])}>{value}</p>
        {delta || detail ? (
          <p className="flex flex-wrap items-center gap-x-8 gap-y-4 text-body-sm text-ink-muted">
            {delta ? (
              <span className={cx('inline-flex items-center gap-2 font-medium tabular', good ? 'text-poured' : 'text-low')}>
                {delta.bps >= 0 ? <IconArrowUpRight size={14} stroke={2} aria-hidden="true" /> : <IconArrowDownRight size={14} stroke={2} aria-hidden="true" />}
                {formatBps(delta.bps, { signed: true })}
                <span className="font-regular text-ink-subtle">vs {delta.against}</span>
              </span>
            ) : null}
            {detail ? <span>{detail}</span> : null}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** A row of metrics: four across a desktop, two on anything narrower, one shared rhythm. */
export function MetricGrid({ children, columns = 4, className }: { children: ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  return <div className={cx('grid grid-cols-1 gap-16 pad:grid-cols-2', columns === 4 ? 'desktop:grid-cols-4' : columns === 3 ? 'desktop:grid-cols-3' : null, className)}>{children}</div>;
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
 * A titled card for a dashboard section. Kept for pages not yet moved to Card and CardHeader
 * directly; it renders exactly that.
 */
export function ConsoleBentoCard({ icon, title, subtitle, badge, action, tone = 'default', children, className }: ConsoleBentoCardProps) {
  return (
    <Card className={cx('h-full', className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        tone={iconTone[tone]}
        level="h2"
        actions={
          badge || action ? (
            <>
              {badge}
              {action}
            </>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col">{children}</CardBody>
    </Card>
  );
}
