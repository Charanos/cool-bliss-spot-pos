import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { type ButtonSize, type ButtonVariant, buttonClass, buttonIconPx } from './button-styles';
import { ICON_STROKE, type TablerIcon } from './icon';

/**
 * A navigation that looks like a button, in exactly the button's style. A link inside a button, or a
 * button inside a link, is invalid and confuses assistive technology; this is one element that does
 * one thing.
 */
export function ButtonLink({
  href,
  children,
  variant = 'secondary',
  size = 'sm',
  icon: Glyph,
  iconPosition = 'start',
  className,
  ...rest
}: LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    variant?: Exclude<ButtonVariant, 'tender'>;
    size?: ButtonSize;
    icon?: TablerIcon;
    iconPosition?: 'start' | 'end';
    className?: string;
  }) {
  const glyph = Glyph ? <Glyph size={buttonIconPx[size]} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" /> : null;
  return (
    <Link href={href} {...rest} className={buttonClass({ variant, size, className })}>
      {iconPosition === 'start' ? glyph : null}
      <span className="truncate">{children}</span>
      {iconPosition === 'end' ? glyph : null}
    </Link>
  );
}
