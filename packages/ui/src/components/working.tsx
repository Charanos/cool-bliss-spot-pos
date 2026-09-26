import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Eyebrow } from './atmosphere';
import { SeatChip, type SeatChipSize } from './seat-chip';

/**
 * Working surfaces, docs/13-floor-tabs-revamp.md: the flat counterpart to the atmosphere layer, for
 * the screens a waiter works in. One pane, no blur, a hairline and a tone step, with the same type,
 * spacing and interaction contract as the revamped entry and sign-in screens.
 *
 * Server safe. Nothing here holds state.
 */

type Emphasis = 'default' | 'mine' | 'attention';

const EMPHASIS: Record<Emphasis, string> = {
  default: '',
  // An owned tab uses a soft ambient glow and background tint, with a very subtle inner glass ring, no hard colored borders.
  mine: 'shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-accent)_10%,transparent),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.03)] texture-dots-accent',
  attention: 'shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-stop)_10%,transparent),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.03)] texture-dots-stop',
};

/** The class list for a tappable pane, for an element the wrappers below cannot be. */
export function paneClass({ emphasis = 'default', selected = false }: { emphasis?: Emphasis; selected?: boolean } = {}) {
  return cx('surface-pane-interactive relative min-w-0 text-left', EMPHASIS[emphasis], selected && 'border-accent bg-accent-wash');
}

/** A raised pane that acts: a tab card, a table choice. Phrasing content only inside a button. */
export function PaneButton({
  emphasis = 'default',
  selected = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { emphasis?: Emphasis; selected?: boolean }) {
  return (
    <button {...rest} type={type} aria-pressed={rest['aria-pressed'] ?? (selected ? true : undefined)} className={cx(paneClass({ emphasis, selected }), className)}>
      {children}
    </button>
  );
}


/** An invitation: a free table, an empty slot. Dashed, unfilled, never a card with zeros in it. */
export function InviteButton({ className, type = 'button', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} type={type} className={cx('group surface-invite relative min-w-0 text-left', className)}>
      {children}
    </button>
  );
}

type CountTone = 'accent' | 'stop' | 'neutral' | 'attention';

const COUNT_TONE: Record<CountTone, string> = {
  accent: 'bg-accent text-accent-ink',
  stop: 'bg-stop text-stop-ink',
  neutral: 'bg-control-hover text-ink',
  attention: 'bg-attention text-seat-ink',
};

/**
 * A count on a nav item or a chip. Filled, so it reads at arm's length; capped at 99+. The number is
 * decorative when the label beside it already says it, so pass `label` only when it stands alone.
 */
export function CountBadge({ count, tone = 'accent', max = 99, label, className }: { count: number; tone?: CountTone; max?: number; label?: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cx('inline-flex h-count min-w-count items-center justify-center rounded-dot px-4 font-mono tabular text-num-sm leading-none', COUNT_TONE[tone], className)}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

export interface MetaItem {
  key: string;
  text: ReactNode;
  /** Figures and durations set in JetBrains Mono. */
  mono?: boolean;
}

/**
 * A line of facts separated by middle dots: "Tab 12 · Terrace · 4h12 · Amina". The dots are
 * decorative; a screen reader hears the facts as a list of phrases.
 */
export function MetaLine({ items, className }: { items: readonly (MetaItem | null | false)[]; className?: string }) {
  const shown = items.filter((i): i is MetaItem => Boolean(i));
  return (
    <p className={cx('flex min-w-0 flex-wrap items-baseline gap-x-8 gap-y-2 text-body-sm text-ink-muted', className)}>
      {shown.map((item, i) => (
        // The dot travels with the fact that follows it, so a line that wraps never ends on a dot.
        <span key={item.key} className="inline-flex min-w-0 items-baseline gap-x-8">
          {i > 0 ? (
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
          ) : null}
          <span className={cx('min-w-0 truncate', item.mono && 'font-mono tabular text-num-sm')}>{item.text}</span>
        </span>
      ))}
    </p>
  );
}

export interface StackSeat {
  seatNo: number;
  status?: string;
  settled?: boolean;
  label?: string | null;
  selected?: boolean;
}

/**
 * Seat chips in a row with a quiet overflow: seven seats on a 240px card become six chips and "+1".
 * One accessible name for the group, because eight separate "Seat n" announcements are noise.
 */
export function SeatChipStack({ seats, max = 6, size = 'tile', className, overlapping = false }: { seats: readonly StackSeat[]; max?: number; size?: SeatChipSize; className?: string; overlapping?: boolean }) {
  const shown = seats.slice(0, max);
  const hidden = seats.length - shown.length;
  const settled = seats.filter((s) => s.settled).length;
  const name = `${seats.length} ${seats.length === 1 ? 'seat' : 'seats'}${settled > 0 ? `, ${settled} settled` : ''}`;
  if (overlapping) {
    return (
      // `w-fit` keeps the group the width of its chips: as a flex child it would otherwise stretch
      // to the card and read as an empty bar with two chips in the corner.
      <span role="img" aria-label={name} className={cx('inline-flex w-fit items-center self-start rounded-dot border border-rule-raised/30 bg-sunken/60 p-4', className)}>
        <span className="flex items-center -space-x-[4px]">
          {shown.map((s, i) => (
            <span key={s.seatNo} className="relative flex rounded-dot" style={{ zIndex: shown.length - i }}>
              <SeatChip seat={s.seatNo} size={size} settled={s.settled} label={s.label} className="pointer-events-none" />
            </span>
          ))}
        </span>
        {hidden > 0 ? <span className="pl-4 pr-6 font-mono tabular text-micro text-ink-muted">+{hidden}</span> : null}
      </span>
    );
  }

  return (
    <span role="img" aria-label={name} className={cx('flex min-w-0 flex-wrap items-center gap-6', className)}>
      {shown.map((s) => (
        <span key={s.seatNo} className="relative flex">
          <SeatChip seat={s.seatNo} size={size} settled={s.settled} label={s.label} className="pointer-events-none" />
          {s.selected ? (
            <span className="absolute -inset-[2px] rounded-full texture-dots-accent ring-2 ring-accent pointer-events-none" />
          ) : null}
        </span>
      ))}
      {hidden > 0 ? <span className="font-mono tabular text-num-sm text-ink-subtle">+{hidden}</span> : null}
    </span>
  );
}

/**
 * A section heading on a working surface: mono capitals, a count, and an optional action. The same
 * label style as the sign-in screen, set flat.
 */
export function SectionHeader({
  id,
  title,
  count,
  action,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { id: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div {...rest} className={cx('flex min-h-control-md items-center justify-between gap-16', className)}>
      <span className="flex items-baseline gap-12">
        <Eyebrow as="h2" id={id}>
          {title}
        </Eyebrow>
        {count !== undefined ? <span className="font-mono tabular text-num-sm text-ink-subtle">{count}</span> : null}
      </span>
      {action}
    </div>
  );
}
