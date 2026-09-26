'use client';

import { type ButtonHTMLAttributes, forwardRef, useEffect, useRef } from 'react';
import { cx } from '../lib/cx';
import { seatBgClass } from '../lib/seat';
import { seatSelect } from '../motion/floor';

export type SeatChipSize = 'tile' | 'dense' | 'row' | 'bar' | 'tap' | 'picker';

/**
 * The seat chip, the signature element. docs/06-design-system.md section 2.
 *
 * A rounded square filled with the seat colour carrying the seat number in JetBrains Mono 500.
 * Colour never carries meaning alone: the number is always there. Shared is a dashed outline with
 * a two dot glyph, never a ninth colour. Selection is a 2px ring at 2px offset, never a size change.
 *
 * Radius follows the three radius tokens: 6px up to the 28px chip, 10px from the 40px tap target up,
 * which keeps the radius to size ratio close to constant without inventing a fourth radius.
 */
const box: Record<SeatChipSize, string> = {
  tile: 'size-chip-tile rounded-[4px] text-[10px] leading-none',
  dense: 'size-chip-dense rounded-[6px] text-[11px] leading-none',
  row: 'size-[28px] rounded-[6px] text-[13px] leading-none',
  bar: 'size-[32px] rounded-[8px] text-[15px] leading-none',
  tap: 'size-chip rounded-[10px] text-[15px] leading-none',
  picker: 'size-chip-picker rounded-[12px] text-[20px] leading-none',
};

const ringInset: Record<SeatChipSize, string> = {
  tile: '-inset-[3px] rounded-[6px]',
  dense: '-inset-[4px] rounded-[10px]',
  row: '-inset-[4px] rounded-[10px]',
  bar: '-inset-[4px] rounded-[12px]',
  tap: '-inset-[4px] rounded-[14px]',
  picker: '-inset-[4px] rounded-[16px]',
};

export type SeatRef = number | 'shared';

export function seatName(seat: SeatRef, label?: string | null): string {
  if (seat === 'shared') return 'Shared';
  return label ? `Seat ${seat}, ${label}` : `Seat ${seat}`;
}

interface SeatMarkProps {
  seat: SeatRef;
  size?: SeatChipSize;
  selected?: boolean;
  settled?: boolean;
  className?: string;
}

function SeatFace({ seat, size = 'dense', settled }: Omit<SeatMarkProps, 'selected'>) {
  const shared = seat === 'shared';
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center font-mono font-medium tabular',
        box[size],
        shared ? 'border border-dashed border-shared text-shared' : cx(seatBgClass(seat), 'text-seat-ink'),
        settled && 'opacity-40',
      )}
    >
      {shared ? '··' : seat}
    </span>
  );
}

/** A non-interactive chip, for ticket lines, tab cards, bills and reports. */
export function SeatChip({ seat, size = 'dense', selected, settled, className, label }: SeatMarkProps & { label?: string | null }) {
  return (
    <span className={cx('relative inline-flex shrink-0', className)} role="img" aria-label={seatName(seat, label)}>
      <SeatFace seat={seat} size={size} settled={settled} />
      {selected ? <span aria-hidden="true" className={cx('pointer-events-none absolute border-2 border-seat-ring', ringInset[size])} /> : null}
    </span>
  );
}

export interface SeatChipButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  seat: SeatRef;
  size?: SeatChipSize;
  selected: boolean;
  settled?: boolean;
  label?: string | null;
}

/** An interactive chip for the seat selector and pickers. The ring animates in with seat.select. */
export const SeatChipButton = forwardRef<HTMLButtonElement, SeatChipButtonProps>(function SeatChipButton(
  { seat, size = 'tap', selected, settled, label, className, disabled, ...rest },
  ref,
) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (selected && !wasSelected.current && ringRef.current) seatSelect(ringRef.current);
    wasSelected.current = selected;
  }, [selected]);

  const inert = disabled || settled;
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-disabled={inert || undefined}
      aria-label={`${seatName(seat, label)}${settled ? ', settled' : ''}`}
      title={label ?? undefined}
      onClick={inert ? (event) => event.preventDefault() : rest.onClick}
      className={cx('relative inline-flex shrink-0 rounded-full outline-offset-4', className)}
    >
      <SeatFace seat={seat} size={size} settled={settled} />
      {selected ? <span ref={ringRef} aria-hidden="true" className={cx('pointer-events-none absolute border-2 border-seat-ring', ringInset[size])} /> : null}
    </button>
  );
});

