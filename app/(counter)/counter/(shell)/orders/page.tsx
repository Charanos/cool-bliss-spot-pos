'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { Skeleton } from '@bliss/ui/components/feedback';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { useNow } from '@bliss/ui/hooks';
import { useListEnter } from '@bliss/ui/motion/floor-hooks';
import { IconCheck, IconChecks } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { PageHeader } from '@/app/_pos/chrome';
import { pour } from '@/lib/pos/actions';
import { useTickets } from '@/lib/pos/counter-queries';
import { useOutlet } from '@/lib/pos/queries';
import { PANE, Quiet } from '../../_components/parts';
import { LATE_MS, TicketCard } from '../../_components/ticket-card';
import { type VoidTarget, VoidLineDialog } from '../../_components/void-line-dialog';

type View = 'waiting' | 'poured';

/**
 * Orders: what the counter has to pour, oldest first. docs/14 section 5.
 *
 * Tickets pack into columns by their own height, like the Floor's orders, so a two line round never
 * leaves a hole beside a ten line one. No prices on a ticket: the counter pours here, it sells on
 * Tabs. The dock's action always pours the oldest ticket, so the queue can be worked from one spot.
 */
export default function CounterOrdersPage() {
  const tickets = useTickets();
  const outlet = useOutlet();
  const now = useNow(15_000);
  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const [view, setView] = useState<View>('waiting');
  const [voiding, setVoiding] = useState<VoidTarget | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useListEnter(grid, Boolean(tickets && tickets.waiting.length > 0));

  const waiting = tickets?.waiting ?? [];
  const oldest = waiting.find((t) => t.lines.some((l) => l.state === 'waiting'));
  const late = waiting.filter((t) => now - t.firedAt > LATE_MS).length;
  const ranOut = waiting.filter((t) => t.ranOut > 0).length;
  const toPour = waiting.reduce((n, t) => n + t.lines.filter((l) => l.state === 'waiting').length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Orders"
        facts={
          tickets === undefined
            ? [{ key: 'r', text: 'Reading orders' }]
            : waiting.length === 0
              ? [{ key: 'n', text: 'Nothing waiting' }]
              : [
                  { key: 't', text: plural(waiting.length, 'ticket') },
                  { key: 'l', text: `${toPour} to pour`, mono: true },
                  late > 0 ? { key: 'late', text: `${late} waiting long` } : null,
                  ranOut > 0 ? { key: 'out', text: `${ranOut} ran out` } : null,
                  waiting[0] ? { key: 'o', text: `oldest ${formatElapsed(now - waiting[0].firedAt)}`, mono: true } : null,
                ]
        }
        aside={
          <Segmented
            label="Which tickets"
            size="md"
            value={view}
            onChange={setView}
            options={[
              { value: 'waiting', label: 'To pour', count: waiting.length || undefined },
              { value: 'poured', label: 'Poured', count: tickets?.poured.length || undefined },
            ]}
          />
        }
      />

      <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
        {tickets === undefined ? (
          <div className="columns-1 gap-16 pad:columns-2 desktop:columns-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="mb-16 h-[220px] break-inside-avoid rounded-[20px]" />
            ))}
          </div>
        ) : view === 'waiting' ? (
          waiting.length === 0 ? (
            <Quiet
              title="Nothing waiting"
              body="Everything fired has been poured. A new order appears here the moment a waiter fires it, oldest first."
            />
          ) : (
            <div ref={grid} className="columns-1 gap-16 pad:columns-2 desktop:columns-3">
              {waiting.map((t) => (
                <div key={t.orderId} className="mb-16 break-inside-avoid">
                  <TicketCard
                    ticket={t}
                    now={now}
                    timezone={tz}
                    onPour={(ids) => void pour(t.tabId, t.orderId, ids, t.label, ids.length === t.lines.filter((l) => l.state === 'waiting').length)}
                    onVoid={(line) => setVoiding({ lineId: line.lineId, title: `${line.qty} × ${line.name}`, poured: false, ranOut: true })}
                  />
                </div>
              ))}
            </div>
          )
        ) : tickets.poured.length === 0 ? (
          <Quiet title="Nothing poured lately" body="Tickets poured in the last 45 minutes are kept here, so a waiter asking after a round gets an answer." />
        ) : (
          <ul className={`${PANE} flex flex-col overflow-hidden`}>
            {tickets.poured.map((t) => (
              <li key={t.orderId} className="flex min-h-row-floor items-center gap-16 border-b border-rule-raised/30 px-16 py-8 last:border-b-0">
                <span className="flex size-control-sm shrink-0 items-center justify-center rounded-dot bg-poured/15 text-poured">
                  <IconCheck size={16} stroke={ICON_STROKE} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">
                    {t.label}
                    {t.waiter ? <span className="text-ink-subtle"> · {t.waiter}</span> : null}
                  </span>
                  <span className="block truncate font-mono text-micro text-ink-subtle">{t.lines.map((l) => `${l.qty}× ${l.name}`).join(' · ')}</span>
                </span>
                <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{t.lastPouredAt ? formatTime(t.lastPouredAt, tz) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {oldest && view === 'waiting' ? (
        <BaseAction>
          <Button
            variant="primary"
            size="xl"
            icon={IconChecks}
            onClick={() =>
              void pour(
                oldest.tabId,
                oldest.orderId,
                oldest.lines.filter((l) => l.state === 'waiting').map((l) => l.lineId),
                oldest.label,
                true,
              )
            }
          >
            Pour oldest · {oldest.label}
          </Button>
        </BaseAction>
      ) : null}

      <VoidLineDialog target={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

