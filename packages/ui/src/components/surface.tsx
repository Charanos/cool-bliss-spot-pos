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

/** Section heading inside a page or pane: a subtitle, optional meta, optional trailing actions. */
export function SectionHeading({
  title,
  meta,
  actions,
  as: Tag = 'h2',
  size = 'subtitle',
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'title-lg' | 'title' | 'subtitle';
  className?: string;
}) {
  return (
    <div className={cx('flex min-w-0 flex-wrap items-end gap-x-16 gap-y-8', className)}>
      <div className="min-w-0 flex-1">
        <Tag className={cx('text-ink', size === 'title-lg' ? 'text-title-lg' : size === 'title' ? 'text-title' : 'text-subtitle')}>{title}</Tag>
        {meta ? <p className={cx('text-ink-subtle', size === 'title-lg' ? 'mt-4 text-body' : 'text-body-sm')}>{meta}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-8">{actions}</div> : null}
    </div>
  );
}

/** Screen reader only text. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** A polite live region for availability changes and connection state. */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
