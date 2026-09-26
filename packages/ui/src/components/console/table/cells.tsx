import type { ReactNode } from 'react';
import { cx } from '../../../lib/cx';

/** A numeric cell: JetBrains Mono, tabular figures, right aligned by its column. */
export function NumCell({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'muted' | 'stop' | 'low' | 'poured' }) {
  return (
    <span
      className={cx(
        'font-mono tabular text-num-md',
        tone === 'muted' ? 'text-ink-subtle' : tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : tone === 'poured' ? 'text-poured' : 'text-ink',
      )}
    >
      {children}
    </span>
  );
}

/** Two lines in one cell: a name and a quiet detail. */
export function StackCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-ui font-medium text-ink">{primary}</span>
      {secondary ? <span className="truncate text-body-sm text-ink-subtle">{secondary}</span> : null}
    </span>
  );
}
