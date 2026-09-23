'use client';

import type { Cents } from '@bliss/shared/money';
import { displaySeatLabel, seatColourIndex } from '@bliss/shared/seats';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Money } from '../money';
import { type SeatRef } from '../seat-chip';
import { Dot, StatusChip } from '../status';

// Tailwind-visible literal list — keeps each CSS custom property in the bundle.
const SEAT_COLORS = [
  'var(--color-seat-1)',
  'var(--color-seat-2)',
  'var(--color-seat-3)',
  'var(--color-seat-4)',
  'var(--color-seat-5)',
  'var(--color-seat-6)',
  'var(--color-seat-7)',
  'var(--color-seat-8)',
] as const;

export function seatColorVar(seatNo: number | 'shared'): string {
  if (seatNo === 'shared') return 'var(--color-shared)';
  return SEAT_COLORS[seatColourIndex(seatNo)] ?? SEAT_COLORS[0];
}

/**
 * Ticket rail parts. docs/06-design-system.md section 6.4.
 * Lines are grouped by seat, each group headed by the seat title and the subtotal right
 * aligned. Shared is the last group.
 */

export function SeatGroupHeader({
  seat,
  label,
  subtotal,
  settled,
}: {
  seat: SeatRef;
  label: string | null;
  subtotal: Cents;
  settled?: boolean;
  showChip?: boolean;
}) {
  const heading = seat === 'shared' ? 'Shared' : label ? `Seat ${seat} · ${displaySeatLabel(label)}` : `Seat ${seat}`;
  return (
    <div className={cx('flex items-baseline justify-between gap-8 pb-8', settled && 'opacity-60')}>
      <span className="min-w-0 flex-1 truncate text-subtitle font-medium text-ink" title={label ?? undefined}>
        {heading}
      </span>
      {settled ? <StatusChip status="settled" /> : null}
      <Money value={subtotal} size="num" tone="subtle" currency={false} className="shrink-0 font-mono tabular text-ink-subtle" />
    </div>
  );
}

/**
 * Where a line stands. `poured` is ready at the counter; `served` is at the table, which only the
 * waiter says. docs/16 section 8.
 */
export type TicketLineState = 'draft' | 'unsent' | 'waiting' | 'poured' | 'served' | 'ran_out';

export interface TicketLineViewProps {
  qty: number;
  name: string;
  lineTotal: Cents;
  state: TicketLineState;
  /** Note and modifiers, joined for the second line. */
  detail?: string | null;
  /** Time poured, already formatted. */
  pouredAt?: string | null;
  /** Time it reached the table, already formatted. */
  servedAt?: string | null;
  trailing?: ReactNode;
  imageUrl?: string | null;
}

/**
 * A ticket line: quantity × name, status / modifiers, and price on a shared decimal column.
 * Matches the reference image layout:
 * - 40px rounded image thumbnail
 * - 'qty × name' with accent quantity and subtle operator
 * - status dot or modifier note below
 * - 'KES 700.00' with subtle currency prefix and tabular price
 */
export function TicketLineView({ qty, name, lineTotal, state, detail, pouredAt, servedAt, trailing, imageUrl }: TicketLineViewProps) {
  const poured = state === 'poured' || state === 'served';

  return (
    <div className="relative flex items-center gap-12 py-8">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-[40px] shrink-0 rounded-[8px] object-cover bg-sunken" />
      ) : (
        <span className="size-[40px] shrink-0 rounded-[8px] bg-sunken/60 border border-rule/30" />
      )}

      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-6 min-w-0">
          <span className={cx('font-mono tabular text-body-sm font-medium shrink-0', poured ? 'text-ink-subtle' : 'text-accent')}>
            {qty} <span className="text-[11px] text-ink-subtle font-regular">×</span>
          </span>
          <span className={cx('block truncate text-body-sm font-medium ', poured ? 'text-ink-muted' : 'text-ink')}>{name}</span>
        </div>

        {detail || state === 'unsent' || state === 'poured' || state === 'served' || state === 'ran_out' ? (
          <div className="flex items-center gap-8 pt-4 min-w-0 text-label text-ink-subtle">
            {detail ? <span className="truncate">{detail}</span> : null}
            {state === 'unsent' ? (
              <span className="inline-flex items-center gap-20 text-info">
                <Dot tone="info" />
                Not yet sent
              </span>
            ) : state === 'poured' ? (
              <span className="inline-flex shrink-0 items-center gap-6 text-poured">
                <Dot tone="poured" />
                {pouredAt ? `Poured ${pouredAt} · to serve` : 'Poured · to serve'}
              </span>
            ) : state === 'served' ? (
              <span className="inline-flex shrink-0 items-center gap-6 text-served">
                <Dot tone="served" />
                {servedAt ? `Served ${servedAt}` : 'Served'}
              </span>
            ) : state === 'ran_out' ? (
              <StatusChip status="ran_out" />
            ) : null}
          </div>
        ) : null}
      </div>

      <Money value={lineTotal} size="num" tone={poured ? 'subtle' : 'default'} currency={true} className="shrink-0" />
      {trailing}
      <span className="sr-only">
        {state === 'draft' ? 'Not fired yet' : state === 'unsent' ? 'Fired, not yet sent' : state === 'waiting' ? 'At the bar' : state === 'poured' ? 'Poured, to serve' : state === 'served' ? 'Served at the table' : 'Ran out'}
      </span>
    </div>
  );
}
