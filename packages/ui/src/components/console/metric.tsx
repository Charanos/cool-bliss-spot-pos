import { formatBps } from '@bliss/shared/format';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import type { TablerIcon } from '../icon';
import type { Tone } from '../status';
import { Card, CardBody, CardHeader, IconTile } from './card';

export { CountUp } from './count-up';

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
 * A headline figure: a label, the figure in mono, and a line of context. Renders on the server or
 * the client, so a server page can pass it an icon component; only CountUp inside it is client. One card of the Card
 * family; a row of them sits in a MetricGrid so their figures share a baseline.
 */
export function Metric({ label, value, detail, delta, tone = 'default', icon, badge, href, className }: MetricProps) {
  const good = delta ? (delta.bps >= 0) !== Boolean(delta.invert) : false;
  return (
    <Card as="article" aria-label={label} interactive={Boolean(href)} className={cx('min-h-kpi-min', className)}>
      <CardHeader title={<span className="text-body-sm font-medium text-ink-muted">{label}</span>} level="h3" href={href} actions={badge ?? (icon ? <IconTile icon={icon} tone={iconTone[tone]} /> : null)} className="pb-8" />
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
