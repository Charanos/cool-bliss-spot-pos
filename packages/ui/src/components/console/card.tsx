import Link from 'next/link';
import { type ElementType, type ReactNode, isValidElement } from 'react';
import { cx } from '../../lib/cx';
import { ICON_STROKE, type TablerIcon } from '../icon';
import { type Tone, washTone } from '../status';

/**
 * The Card family, docs/19-console-system.md section 1. A card is one surface on the page: a
 * dashboard tile, a record in a grid, a detail panel. It holds a header, a body, stats and a
 * footer; the header and footer can be bands (a tint on a strip of the same card), never a card
 * inside a card. Dense data (tables, forms, settings) sits on the page in the Pane family instead.
 *
 * A card with `href` is one link: its title is a stretched link, so the whole card is a single tab
 * stop that opens in a new tab on middle click, while buttons inside it (z-raised) stay their own
 * targets. Never an onClick on a div.
 */
export function Card({
  as: Tag = 'section',
  interactive,
  tone,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Lift under the pointer. Set automatically when a CardHeader inside has an href. */
  interactive?: boolean;
  /** A 2px edge in a tone on the card's leading side, for a record that needs a second look. */
  tone?: Extract<Tone, 'stop' | 'low' | 'accent' | 'poured'>;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Tag
      {...rest}
      className={cx(
        'relative flex min-w-0 flex-col overflow-hidden card-surface',
        interactive && 'card-interactive',
        tone && 'before:absolute before:inset-y-12 before:left-0 before:w-2 before:rounded-r-sm',
        tone === 'stop' && 'before:bg-stop',
        tone === 'low' && 'before:bg-low',
        tone === 'accent' && 'before:bg-accent',
        tone === 'poured' && 'before:bg-poured',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

function renderIcon(icon: TablerIcon | ReactNode, size: number) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Glyph = icon as TablerIcon;
  return <Glyph size={size} stroke={ICON_STROKE} aria-hidden="true" />;
}

/** An icon in a small tinted square, the one ornament a card header carries. */
export function IconTile({ icon, tone = 'neutral', size = 'sm' }: { icon: TablerIcon | ReactNode; tone?: Tone; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center rounded-md', size === 'md' ? 'size-control-md' : 'size-control-sm', washTone[tone])}>
      {renderIcon(icon, size === 'md' ? 20 : 16)}
    </span>
  );
}

export type HeadingLevel = 'h2' | 'h3' | 'h4';

/**
 * A card's header: title, optional subtitle, icon and actions. `band` tints it as a strip with one
 * rule under it. `href` makes the title the card's stretched link.
 */
export function CardHeader({
  title,
  subtitle,
  icon,
  tone,
  actions,
  meta,
  band = false,
  href,
  level = 'h3',
  titleId,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: TablerIcon | ReactNode;
  tone?: Tone;
  actions?: ReactNode;
  /** A chip or count beside the title. */
  meta?: ReactNode;
  band?: boolean;
  href?: string;
  level?: HeadingLevel;
  titleId?: string;
  className?: string;
}) {
  const Heading = level;
  return (
    <header className={cx('flex items-start justify-between gap-12 px-20', band ? 'card-band border-b border-edge py-12' : 'pb-12 pt-16', className)}>
      <div className="flex min-w-0 items-start gap-12">
        {icon ? <IconTile icon={icon} tone={tone} /> : null}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-8">
            <Heading id={titleId} className="min-w-0 truncate text-title-card text-ink">
              {href ? (
                <Link href={href} className="link-stretched rounded-sm focus-visible:outline-offset-4">
                  {title}
                </Link>
              ) : (
                title
              )}
            </Heading>
            {meta}
          </div>
          {subtitle ? <p className="text-body-sm text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="relative z-raised flex shrink-0 items-center gap-4">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, children, flush = false }: { className?: string; children: ReactNode; flush?: boolean }) {
  return <div className={cx('min-w-0 flex-1', flush ? null : 'px-20 pb-20', className)}>{children}</div>;
}

const statColumns = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 desktop:grid-cols-4' } as const;

/** Label-over-value pairs in a grid: the heart of a record card. */
export function CardStats({ columns = 2, className, children }: { columns?: 2 | 3 | 4; className?: string; children: ReactNode }) {
  return <dl className={cx('grid gap-x-16 gap-y-12 px-20 py-16', statColumns[columns], className)}>{children}</dl>;
}

/** One label over one value. The value keeps tabular figures so a column of them never shifts. */
export function Stat({ label, children, tone, className }: { label: ReactNode; children: ReactNode; tone?: Extract<Tone, 'stop' | 'low' | 'poured' | 'accent'>; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-2', className)}>
      <dt className="label-caps truncate text-ink-subtle">{label}</dt>
      <dd
        className={cx(
          'min-w-0 truncate text-ui font-medium tabular',
          tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : tone === 'poured' ? 'text-poured' : tone === 'accent' ? 'text-accent-text' : 'text-ink',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** The foot of a card: a stronger band, usually the one figure that matters and a way on. */
export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <footer className={cx('mt-auto flex items-center justify-between gap-12 border-t border-edge px-20 py-12 card-band-strong', className)}>{children}</footer>;
}
