'use client';

import type { Cents } from '@bliss/shared/money';
import { cx } from '../../lib/cx';
import { Money } from '../money';
import { Signal } from '../status';
import { Eyebrow } from '../atmosphere';
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
export function TabCard({
  tableLabel,
  name,
  seats,
  showSeats,
  elapsed,
  total,
  waiter,
  mine,
  unsentCount,
  ranOutCount,
  onOpen,
}: TabCardProps) {
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
  const statePhrase = state
    ? `, ${state.text}`
    : mine && !state
      ? ', your tab'
      : waiter
        ? `, ${waiter}'s tab`
        : '';
  const seatsPhrase =
    showSeats && seats.length > 1
      ? `, ${seats.length} ${seats.length === 1 ? 'seat' : 'seats'}${settledCount > 0 ? `, ${settledCount} settled` : ''}`
      : name
        ? `, ${name}`
        : '';

  const accessibleName = `${tableLabel}${mine ? ', your tab' : ''}${seatsPhrase}, open ${elapsed}${statePhrase}`;

  return (
    <PaneButton
      emphasis={emphasis}
      aria-label={accessibleName}
      onClick={onOpen}
      className="flex w-full min-h-card-tab flex-col gap-12 p-16"
    >
      {/* Row 1: label + elapsed */}
      <span className="flex items-baseline gap-8">
        <span className="min-w-0 flex-1 truncate text-title-lg tracking-tight font-medium text-ink" title={tableLabel}>
          {tableLabel}
        </span>
        <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle" aria-hidden="true">
          {elapsed}
        </span>
      </span>

      {/* Row 2: state signal or waiter */}
      <span className="flex min-h-[22px] items-center" aria-hidden="true">
        {state ? (
          <Signal tone={state.tone}>{state.text}</Signal>
        ) : mine ? null : waiter ? (
          <span className="text-body text-ink-subtle">{waiter}</span>
        ) : null}
      </span>

      {/* Spacer to replace divider */}
      <span className="flex-1" aria-hidden="true" />

      {/* Row 3: seats or tab name + total */}
      <span className="flex items-end justify-between gap-8">
        <span className="min-w-0 flex-1 flex items-center" aria-hidden="true">
          {showSeats && seats.length > 1 ? (
            <SeatChipStack
              seats={seats.map((s) => ({ seatNo: s.seatNo, settled: s.settled }))}
              max={6}
              size="tile"
              overlapping
            />
          ) : name ? (
            <span className="truncate text-body text-ink-muted">{name}</span>
          ) : null}
        </span>
        <Money
          value={total}
          size="num-lg"
          decimals="whole"
          tone={mine ? 'money' : 'default'}
          className="shrink-0"
        />
      </span>
    </PaneButton>
  );
}

/**
 * A free table: an invitation, not an empty card. Dashed border via InviteButton (surface-invite).
 * Capacity at top-right in caps; "+ Open tab" CTA in accent at bottom-left.
 * Name built so a screen reader hears "Open a tab on Table 7, 4 seats".
 */
export function FreeTableCard({
  tableLabel,
  capacity,
  onOpen,
}: {
  tableLabel: string;
  capacity: number;
  onOpen: () => void;
}) {
  return (
    <InviteButton
      aria-label={`Open a tab on ${tableLabel}, ${capacity === 1 ? '1 seat' : `${capacity} seats`}`}
      onClick={onOpen}
      className="group flex w-full min-h-card-tab flex-col p-20"
    >
      {/* Label + capacity badge */}
      <span className="flex items-start justify-between gap-8">
        <span className="min-w-0 truncate text-title tracking-tight font-medium text-ink transition-colors duration-300" title={tableLabel}>
          {tableLabel}
        </span>
        <span className="flex min-w-[24px] h-[24px] items-center justify-center rounded-full border border-rule-raised/50 bg-sunken/30 px-6 font-mono tabular text-num-sm text-ink-muted group-hover:border-attention-subtle/50 group-hover:text-attention transition-colors duration-300" aria-hidden="true">
          {capacity}
        </span>
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* CTA section */}
      <span className="mt-auto flex items-center justify-between">
        <span className="text-body-sm font-medium text-ink-subtle group-hover:text-attention transition-colors duration-300">
          Available
        </span>
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-attention text-[#0B1015] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(224,163,90,0.4)]">
          <IconPlus size={18} stroke={ICON_STROKE} aria-hidden="true" />
        </span>
      </span>
    </InviteButton>
  );
}
