import { EmptyState } from '@bliss/ui/components/feedback';
import { cx } from '@bliss/ui/lib/cx';
import type { ReactNode } from 'react';

/**
 * The glass the Counter's panes are cut from: the Floor's order card, at the Counter's scale.
 * One pane per thing, never a pane inside a pane (bliss/one-pane).
 */
export const PANE = 'rounded-[20px] border border-rule-raised/40 bg-raised/70 backdrop-blur-glass tablet:rounded-[22px]';

/** A pane with a caps heading and an optional figure or action on the right of it. */
export function Pane({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx(PANE, 'flex flex-col', className)}>
      {title ? (
        <header className="flex min-h-control-lg items-center justify-between gap-12 border-b border-rule-raised/30 px-16 py-8">
          <h2 className="caps text-ink-subtle">{title}</h2>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** An empty view, centred in the space it has, never a card with zeros in it. */
export function Quiet({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <EmptyState align="center" title={title} body={body} action={action} />
    </div>
  );
}
