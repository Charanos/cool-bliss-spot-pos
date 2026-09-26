import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { ICON_STROKE, type TablerIcon } from '../icon';
import type { HeadingLevel } from './card';

/**
 * The Pane family and the small parts every Console page is composed from. docs/19 section 3.
 * A Section is flat: a heading, a line of context, actions, and content on the page itself. Tables,
 * forms and settings live here; the Card family is for dashboards, grids and records.
 */
export function Section({
  title,
  description,
  actions,
  level = 'h2',
  id,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: HeadingLevel;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cx('flex min-w-0 flex-col gap-16', className)}>
      {title ? <SectionHeader title={title} description={description} actions={actions} level={level} titleId={headingId} /> : null}
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  level = 'h2',
  titleId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: HeadingLevel;
  titleId?: string;
  className?: string;
}) {
  const Heading = level;
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-24 gap-y-8', className)}>
      <div className="flex min-w-0 flex-col gap-4">
        <Heading id={titleId} className={cx('text-ink', level === 'h2' ? 'text-title-section' : 'text-title-card')}>
          {title}
        </Heading>
        {description ? <p className="measure text-body-sm text-pretty text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div> : null}
    </div>
  );
}

/** Capitals over a value. Write the words in sentence case; the capitals are presentation. */
export function Overline({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'p' | 'dt' }) {
  return <Tag className={cx('label-caps text-ink-subtle', className)}>{children}</Tag>;
}

/** A rule between parts of a page, optionally named. One hairline, never a gradient. */
export function Separator({ label, className }: { label?: ReactNode; className?: string }) {
  if (!label) return <hr className={cx('border-0 border-t border-rule', className)} />;
  return (
    <div role="separator" className={cx('flex items-center gap-12', className)}>
      <span className="label-caps shrink-0 text-ink-subtle">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
    </div>
  );
}

export interface KeyValue {
  label: ReactNode;
  value: ReactNode;
  /** Numbers and codes in mono, so they align and read as figures. */
  mono?: boolean;
  hint?: ReactNode;
}

/**
 * Labels and values as a real description list. `columns` sets how many pairs sit side by side;
 * `layout="inline"` puts label and value on one row, for a settings page or a record's facts.
 */
export function KeyValueList({ items, columns = 1, layout = 'stacked', className }: { items: readonly KeyValue[]; columns?: 1 | 2 | 3 | 4; layout?: 'stacked' | 'inline'; className?: string }) {
  const grid = columns === 4 ? 'desktop:grid-cols-4 grid-cols-2' : columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1';
  if (layout === 'inline') {
    return (
      <dl className={cx('flex flex-col', className)}>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-kv items-baseline gap-16 border-b border-rule py-12 last:border-b-0">
            <dt className="text-body-sm text-ink-muted">{item.label}</dt>
            <dd className={cx('min-w-0 text-ui text-ink', item.mono && 'font-mono tabular')}>
              {item.value}
              {item.hint ? <p className="mt-2 text-body-sm text-ink-subtle">{item.hint}</p> : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cx('grid gap-x-24 gap-y-16', grid, className)}>
      {items.map((item, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-4">
          <dt className="label-caps text-ink-subtle">{item.label}</dt>
          <dd className={cx('min-w-0 text-ui text-ink', item.mono && 'font-mono tabular')}>{item.value}</dd>
          {item.hint ? <p className="text-body-sm text-ink-subtle">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export interface MetaItem {
  icon?: TablerIcon;
  label?: string;
  value: ReactNode;
}

/** Facts on one line, separated by a quiet middle dot: "Table 4 · Opened 21:04 · Grace". */
export function MetaRow({ items, className }: { items: readonly (MetaItem | null | false)[]; className?: string }) {
  const shown = items.filter(Boolean) as MetaItem[];
  return (
    <p className={cx('flex flex-wrap items-center gap-x-8 gap-y-4 text-body-sm text-ink-muted', className)}>
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span aria-hidden="true" className="text-ink-subtle">
              ·
            </span>
          ) : null}
          <span className="inline-flex items-center gap-6">
            {item.icon ? <item.icon size={14} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-subtle" /> : null}
            {item.label ? <span className="text-ink-subtle">{item.label}</span> : null}
            <span className="tabular">{item.value}</span>
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/** A row of headline figures across a page or a card band: Total, Settled, Voided. */
export function SummaryStrip({ items, className }: { items: readonly { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cx('flex flex-wrap items-baseline gap-x-32 gap-y-12', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-4">
          <dt className="label-caps text-ink-subtle">{item.label}</dt>
          <dd className="text-ui font-medium text-ink tabular">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A timeline or a list of entries hung on one hairline rail, not boxed. */
export function LedgerList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <ol aria-label={label} className={cx('flex flex-col border-l border-rule', className)}>
      {children}
    </ol>
  );
}

export function LedgerItem({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'stop' | 'poured' | 'low' }) {
  return (
    <li
      className={cx(
        'relative py-8 pl-16 before:absolute before:left-0 before:top-16 before:size-dot before:-translate-x-1/2 before:rounded-dot',
        tone === 'stop' ? 'before:bg-stop' : tone === 'poured' ? 'before:bg-poured' : tone === 'low' ? 'before:bg-low' : 'before:bg-hairline',
        className,
      )}
    >
      {children}
    </li>
  );
}

/**
 * The header of a record page: the way back to the list it came from, the record's name, its
 * status, a line of facts and its actions. A record page has no workspace tabs above it.
 */
export function DetailHeader({
  back,
  title,
  status,
  meta,
  actions,
  className,
}: {
  back: { href: string; label: string };
  title: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('flex flex-col gap-12 pb-24', className)}>
      <Link href={back.href} className="inline-flex w-fit items-center gap-4 rounded-sm text-body-sm text-ink-muted transition-hover hover:text-ink">
        <span aria-hidden="true">←</span>
        {back.label}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-24 gap-y-12">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex min-w-0 flex-wrap items-center gap-12">
            <h1 className="text-title-page text-balance text-ink">{title}</h1>
            {status}
          </div>
          {meta}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * A notice that belongs to the page: something that needs a person, said once, with what to do and
 * the one figure that matters. A wash of its tone, not a card: it sits above the work, not inside it.
 */
export function Callout({
  tone = 'low',
  title,
  children,
  aside,
  action,
  className,
}: {
  tone?: 'stop' | 'low' | 'info' | 'poured';
  title: ReactNode;
  children?: ReactNode;
  /** A figure or a short fact on the trailing side. */
  aside?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      role="status"
      className={cx(
        'flex flex-wrap items-center justify-between gap-x-24 gap-y-12 rounded-card px-20 py-16',
        tone === 'stop' ? 'bg-stop-wash' : tone === 'info' ? 'bg-info-wash' : tone === 'poured' ? 'bg-poured-wash' : 'bg-low-wash',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-12">
        <span aria-hidden="true" className={cx('mt-6 size-dot shrink-0 rounded-dot', tone === 'stop' ? 'bg-stop' : tone === 'info' ? 'bg-info' : tone === 'poured' ? 'bg-poured' : 'bg-low')} />
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-title-card text-ink">{title}</p>
          {children ? <p className="measure text-body-sm text-ink-muted">{children}</p> : null}
        </div>
      </div>
      {aside || action ? (
        <div className="flex shrink-0 items-center gap-16">
          {aside}
          {action}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The foot of a bill, an order or a delivery: the parts, then the one figure they come to, under a
 * rule. Values are right-aligned so their figures line up with the column above.
 */
export function Totals({
  items,
  total,
  className,
}: {
  items: readonly ({ label: ReactNode; value: ReactNode } | null | false)[];
  total: { label: ReactNode; value: ReactNode };
  className?: string;
}) {
  const shown = items.filter(Boolean) as { label: ReactNode; value: ReactNode }[];
  return (
    <dl className={cx('flex flex-col gap-8', className)}>
      {shown.map((item, i) => (
        <div key={i} className="flex items-baseline justify-between gap-16">
          <dt className="text-body-sm text-ink-muted">{item.label}</dt>
          <dd className="text-right">{item.value}</dd>
        </div>
      ))}
      <div className="mt-4 flex items-baseline justify-between gap-16 border-t border-rule pt-12">
        <dt className="text-title-card text-ink">{total.label}</dt>
        <dd className="text-right">{total.value}</dd>
      </div>
    </dl>
  );
}
