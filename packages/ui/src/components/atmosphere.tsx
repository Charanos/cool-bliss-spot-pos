import { IconArrowRight } from '@tabler/icons-react';
import Link, { type LinkProps } from 'next/link';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

/**
 * The atmosphere layer, docs/12-surface-language.md: the glass, light and photography first set on
 * the entry and sign-in screens, as primitives. Every value comes from a token or a utility in
 * styles/base.css, so a Floor screen adopts the language by composing these, never by copying
 * class strings.
 *
 * Server safe: nothing here holds state. The live clock lives in ./atmosphere-clock.
 */

type Padding = 'none' | 'sm' | 'md';

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-16',
  md: 'p-24 tablet:p-32',
};

/** The class list for a glass pane, for the rare element none of the wrappers below can be. */
export function glassClass({ interactive = false, padding = 'md' }: { interactive?: boolean; padding?: Padding } = {}) {
  return cx('surface-glass relative overflow-hidden', interactive && 'surface-glass-interactive group', PADDING[padding]);
}

export function GlassPane({
  as: Tag = 'div',
  padding = 'md',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li'; padding?: Padding }) {
  return (
    <Tag {...rest} className={cx(glassClass({ padding }), className)}>
      {children}
    </Tag>
  );
}

/** A glass pane that navigates. The whole pane is the target; nothing interactive nests inside. */
export function GlassLink({ padding = 'md', className, children, ...rest }: LinkProps & { padding?: Padding; className?: string; children: ReactNode; 'aria-label'?: string }) {
  return (
    <Link {...rest} className={cx(glassClass({ interactive: true, padding }), className)}>
      {children}
    </Link>
  );
}

/** A glass pane that acts. Content inside must be phrasing content: spans, never headings. */
export function GlassButton({ padding = 'sm', className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { padding?: Padding }) {
  return (
    <button {...rest} type={type} className={cx(glassClass({ interactive: true, padding }), 'text-left', className)}>
      {children}
    </button>
  );
}

type EyebrowTone = 'subtle' | 'muted' | 'ink' | 'accent' | 'attention' | 'poured';

const EYEBROW_TONE: Record<EyebrowTone, string> = {
  subtle: 'text-ink-subtle',
  muted: 'text-ink-muted',
  ink: 'text-ink',
  accent: 'text-accent-text',
  attention: 'text-attention',
  poured: 'text-poured',
};

/**
 * A label above content, in mono capitals. Pass sentence case: "Who is working", not "WHO IS
 * WORKING". `size="caps"` is the tighter tracking for a label beside a value.
 */
export function Eyebrow({
  as: Tag = 'span',
  tone = 'subtle',
  size = 'eyebrow',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'span' | 'p' | 'h2' | 'h3'; tone?: EyebrowTone; size?: 'eyebrow' | 'caps' }) {
  return (
    <Tag {...rest} className={cx(size, EYEBROW_TONE[tone], className)}>
      {children}
    </Tag>
  );
}

/**
 * The affordance in the corner of an interactive pane. Decorative: the pane carries the name.
 * It nudges on the pane's hover, which only exists where a pointer can hover.
 */
export function ActionNode({ icon: Glyph = IconArrowRight, shape = 'square', className }: { icon?: TablerIcon; shape?: 'square' | 'round'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex size-node shrink-0 items-center justify-center text-ink-subtle transition-[transform,background-color,border-color,color] duration-[var(--bliss-duration-surface)] ease-out',
        shape === 'square'
          ? 'rounded-sm border border-glass-edge bg-sunken/50 group-hover:translate-x-2 group-hover:border-hairline group-hover:text-ink'
          : 'rounded-dot bg-veil group-hover:bg-veil-hover group-hover:text-ink',
        className,
      )}
    >
      <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
    </span>
  );
}

/** A hairline that fades out. Horizontal by default; `y` for a divider between two panels. */
export function FadeRule({ orientation = 'x', className }: { orientation?: 'x' | 'y'; className?: string }) {
  return <span aria-hidden="true" className={cx('block shrink-0', orientation === 'x' ? 'rule-fade-x w-[160px]' : 'rule-fade-y', className)} />;
}

export function VeilButton({ icon: Glyph, children, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: TablerIcon }) {
  return (
    <button 
      {...rest} 
      type={type} 
      className={cx(
        'surface-veil group inline-flex h-control-md items-center gap-8 rounded-dot px-20 text-ink-subtle',
        'transition-all duration-[400ms] ease-out',
        'hover:text-ink hover:shadow-raised hover:-translate-y-[1px]',
        'active:scale-[0.98] active:translate-y-0 active:duration-75',
        className
      )}
    >
      {Glyph ? (
        <Glyph 
          size={16} 
          stroke={ICON_STROKE} 
          aria-hidden="true" 
          className="transition-transform duration-[400ms] ease-out group-hover:-translate-x-2 group-hover:scale-110" 
        />
      ) : null}
      <span className="eyebrow tracking-[0.15em] transition-colors duration-[400ms]">{children}</span>
    </button>
  );
}

/** sm is the Floor touch target, for the waiter in the nav rail; md a card; lg the PIN screen. */
const AVATAR_SIZE = { sm: 'size-control-lg', md: 'size-avatar', lg: 'size-avatar-lg' } as const;

/**
 * A person, as a photograph or as initials. Decorative when the name is printed beside it, which it
 * always should be. The ring and the slight desaturation keep a photo from out-shouting the name.
 */
export function Avatar({ src, name, size = 'md', className }: { src?: string | null; name: string; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-dot border border-hairline/50 bg-sunken/60 transition-colors duration-[var(--bliss-duration-surface)] group-hover:border-hairline/90',
        size === 'lg' && 'ring-1 ring-hairline/10',
        AVATAR_SIZE[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a staff photograph from the asset store, cached for offline sign-in
        <img
          src={src}
          alt=""
          className="size-full object-cover grayscale-[15%] transition-[filter,transform] duration-[var(--bliss-duration-surface)] ease-out group-hover:scale-105 group-hover:grayscale-0"
        />
      ) : (
        <span className={cx('font-mono text-ink-muted', size === 'lg' ? 'text-num-lg' : size === 'sm' ? 'text-num-sm' : 'text-num')}>{initials}</span>
      )}
    </span>
  );
}

/**
 * A photograph as atmosphere: desaturated into the page's luminance, then faded into the page so
 * text laid over its lower edge keeps its contrast. Never behind dense data.
 */
export function PhotoBackdrop({ src, className }: { src: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('pointer-events-none absolute inset-0 z-0', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative photography, sized by its container */}
      <img src={src} alt="" className="size-full object-cover opacity-60 mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-b from-page/10 via-page/50 to-page" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-page" />
    </div>
  );
}
