'use client';

import type { OrderLine, OrderLineModifier } from '@bliss/shared/domain';
import { formatTime } from '@bliss/shared/format';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { TicketLineView, type TicketLineState } from '@bliss/ui/components/floor/ticket';
import { useLongPress } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowsExchange, IconBan, IconNote, IconX } from '@tabler/icons-react';
import { type PointerEvent, useRef, useState } from 'react';

export type RowAction = 'move' | 'note' | 'void' | 'clear' | 'menu';

const ACTION_WIDTH = 72;

/**
 * A ticket row. Swipe left reveals move, note and void behind a visible chevron. Gesture is never
 * the only route: the chevron, a long press, Enter and the context menu key all open the same actions.
 * docs/06 section 6.4 and docs/07 section 7.
 */
export function TicketRow({
  line,
  modifiers,
  name,
  imageUrl,
  state,
  deliveredAt = null,
  timezone,
  open,
  onOpenChange,
  onAction,
}: {
  line: OrderLine;
  modifiers: OrderLineModifier[];
  name: string;
  imageUrl?: string | null;
  state: TicketLineState;
  /** When its round reached the table, if it has. */
  deliveredAt?: number | null;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: RowAction) => void;
}) {
  const actions: { key: RowAction; label: string; icon: typeof IconNote; tone: 'default' | 'stop' }[] =
    state === 'draft'
      ? [
          { key: 'move', label: 'Move', icon: IconArrowsExchange, tone: 'default' },
          { key: 'note', label: 'Note', icon: IconNote, tone: 'default' },
          { key: 'clear', label: 'Clear', icon: IconX, tone: 'stop' },
        ]
      : state === 'poured' || state === 'served'
        ? [
            { key: 'move', label: 'Move', icon: IconArrowsExchange, tone: 'default' },
            { key: 'void', label: 'Void', icon: IconBan, tone: 'stop' },
          ]
        : [
            { key: 'move', label: 'Move', icon: IconArrowsExchange, tone: 'default' },
            { key: 'note', label: 'Note', icon: IconNote, tone: 'default' },
            { key: 'void', label: 'Void', icon: IconBan, tone: 'stop' },
          ];
  const reveal = actions.length * ACTION_WIDTH;

  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);

  const press = useLongPress({ onLongPress: () => onAction('menu'), onPress: () => (open ? onOpenChange(false) : onAction('menu')) });

  const offset = drag ?? (open ? -reveal : 0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY, base: open ? -reveal : 0, horizontal: null };
    press.onPointerDown(e);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (s.horizontal) e.currentTarget.setPointerCapture(e.pointerId);
    }
    press.onPointerMove(e);
    if (s.horizontal) setDrag(Math.max(-reveal, Math.min(0, s.base + dx)));
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    press.onPointerUp(e);
    if (s?.horizontal && drag !== null) {
      onOpenChange(drag < -reveal / 2);
      setDrag(null);
    }
  };

  const detail = [...modifiers.map((m) => m.name), line.note].filter(Boolean).join(' · ') || null;

  return (
    <div data-flip-id={line.id} className="relative overflow-hidden">
      <div aria-hidden={!open} className={cx('absolute inset-y-0 right-0 flex', !open && drag === null && 'pointer-events-none opacity-0')}>
        {actions.map((a) => {
          const Glyph = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                onOpenChange(false);
                onAction(a.key);
              }}
              className={cx('flex w-[72px] flex-col items-center justify-center gap-4 text-label', a.tone === 'stop' ? 'bg-stop text-stop-ink' : 'bg-control-hover text-ink')}
            >
              <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" />
              {a.label}
            </button>
          );
        })}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${line.qty} ${name}${detail ? `, ${detail}` : ''}. Actions`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={press.onPointerLeave}
        onClick={press.onClick}
        onContextMenu={press.onContextMenu}
        onKeyDown={(e) => {
          press.onKeyDown(e);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAction('menu');
          }
        }}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        className={cx(
          'relative flex items-center outline-offset-[-2px] select-none',
          drag === null && 'transition-transform duration-[120ms] ease-out',
          open || drag !== null ? 'bg-raised' : 'bg-transparent'
        )}
      >
        <div className="min-w-0 flex-1">
          <TicketLineView
            qty={line.qty}
            name={name}
            lineTotal={line.lineTotalCents}
            state={state}
            detail={detail}
            pouredAt={line.servedAt ? formatTime(line.servedAt, timezone) : null}
            servedAt={deliveredAt ? formatTime(deliveredAt, timezone) : null}
            imageUrl={imageUrl}
          />
        </div>
      </div>
    </div>
  );
}
