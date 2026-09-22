'use client';

import { formatElapsed, plural } from '@bliss/shared/format';
import { Money } from '@bliss/ui/components/money';
import { Signal } from '@bliss/ui/components/status';
import { PaneButton, SeatChipStack } from '@bliss/ui/components/working';
import type { CounterTab } from '@/lib/pos/counter-queries';

/**
 * A tab as the Counter sees it: who it belongs to, how long it has run, and what is still to pay.
 * The Floor's tab card, same pane and reading order, with the one difference that matters here:
 * the figure is what is left to settle, not what the tab has run up.
 */
export function CounterTabCard({ tab, now, onOpen }: { tab: CounterTab; now: number; onOpen: () => void }) {
  const settled = tab.seats.filter((s) => s.settled).length;
  const signal =
    tab.waiting > 0
      ? { tone: 'low' as const, text: `${plural(tab.waiting, 'line')} still to pour` }
      : tab.partSettled
        ? { tone: 'poured' as const, text: `${settled} of ${tab.seats.length} seats settled` }
        : null;

  return (
    <PaneButton
      onClick={onOpen}
      aria-label={`${tab.label}, ${tab.waiter}, open ${formatElapsed(now - tab.openedAt)}${signal ? `, ${signal.text}` : ''}`}
      className="flex w-full min-h-card-tab flex-col gap-12 p-16"
    >
      <span className="flex items-baseline gap-8" aria-hidden="true">
        <span className="min-w-0 flex-1 truncate text-title-lg font-medium text-ink">{tab.label}</span>
        <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{formatElapsed(now - tab.openedAt)}</span>
      </span>

      <span className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2 text-body-sm text-ink-subtle" aria-hidden="true">
        <span className="truncate">{tab.waiter}</span>
        {tab.tabNumber ? (
          <>
            <span className="text-ink-disabled">·</span>
            <span className="font-mono text-num-sm">Tab {tab.tabNumber}</span>
          </>
        ) : null}
      </span>

      <span className="flex min-h-[22px] items-center" aria-hidden="true">
        {signal ? <Signal tone={signal.tone}>{signal.text}</Signal> : null}
      </span>

      <span className="flex-1" aria-hidden="true" />

      <span className="flex items-end justify-between gap-8" aria-hidden="true">
        <span className="flex min-w-0 items-center">
          {tab.showSeats && tab.seats.length > 1 ? <SeatChipStack seats={tab.seats} max={6} size="dense" overlapping /> : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span className="caps text-ink-subtle">{tab.partSettled ? 'Still to pay' : 'To pay'}</span>
          <Money value={tab.due} size="num-lg" tone="money" decimals="whole" />
        </span>
      </span>
    </PaneButton>
  );
}
