'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { ActionList } from '@bliss/ui/components/action-list';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { Sheet, SheetCancel, SheetIcon, SheetPanel, SheetSection } from '@bliss/ui/components/floor/sheet';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StateMark, StatePill } from '@bliss/ui/components/status';
import { IconAlertCircle, IconBan, IconCheck, IconChecks, IconClockHour4, IconReceipt, IconRotateClockwise } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deliver, deliverTable, pour, undeliver } from '@/lib/pos/actions';
import type { FiredOrderView } from '@/lib/pos/queries';

export interface OrderActionSheetProps {
  order: FiredOrderView | null;
  timezone: string;
  onClose: () => void;
}

const STATE = {
  needs_you: { pill: 'stop', word: 'Needs you', icon: IconAlertCircle, tone: 'stop' },
  poured: { pill: 'poured', word: 'Poured, ready to take', icon: IconCheck, tone: 'poured' },
  served: { pill: 'served', word: 'Served', icon: IconChecks, tone: 'accent' },
  at_bar: { pill: 'accent', word: 'At the bar', icon: IconClockHour4, tone: 'accent' },
  held: { pill: 'neutral', word: 'Held on this tablet', icon: IconClockHour4, tone: 'low' },
} as const;

/**
 * One fired order, from the Orders list. docs/15. What it is (its lines, each with where it stands,
 * and its total), the one thing to do next in the footer (take it to the table, sort out what ran
 * out, or undo a delivery), and the table's own shortcuts underneath.
 */
export function OrderActionSheet({ order, timezone, onClose }: OrderActionSheetProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const state = STATE[order.state];
  const served = order.state === 'served';
  const totalQty = order.lines.reduce((n, l) => n + l.line.qty, 0);
  const openTab = () => {
    onClose();
    router.push(`/floor/tabs/${order.tabId}`);
  };

  // Each action reports its own outcome as a notice, with an undo where there is one, so the sheet
  // closes on success and stays open only while the change is being made.
  const run = async (action: () => Promise<unknown>) => {
    try {
      setSubmitting(true);
      setError(null);
      await action();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Nothing changed.');
    } finally {
      setSubmitting(false);
    }
  };

  const outcome =
    order.state === 'poured' ? (
      <Button variant="primary" size="lg" shape="pill" icon={IconCheck} loading={submitting} onClick={() => void run(() => deliver(order.orderId, order.label))}>
        Mark served
      </Button>
    ) : order.state === 'needs_you' ? (
      <Button variant="primary" size="lg" shape="pill" onClick={openTab}>
        Open the tab
      </Button>
    ) : order.state === 'served' ? (
      <Button variant="secondary" size="lg" shape="pill" icon={IconRotateClockwise} loading={submitting} onClick={() => void run(() => undeliver(order.orderId, order.label))}>
        Undo served
      </Button>
    ) : order.state === 'at_bar' ? (
      <Button
        variant="secondary"
        size="lg"
        shape="pill"
        loading={submitting}
        onClick={() =>
          void run(async () => {
            const waiting = order.lines.filter((l) => l.state === 'waiting').map((l) => l.line.id);
            if (waiting.length > 0) await pour(order.tabId, order.orderId, waiting, order.label, true);
            await deliver(order.orderId, order.label);
          })
        }
      >
        Served already
      </Button>
    ) : null;

  return (
    <Sheet
      open={Boolean(order)}
      onClose={onClose}
      width="md"
      eyebrow={order.zoneName ?? 'Order'}
      title={order.label}
      leading={<SheetIcon icon={state.icon} tone={state.tone} />}
      description={
        <span className="flex flex-wrap items-center gap-x-8">
          <span>Fired {formatTime(order.firedAt, timezone)}</span>
          <span aria-hidden="true">·</span>
          <Elapsed since={order.firedAt} />
          {order.waiterName ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{order.waiterName}</span>
            </>
          ) : null}
        </span>
      }
      footer={
        <>
          <SheetCancel onClick={onClose}>Close</SheetCancel>
          <div className="flex-1" />
          {outcome}
        </>
      }
    >
      <div className="flex flex-col gap-24 pb-4">
        <div className="flex flex-wrap items-center gap-12">
          <StatePill tone={state.pill} live={order.state === 'at_bar' || order.state === 'needs_you'}>
            {state.word}
          </StatePill>
          {order.state === 'at_bar' ? <span className="text-body-sm text-ink-muted">The bar has not marked it poured yet.</span> : null}
          {order.state === 'needs_you' ? <span className="text-body-sm text-ink-muted">Something on it ran out. Swap or void it on the tab.</span> : null}
          {served && order.deliveredAt ? <span className="text-body-sm text-ink-muted">At the table since {formatTime(order.deliveredAt, timezone)}.</span> : null}
        </div>

        <SheetSection label="On this order" aside={plural(totalQty, 'item')}>
          <SheetPanel>
            {order.lines.map(({ line, name, seatNo, state: lineState, modifiers }) => (
              <div key={line.id} className="flex min-h-row-floor items-center gap-12 border-t border-rule-raised/30 py-8 first:border-t-0">
                <SeatChip seat={seatNo ?? 'shared'} size="dense" />
                <span className="w-24 shrink-0 font-mono tabular text-body-sm text-ink-muted">{line.qty}×</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-ink">{name}</span>
                  {modifiers && modifiers.length > 0 ? <span className="truncate text-body-sm text-ink-muted">{modifiers.join(', ')}</span> : null}
                </span>
                {served ? (
                  <StateMark tone="served">Served</StateMark>
                ) : lineState === 'poured' ? (
                  <StateMark tone="poured">Poured</StateMark>
                ) : lineState === 'ran_out' ? (
                  <StateMark tone="stop">Ran out</StateMark>
                ) : (
                  <StateMark tone="neutral">At the bar</StateMark>
                )}
              </div>
            ))}
            <div className="flex min-h-row-floor items-center justify-between gap-12 border-t border-rule-raised/50 py-8">
              <span className="text-body font-medium text-ink">Order total</span>
              <Money value={order.total} size="num" tone="default" />
            </div>
          </SheetPanel>
        </SheetSection>

        <SheetSection label={`For ${order.label}`}>
          <ActionList
            items={[
              ...(served ? [] : [{ key: 'all', label: 'Mark every round served', icon: IconChecks, onSelect: () => void run(() => deliverTable(order.tabId, order.label)) }]),
              { key: 'tab', label: 'Open the tab', icon: IconReceipt, onSelect: openTab, hint: 'Seats, rounds and the bill' },
              { key: 'void', label: 'Void or swap on the tab', icon: IconBan, destructive: true, onSelect: openTab },
            ]}
          />
        </SheetSection>

        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
      </div>
    </Sheet>
  );
}
