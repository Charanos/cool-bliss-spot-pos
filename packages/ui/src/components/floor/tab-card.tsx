'use client';

import type { Cents } from '@bliss/shared/money';
import { cx } from '../../lib/cx';
import { Money } from '../money';
import type { ReactNode } from 'react';
import { CARD_ACTION_ROOM } from '../card-action';
import { Signal, StatePill, type Tone } from '../status';
import { InviteButton, PaneButton, SeatChipStack } from '../working';
import { IconPlus } from '@tabler/icons-react';
import { ICON_STROKE } from '../icon';

export interface TabCardSeat {
  seatNo: number;
  settled: boolean;
  hasSpend: boolean;
}

export interface TabCardProps {
  tableLabel: string;
  name?: string | null;
  seats: readonly TabCardSeat[];
  showSeats: boolean;
  elapsed: string;
  total: Cents;
  waiter?: string | null;
  mine: boolean;
  unsentCount: number;
  ranOutCount: number;
  onOpen: () => void;
  /** Where the table stands: a pill under the label, when nothing needs fixing first. */
  stage?: { word: string; tone: Tone; more?: string; live?: boolean };
  /** The table's next step, a CardAction laid over the card's foot. */
  action?: ReactNode;
  /** Replaces "open 1h04" in the spoken name, for a paid tab: "paid 20 minutes ago". */
  elapsedLabel?: string;
}

/**
 * A tab card on the Floor tab list. Composed from PaneButton per docs/13-floor-tabs-revamp.md §3.
 *
 * Reading order: label + elapsed → seats (or tab name) → hairline → state signal + total.
 * The button's accessible name is built, not scraped, so a screen reader hears the full picture.
 *
 * min-h-card-tab keeps the card from clipping at 200% text size with long walk-up names.
 * The total renders at num-lg (24px mono) so a waiter reads it at arm's length.
 */
export function TabCard({ tableLabel, name, seats, showSeats, elapsed, total, waiter, mine, unsentCount, ranOutCount, onOpen, stage, action, elapsedLabel }: TabCardProps) {
  const settledCount = seats.filter((s) => s.settled).length;

  // Priority: stop (blocked) > stop (ran out) > info (unsent) > poured (settled) > nothing
  const state =
    ranOutCount > 0
      ? { tone: 'stop' as const, text: `${ranOutCount} ${ranOutCount === 1 ? 'item' : 'items'} ran out` }
      : unsentCount > 0
        ? { tone: 'info' as const, text: `${unsentCount} not yet sent` }
        : settledCount > 0
          ? { tone: 'poured' as const, text: `${settledCount} ${settledCount === 1 ? 'seat' : 'seats'} settled` }
          : null;

  const emphasis = ranOutCount > 0 ? 'attention' : mine ? 'mine' : 'default';

  // Accessible name: built so screen readers hear the full picture without scraping visible text.
  const statePhrase = state ? `, ${state.text}` : mine && !state ? ', your tab' : waiter ? `, ${waiter}'s tab` : '';
  const seatsPhrase = showSeats && seats.length > 1 ? `, ${seats.length} ${seats.length === 1 ? 'seat' : 'seats'}${settledCount > 0 ? `, ${settledCount} settled` : ''}` : name ? `, ${name}` : '';

  const accessibleName = `${tableLabel}${mine ? ', your tab' : ''}${seatsPhrase}, ${elapsedLabel ?? `open ${elapsed}`}${stage && !state ? `, ${stage.word}` : ''}${statePhrase}`;

  return (
    <div className="relative min-w-0">
      <PaneButton emphasis={emphasis} aria-label={accessibleName} onClick={onOpen} className={cx('flex w-full min-h-card-tab flex-col gap-8 p-12 pad:p-16', action ? CARD_ACTION_ROOM : null)}>
        {/* Row 1: label + elapsed */}
        <span className="flex items-baseline gap-8">
          <span className="min-w-0 flex-1 truncate text-title font-medium text-ink" title={tableLabel}>
            {tableLabel}
          </span>
          <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle" aria-hidden="true">
            {elapsed}
          </span>
        </span>

        {/* Row 2: where it stands on the left, whose it is across from it */}
        <span className="flex min-h-24 min-w-0 items-center justify-between gap-8" aria-hidden="true">
          <span className="flex min-w-0 items-center">
            {state ? (
              <Signal tone={state.tone}>{state.text}</Signal>
            ) : stage ? (
              <StatePill tone={stage.tone} more={stage.more} live={stage.live}>
                {stage.word}
              </StatePill>
            ) : null}
          </span>
          {mine ? <span className="shrink-0 text-body-sm font-medium text-accent-text">Yours</span> : waiter ? <span className="min-w-0 truncate text-right text-body-sm text-ink-subtle">{waiter}</span> : null}
        </span>

        {/* The figures sit on a hairline at the foot, however tall the card grows. */}
        <span aria-hidden="true" className="mt-auto h-px w-full bg-rule-raised/25" />

        {/* Row 3: seats or tab name + total */}
        <span className="flex items-end justify-between gap-8 pt-4">
          <span className="min-w-0 flex-1 flex items-center" aria-hidden="true">
            {/* Every tab shows its seats, one guest included, so no card reads as empty. */}
            {seats.length > 0 ? (
              <SeatChipStack seats={seats.map((s) => ({ seatNo: s.seatNo, settled: s.settled }))} max={6} size="tile" overlapping />
            ) : name ? (
              <span className="truncate text-body text-ink-muted">{name}</span>
            ) : null}
          </span>
          <Money value={total} size="num-lg" decimals="whole" tone={mine ? 'money' : 'default'} className="shrink-0" />
        </span>
      </PaneButton>
      {action}
    </div>
  );
}

/**
 * A free table: an invitation, one row high. Dashed edge (surface-invite), its seats, and the add mark.
 * Named so a screen reader hears "Open a tab on Table 7, 4 seats".
 */
/** A free table, as an invitation: its name, its zone underneath, how many it seats, and a quiet plus. */
export function FreeTableCard({ tableLabel, zone, capacity, onOpen }: { tableLabel: string; zone?: string | null; capacity: number; onOpen: () => void }) {
  const seats = capacity === 1 ? '1 seat' : `${capacity} seats`;
  return (
    <InviteButton aria-label={`Open a tab on ${tableLabel}${zone ? `, ${zone}` : ''}, ${seats}`} onClick={onOpen} className="group flex w-full min-h-row-floor items-center gap-12 px-16 py-8">
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="truncate text-body-lg font-medium text-ink" title={tableLabel}>
          {tableLabel}
        </span>
        <span className="flex min-w-0 items-center gap-6 text-body-sm text-ink-muted">
          {zone ? <span className="truncate">{zone}</span> : null}
          {zone ? <span aria-hidden="true" className="size-4 shrink-0 rounded-dot bg-ink-subtle/60" /> : null}
          <span className="shrink-0 font-mono tabular text-num-sm">{seats}</span>
        </span>
      </span>
      <span aria-hidden="true" className="flex size-control-sm shrink-0 items-center justify-center rounded-dot bg-accent-wash text-accent-text ring-1 ring-inset ring-accent/25 transition-hover group-hover:bg-accent group-hover:text-accent-ink">
        <IconPlus size={18} stroke={ICON_STROKE} />
      </span>
    </InviteButton>
  );
}
