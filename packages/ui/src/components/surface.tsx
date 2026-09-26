import { type ElementType, type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cx } from '../lib/cx';

/**
 * The pane: the one raised surface. docs/06-design-system.md sections 1 and 5.
 * Dark: frost-800 with a frost-700 hairline and no shadow. Light: frost-50, frost-200 hairline and
 * one soft shadow. Nothing inside a Pane may carry its own background or box border.
 */
export const Pane = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { as?: ElementType; padded?: boolean | 'lg' }>(function Pane(
  { as: Tag = 'section', padded = true, className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      {...rest}
      className={cx('rounded-md border border-hairline bg-raised shadow-raised', padded === 'lg' ? 'p-24' : padded ? 'p-16' : null, className)}
    >
      {children}
    </Tag>
  );
});

/** A single hairline. Grouping is space and one rule, never a box. */
export function Rule({ className, raised = false }: { className?: string; raised?: boolean }) {
  return <hr className={cx('h-px border-0', raised ? 'bg-rule-raised' : 'bg-rule', className)} />;
}



/** A polite live region for availability changes and connection state. */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
