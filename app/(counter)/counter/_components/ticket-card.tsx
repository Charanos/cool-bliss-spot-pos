'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StateMark, StatePill } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertCircle, IconCheck, IconChecks, IconClockHour4 } from '@tabler/icons-react';
import type { Ticket, TicketLine } from '@/lib/pos/counter-queries';

/** A ticket older than this takes the Low edge, once, with no pulse. docs/10 B1. */
export const LATE_MS = 5 * 60_000;

/**
 * A ticket on the Counter: what a waiter fired, as the person pouring needs to read it. The Floor's
 * order card, turned round: the same glass, the same seat chips and status badges, but every line
 * is a target, because here the job is to pour it.
 *
 * Tap a line to pour it. "Pour all" pours what is left. A line that ran out while a tablet was
 * offline cannot be poured; it offers a void instead, with the reason already written.
 */
export function TicketCard({
  ticket,
  now,
  timezone,
  onPour,
  onVoid,
}: {
  ticket: Ticket;
  now: number;
  timezone: string;
  onPour: (lineIds: string[]) => void;
  onVoid: (line: TicketLine) => void;
}) {
  const waitingIds = ticket.lines.filter((l) => l.state === 'waiting').map((l) => l.lineId);
  const late = now - ticket.firedAt > LATE_MS;
  const ranOut = ticket.ranOut > 0;
  const totalQty = ticket.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <article
      data-list-item=""
      aria-labelledby={`ticket-${ticket.orderId}`}
      className={cx(
        'relative flex flex-col overflow-hidden rounded-[20px] border bg-raised/70 backdrop-blur-glass tablet:rounded-[22px]',
        ranOut
          ? 'border-stop/40 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-stop)_25%,transparent)]'
          : late
            ? 'border-low/45 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-low)_22%,transparent)]'
            : 'border-rule-raised/50',
      )}
    >
      <header className="flex items-start justify-between gap-12 px-16 pb-12 pt-16">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-8">
            <h2 id={`ticket-${ticket.orderId}`} className="truncate text-title font-medium text-ink">
              {ticket.label}
            </h2>
            {ticket.waiter ? <span className="max-w-[120px] shrink-0 truncate rounded-dot bg-neutral-wash px-8 py-2 font-mono text-micro text-ink-subtle">{ticket.waiter}</span> : null}
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-micro text-ink-subtle">
            {ticket.tabNumber ? <span>Tab {ticket.tabNumber}</span> : null}
            {ticket.orderNumber ? (
              <>
                <span aria-hidden="true" className="text-ink-disabled">
                  ·
                </span>
                <span>Order {ticket.orderNumber}</span>
              </>
            ) : null}
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
            <span>Fired {formatTime(ticket.firedAt, timezone)}</span>
            <span aria-hidden="true" className="text-ink-disabled">
              ·
            </span>
            <span className="inline-flex items-center gap-4">
              <IconClockHour4 size={12} stroke={ICON_STROKE} aria-hidden="true" />
              <Elapsed since={ticket.firedAt} warnAfterMs={LATE_MS} warnLabel="waiting more than five minutes" />
            </span>
          </p>
        </div>

        {ranOut ? (
          <StatePill tone="stop" live>
            Ran out
          </StatePill>
        ) : late ? (
          <StatePill tone="low">Waiting</StatePill>
        ) : (
          <StatePill tone="accent" live>
            New
          </StatePill>
        )}
      </header>

      <ul className="flex flex-col gap-2 border-t border-rule-raised/30 px-8 py-8">
        {ticket.lines.map((line) => {
          const poured = line.state === 'poured';
          const out = line.state === 'ran_out';
          return (
            <li key={line.lineId} className={cx('flex items-stretch gap-4 rounded-md', out && 'bg-stop/10')}>
              <button
                type="button"
                disabled={poured || out}
                onClick={() => onPour([line.lineId])}
                aria-label={`${poured ? 'Poured' : 'Pour'} ${line.qty} ${line.name}${line.seatNo ? `, seat ${line.seatNo}` : ''}`}
                className={cx(
                  'flex min-h-row-floor min-w-0 flex-1 items-center gap-12 rounded-md px-8 py-6 text-left press-feedback',
                  poured ? 'opacity-50' : out ? '' : 'hover:bg-control-hover active:bg-control',
                )}
              >
                {ticket.showSeats ? <SeatChip seat={line.seatNo ?? 'shared'} label={line.seatLabel} size="dense" /> : null}
                <span className="w-[28px] shrink-0 font-mono tabular text-num text-ink-muted">{line.qty}×</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-body-lg', out ? 'text-stop' : 'text-ink', poured && 'line-through decoration-ink-subtle')}>{line.name}</span>
                  {line.modifiers.length > 0 || line.note ? (
                    <span className="block truncate font-mono text-micro text-ink-subtle">{[...line.modifiers, line.note].filter(Boolean).join(' · ')}</span>
                  ) : null}
                </span>
                {poured ? (
                  <StateMark tone="poured">{line.servedAt ? formatTime(line.servedAt, timezone) : 'Poured'}</StateMark>
                ) : out ? null : (
                  <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-dot bg-control text-ink-subtle">
                    <IconCheck size={18} stroke={ICON_STROKE} />
                  </span>
                )}
              </button>
              {out ? (
                <button
                  type="button"
                  onClick={() => onVoid(line)}
                  className="my-4 mr-4 shrink-0 rounded-md bg-stop-wash px-12 text-body-sm font-medium text-stop press-feedback hover:bg-stop/20"
                >
                  Void
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto px-8 pb-8">
        {waitingIds.length > 0 ? (
          <button
            type="button"
            onClick={() => onPour(waitingIds)}
            className="flex h-control-lg w-full items-center justify-between gap-8 rounded-lg bg-accent-wash px-16 text-body text-accent-text press-feedback hover:bg-accent/20"
          >
            <span className="flex items-center gap-8">
              <IconChecks size={18} stroke={ICON_STROKE} aria-hidden="true" />
              Pour all
            </span>
            <span className="font-mono text-num-sm">
              {plural(waitingIds.length, 'line')}
              {totalQty > ticket.lines.length ? ` · ${totalQty} items` : ''}
            </span>
          </button>
        ) : (
          <p className="flex h-control-lg items-center gap-8 rounded-lg bg-stop-wash px-16 text-body-sm text-stop">
            <IconAlertCircle size={16} stroke={ICON_STROKE} aria-hidden="true" />
            Nothing left to pour. Void what ran out so the tab is right.
          </p>
        )}
      </footer>
    </article>
  );
}
