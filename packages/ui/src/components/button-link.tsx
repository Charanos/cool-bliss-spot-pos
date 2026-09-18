import Link, { type LinkProps } from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

type Variant = 'primary' | 'secondary' | 'ghost';

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-medium hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'bg-control text-ink hover:bg-control-hover active:bg-control-pressed',
  ghost: 'bg-transparent text-ink-muted hover:bg-control hover:text-ink',
};

const sizeClass = { md: 'h-control-md px-16 text-body gap-8', lg: 'h-control-lg px-16 text-body gap-8' } as const;

/**
 * A navigation that looks like a button. A link inside a button, or a button inside a link, is
 * invalid and confuses assistive technology; this is one element that does one thing.
 */
export function ButtonLink({
  href,
  children,
  variant = 'secondary',
  size = 'md',
  icon: Glyph,
  className,
  ...rest
}: LinkProps & { children: ReactNode; variant?: Variant; size?: 'md' | 'lg'; icon?: TablerIcon; className?: string }) {
  return (
    <Link
      href={href}
      {...rest}
      className={cx('inline-flex items-center justify-center whitespace-nowrap rounded-sm press-feedback active:scale-[0.985]', variantClass[variant], sizeClass[size], className)}
    >
      {Glyph ? <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </Link>
  );
}
