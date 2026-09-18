import type { OrderLine, TabSeat } from '../domain';

export const SEAT_LABEL_MAX = 24;
export const SEAT_LABEL_DISPLAY_MAX = 14;
export const SEAT_PALETTE_SIZE = 8;

/**
 * Seat colour index from the seat number.
 *
 * docs/06-design-system.md section 4 assigns index 0 (Glacier) to seats 1, 9 and 17, which is
 * (seat_no - 1) mod 8. docs/04-data-model.md and the Phase 4 prompt write it as seat_no % 8, which
 * would make Seat 1 Ember and Seat 8 Glacier and contradicts the palette table and every design
 * file. This follows the palette table. See docs/11-design-drift.md, D-01.
 */
export function seatColourIndex(seatNo: number): number {
  if (!Number.isInteger(seatNo) || seatNo < 1) throw new RangeError(`Seat numbers start at 1, received ${seatNo}`);
  return (seatNo - 1) % SEAT_PALETTE_SIZE;
}

/** The next seat number is the next unused integer, never a reused one. Removed seats count. */
export function nextSeatNo(seats: readonly Pick<TabSeat, 'seatNo'>[]): number {
  return seats.reduce((max, s) => Math.max(max, s.seatNo), 0) + 1;
}

/** Seats created on open, numbered 1 to n. */
export function seatNumbersForGuests(guestCount: number): number[] {
  const n = Math.max(1, Math.floor(guestCount));
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function activeSeats<T extends Pick<TabSeat, 'status' | 'seatNo'>>(seats: readonly T[]): T[] {
  return seats.filter((s) => s.status === 'active').sort((a, b) => a.seatNo - b.seatNo);
}

/**
 * The seat model is hidden when it is not useful. docs/05-flows-and-channels.md section 1.2:
 * "A tab with exactly one active seat renders no seat controls anywhere." The seat rows still
 * exist; only the selector, the picker and the Shared option disappear.
 */
export function showsSeatControls(seats: readonly Pick<TabSeat, 'status'>[]): boolean {
  return seats.filter((s) => s.status === 'active').length > 1;
}

/**
 * Chips as information rather than controls: ticket group headings and tab card rows. A tab that
 * only ever had one seat shows none. A tab where three of four seats have settled still shows the
 * settled groups, dimmed, because those lines belong to somebody.
 */
export function showsSeatChips(seats: readonly Pick<TabSeat, 'status'>[]): boolean {
  return seats.filter((s) => s.status !== 'removed').length > 1;
}

export type SeatRemoval = { ok: true } | { ok: false; lineCount: number };

/** Removing a seat with non-voided lines attached is refused. */
export function canRemoveSeat(seatId: string, lines: readonly Pick<OrderLine, 'tabSeatId' | 'status'>[]): SeatRemoval {
  const lineCount = lines.filter((l) => l.tabSeatId === seatId && l.status !== 'voided').length;
  return lineCount === 0 ? { ok: true } : { ok: false, lineCount };
}

export function normaliseSeatLabel(input: string): string | null {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return null;
  return [...trimmed].slice(0, SEAT_LABEL_MAX).join('');
}

/** A seat label truncated for display at 14 characters. The full value goes in the title. */
export function displaySeatLabel(label: string | null): string | null {
  if (!label) return null;
  const chars = [...label];
  return chars.length > SEAT_LABEL_DISPLAY_MAX ? `${chars.slice(0, SEAT_LABEL_DISPLAY_MAX - 1).join('')}…` : label;
}

/**
 * Merge renumbering, docs/05-flows-and-channels.md section 2.8. Seats from the merged tab take
 * numbers above the surviving tab's maximum, keeping their order and labels.
 */
export function remapSeatsForMerge(
  surviving: readonly Pick<TabSeat, 'seatNo'>[],
  merged: readonly Pick<TabSeat, 'id' | 'seatNo' | 'status'>[],
): { seatId: string; fromSeatNo: number; toSeatNo: number; colourIndex: number }[] {
  let next = nextSeatNo(surviving);
  return [...merged]
    .filter((s) => s.status !== 'removed')
    .sort((a, b) => a.seatNo - b.seatNo)
    .map((s) => {
      const toSeatNo = next;
      next += 1;
      return { seatId: s.id, fromSeatNo: s.seatNo, toSeatNo, colourIndex: seatColourIndex(toSeatNo) };
    });
}
