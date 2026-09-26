'use client';

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useDelayedFlag } from '../hooks';
import { ICON_STROKE, type TablerIcon } from './icon';
import { type ButtonSize, type ButtonVariant, buttonClass, buttonIconClass, buttonIconPx } from './button-styles';
import { Spinner } from './spinner';

export type { ButtonSize, ButtonVariant } from './button-styles';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The width is locked before the spinner swaps in, so nothing reflows. */
  loading?: boolean;
  icon?: TablerIcon;
  iconPosition?: 'start' | 'end';
  /** An icon-only button must carry an aria-label. */
  iconOnly?: boolean;
  /** aria-disabled rather than disabled, so a screen reader can still find and explain it. */
  disabled?: boolean;
  fullWidth?: boolean;
  /** Marks a destructive action so dialogs never give it default focus. */
  destructive?: boolean;
  children?: ReactNode;
}

/**
 * Button, docs/06-design-system.md section 6.1. Labels are verbs naming their outcome, carrying the
 * amount or count where money or a batch is involved: "Fire order · 3 lines", "Settle KES 4,200".
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon: Glyph,
    iconPosition = 'start',
    iconOnly = false,
    disabled = false,
    fullWidth = false,
    destructive,
    className,
    children,
    onClick,
    type = 'button',
    style,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);
  const showSpinner = useDelayedFlag(loading);

  useLayoutEffect(() => {
    if (loading && innerRef.current && lockedWidth === null) setLockedWidth(innerRef.current.offsetWidth);
    if (!loading && lockedWidth !== null) setLockedWidth(null);
  }, [loading, lockedWidth]);

  if (process.env.NODE_ENV !== 'production' && iconOnly && !rest['aria-label'] && !rest['aria-labelledby']) {
    console.warn('Button: an icon-only button needs an aria-label.');
  }

  const inert = disabled || loading;
  const glyph = Glyph ? <Glyph size={buttonIconPx[size]} stroke={ICON_STROKE} aria-hidden="true" className={buttonIconClass(variant)} /> : null;
  const spinner = <Spinner size={buttonIconPx[size] === 24 ? 20 : 16} tone={variant === 'primary' || variant === 'create' || variant === 'destructive' ? 'on-accent' : 'default'} />;
  const leading = showSpinner && (iconPosition === 'start' || !Glyph) ? spinner : iconPosition === 'start' ? glyph : null;
  const trailing = iconPosition === 'end' ? (showSpinner && Glyph ? spinner : glyph) : null;

  return (
    <button
      {...rest}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      type={type}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      data-destructive={destructive || variant === 'destructive' || variant === 'quiet-destructive' || undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      style={{ ...style, ...(lockedWidth !== null ? { width: lockedWidth } : null) }}
      className={buttonClass({ variant, size, iconOnly, fullWidth, disabled, className })}
    >
      {leading}
      {iconOnly ? null : <span className="truncate">{children}</span>}
      {trailing}
    </button>
  );
});

/**
 * An icon-only button. The label is required, so it can never be an unnamed control; it also shows
 * as the tooltip on hover.
 */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'iconOnly' | 'children' | 'icon'> & { icon: TablerIcon; label: string }>(function IconButton(
  { icon, label, variant = 'ghost', size = 'sm', title, ...rest },
  ref,
) {
  return <Button ref={ref} {...rest} variant={variant} size={size} icon={icon} iconOnly aria-label={label} title={title ?? label} />;
});
