import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import type { Tone } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * One Overview section: a card with a banded header, its content, and a footer link to the page it
 * summarises, so every figure on the Overview is one click from where it comes from.
 */
export function Panel({
  id,
  icon,
  tone,
  title,
  subtitle,
  meta,
  actions,
  href,
  hrefLabel,
  cardTone,
  className,
  children,
}: {
  id: string;
  icon: TablerIcon;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  href?: string;
  hrefLabel?: string;
  cardTone?: 'stop' | 'low';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={`${id}-title`} tone={cardTone} className={className}>
      <CardHeader band level="h2" titleId={`${id}-title`} icon={icon} tone={tone} title={title} subtitle={subtitle} meta={meta} actions={actions} />
      <div className="flex flex-1 flex-col">{children}</div>
      {href ? <PanelLink href={href}>{hrefLabel ?? 'Open'}</PanelLink> : null}
    </Card>
  );
}

/** The way from a section to its page, at the foot of the card. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group mt-auto flex items-center justify-between gap-12 border-t border-edge px-20 py-12 text-body-sm text-ink-muted transition-hover hover:bg-band hover:text-ink">
      <span>{children}</span>
      <IconArrowRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="transition-transform group-hover:translate-x-2 motion-reduce:transition-none" />
    </Link>
  );
}

/** A label over a figure, for a panel's strip of small counts. */
export function Figure({ label, children, tone, className }: { label: ReactNode; children: ReactNode; tone?: 'stop' | 'low' | 'poured'; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-2', className)}>
      <dt className="label-caps truncate text-ink-subtle">{label}</dt>
      <dd className={cx('font-mono tabular text-num-md', tone === 'stop' ? 'text-stop' : tone === 'low' ? 'text-low' : tone === 'poured' ? 'text-poured' : 'text-ink')}>{children}</dd>
    </div>
  );
}

/** When a section has nothing to show yet: an icon, a line, and what will fill it. */
export function PanelEmpty({ icon: Glyph, title, body }: { icon: TablerIcon; title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-20 py-40 text-center">
      <span className="flex size-control-lg items-center justify-center rounded-pill bg-band text-ink-subtle">
        <Glyph size={22} stroke={ICON_STROKE} aria-hidden="true" />
      </span>
      <p className="text-ui text-ink">{title}</p>
      <p className="measure text-body-sm text-ink-muted">{body}</p>
    </div>
  );
}
