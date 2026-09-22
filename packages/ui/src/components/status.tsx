import { cx } from '../lib/cx';

export type Tone = 'poured' | 'served' | 'low' | 'stop' | 'info' | 'neutral' | 'accent';

const dotTone: Record<Tone, string> = {
  poured: 'bg-poured',
  served: 'bg-served',
  low: 'bg-low',
  stop: 'bg-stop',
  info: 'bg-info',
  neutral: 'bg-ink-subtle',
  accent: 'bg-accent',
};

const textTone: Record<Tone, string> = {
  poured: 'text-poured',
  served: 'text-served',
  low: 'text-low',
  stop: 'text-stop',
  info: 'text-info',
  neutral: 'text-ink-muted',
  accent: 'text-accent-text',
};

/** A 6px dot. The only circles in the product are dots. */
export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block size-dot shrink-0 rounded-dot', dotTone[tone], className)} />;
}

export type StatusKey =
  | 'open'
  | 'fired'
  | 'poured'
  | 'settled'
  | 'voided'
  | 'low'
  | 'last_few'
  | 'finished'
  | 'on_hold'
  | 'ran_out'
  | 'offline'
  | 'synced'
  | 'held'
  | 'counting'
  | 'review'
  | 'committed'
  | 'cancelled'
  | 'draft'
  | 'sent'
  | 'received'
  | 'partial'
  | 'active'
  | 'suspended'
  | 'lost'
  | 'retired'
  | 'released'
  | 'resolved'
  | 'unresolved';

/**
 * The word and tone for every status. The first twelve are docs/06-design-system.md section 6.8;
 * the rest are the Console lifecycle states from docs/05-flows-and-channels.md, in the same shape.
 */
export const STATUS: Record<StatusKey, { word: string; tone: Tone }> = {
  open: { word: 'Open', tone: 'info' },
  fired: { word: 'Fired', tone: 'info' },
  poured: { word: 'Poured', tone: 'poured' },
  settled: { word: 'Settled', tone: 'poured' },
  voided: { word: 'Voided', tone: 'stop' },
  low: { word: 'Low', tone: 'low' },
  last_few: { word: 'Last few', tone: 'low' },
  finished: { word: 'Finished', tone: 'stop' },
  on_hold: { word: 'On hold', tone: 'low' },
  ran_out: { word: 'Ran out', tone: 'stop' },
  offline: { word: 'Offline', tone: 'info' },
  synced: { word: 'Synced', tone: 'poured' },
  held: { word: 'Held', tone: 'info' },
  counting: { word: 'Counting', tone: 'info' },
  review: { word: 'Review', tone: 'low' },
  committed: { word: 'Committed', tone: 'poured' },
  cancelled: { word: 'Cancelled', tone: 'neutral' },
  draft: { word: 'Draft', tone: 'neutral' },
  sent: { word: 'Sent', tone: 'info' },
  received: { word: 'Received', tone: 'poured' },
  partial: { word: 'Part received', tone: 'low' },
  active: { word: 'Active', tone: 'poured' },
  suspended: { word: 'Suspended', tone: 'low' },
  lost: { word: 'Lost', tone: 'stop' },
  retired: { word: 'Retired', tone: 'neutral' },
  released: { word: 'Released', tone: 'neutral' },
  resolved: { word: 'Resolved', tone: 'poured' },
  unresolved: { word: 'Unresolved', tone: 'stop' },
};

/**
 * Status chip: micro type, 22px tall, a 6px dot plus a word. Colour, dot and word together, so the
 * state survives greyscale. No fill, so a chip can sit on any surface without nesting one.
 */
export function StatusChip({ status, label, className }: { status: StatusKey; label?: string; className?: string }) {
  const { word, tone } = STATUS[status];
  return (
    <span className={cx('inline-flex h-chip-dense shrink-0 items-center gap-6 whitespace-nowrap text-micro micro-caps', textTone[tone], className)}>
      <Dot tone={tone} />
      {label ?? word}
    </span>
  );
}

const pillTone: Record<Tone, string> = {
  poured: 'bg-poured/[0.12] text-poured ring-poured/25',
  served: 'bg-served/[0.12] text-served ring-served/25',
  low: 'bg-low/[0.12] text-low ring-low/25',
  stop: 'bg-stop/[0.14] text-stop ring-stop/30',
  info: 'bg-info/[0.12] text-info ring-info/25',
  neutral: 'bg-sunken/70 text-ink-muted ring-rule-raised/50',
  accent: 'bg-accent/[0.12] text-accent-text ring-accent/25',
};

/**
 * A state on a card: a tinted pill with a dot and a word or two. One line always, the same height
 * on every screen (24, 28 from `pad`), so it never pushes the title it sits beside onto a second
 * line. Put the long form in `more`: it shows from `pad` up and drops away on a phone.
 */
export function StatePill({ tone, children, more, live, className }: { tone: Tone; children: React.ReactNode; more?: React.ReactNode; live?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex h-24 shrink-0 items-center gap-6 whitespace-nowrap rounded-dot px-8 text-label font-medium ring-1 ring-inset pad:h-[28px] pad:px-12', pillTone[tone], className)}>
      <Dot tone={tone} className={live ? 'animate-breathe' : undefined} />
      <span>
        {children}
        {more ? <span className="hidden pad:inline"> {more}</span> : null}
      </span>
    </span>
  );
}

/** A line's state as a quiet mark: a dot and a time or a word, no box, so a row never nests one. */
export function StateMark({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-6 whitespace-nowrap font-mono tabular text-micro', textTone[tone], className)}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** A dot and a sentence, for rows such as "Needs attention" and ticket line notes. */
export function Signal({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-8', textTone[tone], className)}>
      <Dot tone={tone} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export { dotTone, textTone };
