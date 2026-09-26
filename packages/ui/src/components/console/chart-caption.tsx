import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * The line above a chart that says what to look at: the busiest hour and what it took, the best
 * day. An icon on a tinted tile, the label, the figures, and a note on the trailing side. Server
 * safe. docs/19 section 3.
 */
export function ChartCaption({
  icon,
  label,
  figures,
  note,
  className,
}: {
  icon?: ReactNode;
  label: ReactNode;
  /** One or two figures, set in mono and separated by a hairline slash. */
  figures: readonly ReactNode[];
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-12 rounded-control bg-band px-12 py-8', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-12">
        {icon ? <span className="flex size-control-sm shrink-0 items-center justify-center rounded-md bg-attention-wash text-attention">{icon}</span> : null}
        <span className="text-body-sm font-medium text-ink">{label}</span>
        {figures.map((figure, i) => (
          <span key={i} className="flex items-center gap-12">
            <span aria-hidden="true" className="text-ink-disabled">
              /
            </span>
            <span className="font-mono tabular text-num-md text-ink">{figure}</span>
          </span>
        ))}
      </div>
      {note ? <span className="label-caps text-ink-subtle">{note}</span> : null}
    </div>
  );
}
