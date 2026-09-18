'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { MetaLine, SectionHeader } from '@bliss/ui/components/working';
import { cx } from '@bliss/ui/lib/cx';
import { useListEnter } from '@bliss/ui/motion/floor-hooks';
import { IconCheck, IconChecks } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { pourLines } from '@/lib/pos/counter';
import { type Ticket, useTickets } from '@/lib/pos/counter-queries';
import { useOutlet } from '@/lib/pos/queries';
import { type VoidTarget, VoidLineDialog } from '../../_components/void-line-dialog';

/** A ticket older than this takes the Low edge, once, with no pulse. docs/10 B1. */
const LATE_MS = 5 * 60_000;

/**
 * Orders: what the counter has to pour, oldest first. docs/14 section 5. Tapping a line pours it;
 * "Pour all" pours the ticket. No prices on a ticket: the counter pours, it does not sell here.
 */
export default function CounterOrdersPage() {
  const tickets = useTickets();
  const outlet = useOutlet();
  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const [voiding, setVoiding] = useState<VoidTarget | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useListEnter(grid, Boolean(tickets && tickets.waiting.length > 0));

  const oldest = tickets?.waiting[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end gap-x-24 gap-y-12 border-b border-rule-raised px-24 pb-16 pt-24">
        <div className="min-w-0 flex-1">
          <h1 className="text-title-lg text-ink">Orders</h1>
          <p className="mt-4 text-body text-ink-muted">
            {tickets === undefined ? 'Reading orders on this counter' : tickets.waiting.length === 0 ? 'Nothing waiting' : `${plural(tickets.waiting.length, 'ticket')} waiting, oldest first`}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-24 pb-32 pt-24">
        {tickets === undefined ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-16">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[220px] rounded-md" />
            ))}
          </div>
        ) : tickets.waiting.length === 0 ? (
          <EmptyState title="Nothing waiting" body="Everything fired has been poured. New orders appear here the moment a waiter fires them." />
        ) : (
          <div ref={grid} className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] items-start gap-16">
            {tickets.waiting.map((t) => (
              <TicketCard key={t.orderId} ticket={t} timezone={tz} onVoid={setVoiding} />
            ))}
          </div>
        )}

        {tickets && tickets.poured.length > 0 ? (
          <section aria-labelledby="poured" className="mt-40">
            <SectionHeader id="poured" title="Recently poured" count={tickets.poured.length} />
            <ul className="mt-8 border-t border-rule">
              {tickets.poured.map((t) => (
                <li key={t.orderId} className="flex min-h-row-floor items-center gap-16 border-b border-rule">
                  <span className="w-[160px] shrink-0 truncate text-body text-ink-muted">{t.label}</span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink-subtle">{t.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span>
                  <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{t.lastPouredAt ? formatTime(t.lastPouredAt, tz) : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {oldest ? (
        <BaseAction>
          <Button variant="primary" size="xl" icon={IconChecks} onClick={() => void pourLines(oldest.tabId, oldest.lines.filter((l) => l.state === 'waiting').map((l) => l.lineId))} disabled={!oldest.lines.some((l) => l.state === 'waiting')}>
            Pour oldest · {oldest.label}
          </Button>
        </BaseAction>
      ) : null}

      <VoidLineDialog target={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function TicketCard({ ticket, timezone, onVoid }: { ticket: Ticket; timezone: string; onVoid: (target: VoidTarget) => void }) {
  const waitingIds = ticket.lines.filter((l) => l.state === 'waiting').map((l) => l.lineId);
  const late = Date.now() - ticket.firedAt > LATE_MS;
  return (
    <article
      data-list-item=""
      aria-labelledby={`ticket-${ticket.orderId}`}
      className={cx('flex min-w-0 flex-col rounded-md border bg-raised', late ? 'border-low' : ticket.ranOut > 0 ? 'border-stop/60' : 'border-rule')}
    >
      <header className="flex items-start justify-between gap-12 px-16 pb-8 pt-16">
        <div className="min-w-0">
          <h2 id={`ticket-${ticket.orderId}`} className="truncate text-title font-medium text-ink">
            {ticket.label}
          </h2>
          <MetaLine
            items={[
              ticket.tabNumber ? { key: 'tab', text: `Tab ${ticket.tabNumber}` } : null,
              ticket.orderNumber ? { key: 'order', text: `Order ${ticket.orderNumber}` } : null,
              { key: 'waiter', text: ticket.waiter },
              { key: 'fired', text: formatTime(ticket.firedAt, timezone), mono: true },
            ]}
          />
        </div>
        <Elapsed since={ticket.firedAt} warnAfterMs={LATE_MS} warnLabel="waiting more than five minutes" className="shrink-0 pt-4" />
      </header>

      <ul className="flex flex-col border-t border-rule">
        {ticket.lines.map((line) => {
          const poured = line.state === 'poured';
          const ranOut = line.state === 'ran_out';
          return (
            <li key={line.lineId} className="flex items-stretch border-b border-rule last:border-b-0">
              <button
                type="button"
                disabled={poured}
                onClick={() => void pourLines(ticket.tabId, [line.lineId])}
                aria-label={`${poured ? 'Poured' : 'Pour'} ${line.qty} × ${line.name}${line.seatNo ? `, seat ${line.seatNo}` : ''}`}
                className={cx('flex min-h-row-floor min-w-0 flex-1 items-center gap-12 px-16 py-8 text-left press-feedback', poured ? 'opacity-40' : 'hover:bg-control active:bg-control-hover')}
              >
                {ticket.showSeats ? <SeatChip seat={line.seatNo ?? 'shared'} label={line.seatLabel} size="dense" /> : null}
                <span className="w-[32px] shrink-0 font-mono tabular text-num-lg text-ink">{line.qty}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-body-lg text-ink', poured && 'line-through')}>{line.name}</span>
                  {line.modifiers.length > 0 || line.note ? (
                    <span className="caps block truncate text-ink-muted">{[...line.modifiers, line.note].filter(Boolean).join(' · ')}</span>
                  ) : null}
                </span>
                {poured ? <IconCheck size={20} stroke={1.5} aria-hidden="true" className="shrink-0 text-poured" /> : ranOut ? <StatusChip status="ran_out" /> : null}
              </button>
              {ranOut ? (
                <Button variant="quiet-destructive" size="lg" className="my-4 mr-8 shrink-0" onClick={() => onVoid({ lineId: line.lineId, title: `${line.qty} × ${line.name}`, poured: false, ranOut: true })}>
                  Void
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-12 px-16 py-12">
        <span className="text-body-sm text-ink-subtle">{waitingIds.length === 0 ? 'Poured' : `${plural(waitingIds.length, 'line')} to pour`}</span>
        <Button variant="secondary" size="lg" icon={IconChecks} disabled={waitingIds.length === 0} onClick={() => void pourLines(ticket.tabId, waitingIds)}>
          Pour all
        </Button>
      </footer>
    </article>
  );
}
