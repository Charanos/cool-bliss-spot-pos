'use client';

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useDelayedFlag } from '../hooks';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'quiet-destructive' | 'tender';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

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

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-ink)_22%,transparent),0_6px_18px_-8px_color-mix(in_oklab,var(--color-accent)_55%,transparent)] hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'bg-control text-ink shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-ink)_8%,transparent)] hover:bg-control-hover active:bg-control-pressed',
  ghost: 'bg-transparent text-ink-muted hover:bg-control hover:text-ink active:bg-control-hover',
  destructive: 'bg-stop text-stop-ink font-medium hover:opacity-90 active:opacity-80',
  'quiet-destructive': 'bg-transparent text-stop hover:bg-control active:bg-control-hover',
  tender: 'bg-control text-ink text-subtitle hover:bg-control-hover active:bg-control-pressed',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-control-sm rounded-[10px] px-12 text-body-sm gap-6',
  md: 'h-control-md rounded-[12px] px-16 text-body gap-8',
  lg: 'h-control-lg rounded-[14px] px-20 text-body gap-8',
  xl: 'h-control-xl rounded-[16px] px-24 text-subtitle gap-12',
};

const iconOnlySize: Record<ButtonSize, string> = {
  sm: 'w-control-sm',
  md: 'w-control-md',
  lg: 'w-control-lg',
  xl: 'w-control-xl',
};

const iconPx: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 20, xl: 24 };

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

  if (process.env.NODE_ENV !== 'production' && iconOnly && !rest['aria-label']) {
    console.warn('Button: an icon-only button needs an aria-label.');
  }

  const inert = disabled || loading;
  const glyph = Glyph ? <Glyph size={iconPx[size]} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0" /> : null;
  const spinner = <Spinner size={iconPx[size] === 24 ? 20 : 16} tone={variant === 'primary' || variant === 'destructive' ? 'on-accent' : 'default'} />;
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
      className={cx(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap press-feedback active:scale-[0.985]',
        variantClass[variant],
        sizeClass[size],
        iconOnly && cx(iconOnlySize[size], 'px-0'),
        fullWidth && 'w-full',
        disabled && 'bg-control text-ink-disabled hover:bg-control active:scale-100',
        className,
      )}
    >
      {leading}
      {iconOnly ? null : <span className="truncate">{children}</span>}
      {trailing}
    </button>
  );
});
