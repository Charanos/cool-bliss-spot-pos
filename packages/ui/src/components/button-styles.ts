import { cx } from '../lib/cx';

/**
 * The one button look, shared by <Button> and <ButtonLink> so a link that looks like a button is
 * exactly the button it resembles. docs/06 section 6.1, docs/19 section 3. No client code here, so
 * a server component can style a link with it.
 */
export type ButtonVariant = 'primary' | 'create' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'quiet-destructive' | 'tender';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink font-medium shadow-control-primary hover:bg-accent-hover active:bg-accent-pressed',
  /* The one way to make something new on a page: the primary, as a pill, its plus turning a quarter. */
  create: 'bg-accent text-accent-ink font-medium shadow-control-primary hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'bg-control text-ink font-medium shadow-control hover:bg-control-hover active:bg-control-pressed',
  ghost: 'bg-transparent text-ink-muted hover:bg-control hover:text-ink active:bg-control-hover',
  /* The Console's quiet action beside a primary: the card surface with its edge. */
  outline: 'bg-card text-ink font-medium border border-edge-strong hover:bg-control active:bg-control-hover',
  destructive: 'bg-stop text-stop-ink font-medium hover:opacity-90 active:opacity-80',
  'quiet-destructive': 'bg-transparent text-stop hover:bg-stop-wash active:bg-stop-wash',
  tender: 'bg-control text-ink text-subtitle hover:bg-control-hover active:bg-control-pressed',
};

const sizeClass: Record<ButtonSize, string> = {
  xs: 'h-row-compact px-12 text-body-sm gap-6',
  sm: 'h-control-sm px-12 text-body-sm gap-6',
  md: 'h-control-md px-16 text-body gap-8',
  lg: 'h-control-lg px-20 text-body gap-8',
  xl: 'h-control-xl px-24 text-subtitle gap-12',
};

const roundClass: Record<ButtonSize, string> = { xs: 'rounded-md', sm: 'rounded-md', md: 'rounded-control', lg: 'rounded-control', xl: 'rounded-lg' };

const iconOnlyClass: Record<ButtonSize, string> = {
  xs: 'w-row-compact px-0',
  sm: 'w-control-sm px-0',
  md: 'w-control-md px-0',
  lg: 'w-control-lg px-0',
  xl: 'w-control-xl px-0',
};

/** The class a button's icon wears: the create button's plus turns under the pointer. */
export function buttonIconClass(variant: ButtonVariant): string {
  return variant === 'create' ? 'shrink-0 turn-on-hover' : 'shrink-0';
}

export const buttonIconPx: Record<ButtonSize, number> = { xs: 16, sm: 16, md: 20, lg: 20, xl: 24 };

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  fullWidth = false,
  disabled = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}): string {
  return cx(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap press-feedback press-scale',
    variantClass[variant],
    sizeClass[size],
    variant === 'create' ? 'rounded-pill' : roundClass[size],
    iconOnly && iconOnlyClass[size],
    fullWidth && 'w-full',
    disabled && 'bg-control text-ink-disabled shadow-none hover:bg-control active:scale-100',
    className,
  );
}
