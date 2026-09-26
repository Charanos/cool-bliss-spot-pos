import { cx } from '../../lib/cx';

/**
 * A small trend drawn inline: bars (hours of a night, days of a week) or a line (a cost over time).
 * No axes and no labels; the figure beside it carries the number, and `label` says what the shape
 * is to a screen reader. Server safe. docs/19 section 3.
 */
export function Sparkline({
  values,
  label,
  variant = 'bars',
  highlight = 'peak',
  className,
}: {
  values: readonly number[];
  label: string;
  variant?: 'bars' | 'line';
  /** Which bar wears the accent: the highest, the last (now), or none. */
  highlight?: 'peak' | 'last' | 'none';
  className?: string;
}) {
  const width = 100;
  const height = 28;
  const max = Math.max(0, ...values);
  const min = variant === 'line' ? Math.min(...values) : 0;
  const span = max - min || 1;
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1;

  if (values.length === 0) return null;

  if (variant === 'line') {
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const last = values.length - 1;
    return (
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cx('h-24 w-full overflow-visible', className)}>
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" className="stroke-chart" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last * step} cy={y(values[last]!)} r={2} className="fill-accent" />
      </svg>
    );
  }

  const gap = 2;
  const bar = (width - gap * (values.length - 1)) / values.length;
  const peak = values.indexOf(max);
  const lit = highlight === 'peak' ? peak : highlight === 'last' ? values.length - 1 : -1;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cx('h-24 w-full', className)}>
      {values.map((v, i) => {
        const h = max > 0 ? Math.max(1.5, ((v - min) / span) * height) : 1.5;
        return <rect key={i} x={i * (bar + gap)} y={height - h} width={bar} height={h} rx={1} className={i === lit && v > 0 ? 'fill-accent' : 'fill-chart-muted'} />;
      })}
    </svg>
  );
}
