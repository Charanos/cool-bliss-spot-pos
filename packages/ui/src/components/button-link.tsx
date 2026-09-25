import Link, { type LinkProps } from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

type Variant = 'primary' | 'secondary' | 'ghost';

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.15),_0_4px_12px_rgba(0,0,0,0.1)] hover:bg-accent-hover hover:scale-[1.02] active:bg-accent-pressed active:scale-[0.98] transition-all duration-200',
  secondary: 'bg-page text-ink ring-1 ring-hairline/30 shadow-[0_2px_8px_rgba(0,0,0,0.04),_0_1px_2px_rgba(0,0,0,0.02)] hover:bg-control/50 hover:ring-hairline/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),_0_1px_2px_rgba(0,0,0,0.02)] active:bg-control active:scale-[0.98] transition-all duration-200',
  ghost: 'bg-transparent text-ink-subtle hover:bg-control/60 hover:text-ink active:bg-control transition-all duration-200',
};

const sizeClass = { md: 'h-[36px] px-16 text-body-sm font-medium gap-8', lg: 'h-[44px] px-20 text-body font-medium gap-10' } as const;

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
}: LinkProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & { children: ReactNode; variant?: Variant; size?: 'md' | 'lg'; icon?: TablerIcon; className?: string }) {
  return (
    <Link
      href={href}
      {...rest}
      className={cx('group inline-flex items-center justify-center whitespace-nowrap rounded-full press-feedback', variantClass[variant], sizeClass[size], className)}
    >
      {Glyph ? <Glyph size={18} stroke={1.5} aria-hidden="true" className="shrink-0 text-ink-subtle group-hover:text-ink transition-colors" /> : null}
      <span className="truncate">{children}</span>
    </Link>
  );
}
