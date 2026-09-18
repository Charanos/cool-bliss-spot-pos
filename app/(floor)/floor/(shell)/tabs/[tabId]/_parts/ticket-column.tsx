'use client';

import { displaySeatLabel } from '@bliss/shared/seats';
import { AnimatedMoney } from '@bliss/ui/components/money';
import { EmptyState } from '@bliss/ui/components/feedback';
import { MetaLine } from '@bliss/ui/components/working';
import { cx } from '@bliss/ui/lib/cx';
import { SeatGroupHeader, seatColorVar } from '@bliss/ui/components/floor/ticket';
import { type FlipState, captureRows, lineEnter, playRowMove } from '@bliss/ui/motion/floor';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { TabDetail } from '@/lib/pos/queries';
import { type RowAction, TicketRow } from './ticket-row';

export interface TicketColumnHandle {
  /** Capture row positions before a seat move, so the row can travel to its new group. */
  captureForMove(): void;
}

/**
 * The ticket column, 340px: the seat selector pinned at the top, the rail grouped by seat with Shared
 * last, and the totals pinned at the foot above the base layer's Fire order.
 */
export const TicketColumn = forwardRef<
  TicketColumnHandle,
  {
    detail: TabDetail;
    timezone: string;
    metaItems: Array<{ key: string; text: string; mono?: boolean } | null>;
    onLineAction: (lineId: string, action: RowAction) => void;
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
  }
>(function TicketColumn({ detail, timezone, metaItems, onLineAction, mobileOpen, onCloseMobile }, ref) {
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFlip = useRef<FlipState | null>(null);
  const known = useRef<Set<string> | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    captureForMove() {
      if (listRef.current) pendingFlip.current = captureRows(listRef.current);
    },
  }));

  const lineIds = detail.groups.flatMap((g) => g.lines.map((l) => l.line.id));
  const signature = detail.groups.map((g) => `${g.key}:${g.lines.map((l) => l.line.id).join(',')}`).join('|');

  useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) return;
    if (pendingFlip.current) {
      playRowMove(pendingFlip.current, container);
      pendingFlip.current = null;
    } else if (known.current) {
      // line.enter for rows that joined the data set, never for rows scrolling into view.
      for (const id of lineIds) {
        if (!known.current.has(id)) {
          const row = container.querySelector(`[data-flip-id="${id}"]`);
          if (row) lineEnter(row);
        }
      }
    }
    known.current = new Set(lineIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature captures every row change
  }, [signature]);

  const selectedSeat = detail.seats.find((s) => s.id === detail.selected);
  const selectedTotal = detail.selected === 'shared' ? detail.sharedTotal : (selectedSeat?.total ?? null);
  const selectedName =
    detail.selected === 'shared' ? 'Shared' : selectedSeat ? `Seat ${selectedSeat.seatNo}${selectedSeat.label ? ` · ${displaySeatLabel(selectedSeat.label)}` : ''}` : null;

  return (
    <section aria-label="Ticket" className={cx(
      "flex flex-col z-40 bg-page shadow-[inset_1px_0_8px_rgba(0,0,0,0.15)]",
      mobileOpen ? "fixed inset-0 min-h-dvh safe-bottom" : "hidden tablet:flex min-h-0 w-rail-ticket shrink-0 relative"
    )}>
      {/* ── Title section moved from center panel ──────────────────────── */}
      <div className="flex shrink-0 items-center justify-between px-24 border-b border-rule h-[88px]">
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-title font-medium tracking-tight text-ink leading-tight truncate">
            {detail?.label ?? '\u00a0'}
          </h1>
          {metaItems.length > 0 && (
            <div className="flex items-center min-w-0 pt-2">
              <MetaLine items={metaItems} className="flex-nowrap whitespace-nowrap overflow-hidden text-ellipsis text-body-sm text-ink-muted" />
            </div>
          )}
        </div>
        {mobileOpen && (
          <button type="button" onClick={onCloseMobile} className="p-8 -mr-8 text-ink-subtle hover:text-ink transition-colors font-medium text-body-sm active:scale-95 press-feedback">
            Done
          </button>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-8 pt-8 pb-16">
        {detail.groups.length === 0 ? (
          <EmptyState
            title="Nothing on this tab yet"
            body={detail.showControls ? 'Pick a seat, then add serves from the grid.' : 'Add serves from the grid.'}
            className="py-32"
          />
        ) : (
          detail.groups.map((group, gi) => {
            const isSelected = detail.selected === (group.seat?.id ?? 'shared');
            const seatNo = group.seat ? group.seat.seatNo : ('shared' as const);
            const seatColor = seatColorVar(seatNo);
            const prevGroup = gi > 0 ? detail.groups[gi - 1] : null;
            const prevSelected = prevGroup ? detail.selected === (prevGroup.seat?.id ?? 'shared') : false;

            return (
              <div
                key={group.key}
                className={cx(
                  'rounded-[16px] transition-all duration-200',
                  isSelected
                    ? 'p-16 my-8 border backdrop-blur-[24px]'
                    : cx('px-16 py-10', gi > 0 && !prevSelected && 'border-t border-rule/50 mt-6')
                )}
                style={isSelected ? {
                  backgroundColor: `color-mix(in srgb, ${seatColor} 14%, color-mix(in oklab, var(--color-raised) 70%, transparent))`,
                  borderColor: `color-mix(in srgb, ${seatColor} 32%, transparent)`,
                  boxShadow: `0 8px 32px -8px color-mix(in srgb, ${seatColor} 18%, transparent), inset 0 1px 1px color-mix(in srgb, white 8%, transparent), inset 0 0 0 1px color-mix(in srgb, white 3%, transparent)`,
                  backgroundImage: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${seatColor} 14%, transparent) 0%, transparent 75%), radial-gradient(color-mix(in srgb, ${seatColor} 9%, transparent) 1.5px, transparent 1.5px)`,
                  backgroundSize: '100% 100%, 24px 24px',
                  backgroundPosition: '0 0, 12px 12px',
                } : undefined}
              >
                <SeatGroupHeader
                  seat={group.seat ? group.seat.seatNo : 'shared'}
                  label={group.seat?.label ?? null}
                  subtotal={group.subtotal}
                  settled={group.seat?.status === 'settled'}
                />
                <div>
                  {group.lines.map(({ line, state, modifiers, name, imageUrl }) => (
                    <TicketRow
                      key={line.id}
                      line={line}
                      modifiers={modifiers}
                      name={name}
                      imageUrl={imageUrl}
                      state={state}
                      timezone={timezone}
                      open={openRow === line.id}
                      onOpenChange={(open) => setOpenRow(open ? line.id : null)}
                      onAction={(action) => onLineAction(line.id, action)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 shadow-[0_-1px_0_rgba(255,255,255,0.02)] px-16 py-12">
        {detail.showControls && selectedName && selectedTotal !== null ? (
          <div className="flex items-baseline justify-between gap-8">
            <span className="truncate text-body text-ink-muted">{selectedName}</span>
            <AnimatedMoney value={selectedTotal} animation="seat.total" size="num" tone="muted" />
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-8">
          <span className="text-body text-ink-muted">Tab total</span>
          <AnimatedMoney value={detail.total} animation="seat.total" size="num-lg" tone="money" />
        </div>
      </div>
    </section>
  );
});
