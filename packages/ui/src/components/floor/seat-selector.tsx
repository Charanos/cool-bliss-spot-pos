'use client';

import type { Cents } from '@bliss/shared/money';
import { formatFigure } from '@bliss/shared/money';
import { displaySeatLabel } from '@bliss/shared/seats';
import { IconPlus } from '@tabler/icons-react';
import { memo, useEffect, useRef } from 'react';
import { useLongPress } from '../../hooks';
import { cx } from '../../lib/cx';
import { useCountTo } from '../../motion/hooks';
import { ICON_STROKE } from '../icon';
import { seatBgClass } from '../../lib/seat';

export interface SelectorSeat {
  id: string;
  seatNo: number;
  label: string | null;
  status: 'active' | 'settled';
  total: Cents;
}

export interface SeatSelectorProps {
  seats: readonly SelectorSeat[];
  sharedTotal: Cents;
  /** A seat id, or 'shared'. There is always a selected seat. */
  selected: string;
  onSelect: (seatId: string) => void;
  onSeatMenu: (seatId: string) => void;
  onAddSeat: () => void;
  /** "Seat 5 added", shown inline for two seconds, never as a toast. */
  notice?: string | null;
}

export type SeatRef = number | 'shared';

const SeatColumn = memo(function SeatColumn({
  seat,
  ref: seatRef,
  selected,
  label,
  settled,
  total,
  onSelect,
  onMenu,
}: {
  seat: SeatRef;
  ref?: (node: HTMLButtonElement | null) => void;
  selected: boolean;
  label: string | null;
  settled: boolean;
  total: Cents;
  onSelect: () => void;
  onMenu: (() => void) | null;
}) {
  const press = useLongPress({
    onPress: onSelect,
    onLongPress: () => onMenu?.(),
    disabled: settled,
  });

  const shared = seat === 'shared';
  const inert = settled;

  return (
    <button
      ref={seatRef}
      type="button"
      aria-pressed={selected}
      aria-disabled={inert || undefined}
      aria-label={label ? `Seat ${seat}, ${displaySeatLabel(label)}${settled ? ', settled' : ''}` : shared ? `Shared${settled ? ', settled' : ''}` : `Seat ${seat}${settled ? ', settled' : ''}`}
      title={label ?? undefined}
      className={cx(
        'relative flex shrink-0 size-[40px] flex-col items-center justify-center rounded-full outline-none transition-all duration-[250ms] ease-out',
        shared ? 'border border-dashed border-shared text-shared bg-transparent' : cx(seatBgClass(seat as number), 'text-[#0B1015]'),
        settled && 'opacity-40'
      )}
      style={
        selected
          ? { boxShadow: `0 0 0 2px #0B1015, 0 0 0 4px ${shared ? 'rgba(255,255,255,0.5)' : '#FFFFFF'}` }
          : undefined
      }
      {...press}
    >
      <span className="font-mono tabular font-semibold text-[14px] leading-none">{shared ? '··' : seat}</span>
      {label || shared ? (
        <span className="mt-1 max-w-full truncate px-1 text-[8.5px] font-medium leading-none tracking-tight opacity-90">
          {shared ? 'Shared' : displaySeatLabel(label!)}
        </span>
      ) : null}
    </button>
  );
});

/**
 * The seat selector, the most important control in the product. docs/06-design-system.md 6.2.
 *
 * A 56px band pinned above the ticket rail with 40px chips at 8px gaps: seats ascending, then Shared,
 * then add. Totals and labels sit below the band on the page, so the band stays a single band and
 * not a box of boxes. Above six seats it scrolls with native momentum and the clipped chips at both
 * edges are the affordance. On a tab with one active seat this component is not rendered at all.
 */
export function SeatSelector({ seats, sharedTotal, selected, onSelect, onSeatMenu, onAddSeat, notice }: SeatSelectorProps) {
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    chipRefs.current.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const refFor = (key: string) => (node: HTMLButtonElement | null) => {
    if (node) chipRefs.current.set(key, node);
    else chipRefs.current.delete(key);
  };

  return (
    <div className="relative shrink-0 flex items-center h-full" role="toolbar" aria-label="Seats">
      <div className="relative flex items-center gap-6 overflow-x-auto overscroll-x-contain no-scrollbar z-10 py-4 px-4">
        {seats.map((s) => (
          <SeatColumn
            key={s.id}
            ref={refFor(s.id)}
            seat={s.seatNo}
            selected={selected === s.id}
            label={s.label}
            settled={s.status === 'settled'}
            total={s.total}
            onSelect={() => onSelect(s.id)}
            onMenu={() => onSeatMenu(s.id)}
          />
        ))}
        <SeatColumn
          ref={refFor('shared')}
          seat="shared"
          selected={selected === 'shared'}
          label={null}
          settled={false}
          total={sharedTotal}
          onSelect={() => onSelect('shared')}
          onMenu={null}
        />
        <div className="flex shrink-0 flex-col items-center justify-center">
          <button
            type="button"
            onClick={onAddSeat}
            aria-label="Add seat"
            className="inline-flex size-[40px] items-center justify-center rounded-full border border-hairline/40 shadow-sm text-ink-muted border-dashed press-feedback hover:bg-control-hover hover:text-ink active:bg-control-pressed bg-transparent"
          >
            <IconPlus size={16} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
        </div>
        <div className="flex shrink-0 items-center pl-2" aria-live="polite">
          {notice ? <span className={cx('whitespace-nowrap text-body text-poured')}>{notice}</span> : null}
        </div>
      </div>
    </div>
  );
}
