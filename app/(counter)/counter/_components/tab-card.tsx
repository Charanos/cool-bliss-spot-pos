'use client';

import { formatElapsed, plural } from '@bliss/shared/format';
import { CARD_ACTION_ROOM, CardAction } from '@bliss/ui/components/card-action';
import { Money } from '@bliss/ui/components/money';
import { Signal, StatePill } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconCash } from '@tabler/icons-react';
import { STAGE } from '@/app/_pos/table-stage';
import { SeatChipStack, paneClass } from '@bliss/ui/components/working';
import type { CounterTab } from '@/lib/pos/counter-queries';

/**
 * A tab as the Counter sees it: who it belongs to, how long it has run, and what is still to pay.
 * The Floor's tab card, same pane and reading order, with the one difference that matters here:
 * the figure is what is left to settle, not what the tab has run up.
 *
 * A table that has everything, or has asked for its bill, carries "Settle" across its foot; the
 * rest open to the same place by the card itself.
 */
export function CounterTabCard({ tab, now, onOpen }: { tab: CounterTab; now: number; onOpen: () => void }) {
  const settled = tab.seats.filter((s) => s.settled).length;
  const stage = STAGE[tab.stage];
  const ready = tab.stage === 'served' || tab.stage === 'bill';
  const signal =
    tab.waiting > 0 && tab.stage !== 'bill'
      ? { tone: 'low' as const, text: `${plural(tab.waiting, 'line')} still to pour` }
      : tab.partSettled
        ? { tone: 'poured' as const, text: `${settled} of ${tab.seats.length} seats settled` }
        : null;

  return (
    <div className="relative min-w-0">
    {/* A pane with its rows in ordinary boxes and the tap laid over it: see the Floor's TabCard. */}
    <div className={cx(paneClass({ emphasis: tab.stage === 'bill' ? 'attention' : 'default' }), 'flex w-full min-h-card-tab flex-col p-16', ready && CARD_ACTION_ROOM)}>
      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-12">
        <div className="flex items-baseline gap-8">
          <span className="min-w-0 flex-1 truncate text-title-lg font-medium text-ink">{tab.label}</span>
          <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{formatElapsed(now - tab.openedAt)}</span>
        </div>

        {/* Where it stands on the left; whose it is and its number across from it. */}
        <div className="flex min-h-24 min-w-0 items-center justify-between gap-8">
          <div className="flex min-w-0 flex-wrap items-center gap-8">
            <StatePill tone={stage.tone} more={stage.more} live={stage.live}>
              {stage.word}
            </StatePill>
            {signal ? <Signal tone={signal.tone}>{signal.text}</Signal> : null}
          </div>
          <div className="flex shrink-0 items-center gap-6 text-body-sm text-ink-subtle">
            <span className="max-w-card-preview truncate">{tab.waiter}</span>
            {tab.tabNumber ? (
              <>
                <span className="text-ink-disabled">·</span>
                <span className="font-mono text-num-sm">Tab {tab.tabNumber}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-auto h-px w-full bg-rule-raised/25" />

        <div className="flex items-end justify-between gap-8">
          <div className="flex min-w-0 items-center">{tab.seats.length > 0 ? <SeatChipStack seats={tab.seats} max={6} size="dense" overlapping /> : null}</div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="caps text-ink-subtle">{tab.partSettled ? 'Still to pay' : 'To pay'}</span>
            <Money value={tab.due} size="num-lg" tone="money" decimals="whole" />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${tab.label}, ${tab.waiter}, open ${formatElapsed(now - tab.openedAt)}, ${stage.word}${signal ? `, ${signal.text}` : ''}`}
        className="absolute inset-0 rounded-card"
      />
    </div>
    {ready ? <CardAction label="Settle" icon={IconCash} tone={tab.stage === 'bill' ? 'primary' : 'soft'} ariaLabel={`Settle ${tab.label}`} onClick={onOpen} /> : null}
    </div>
  );
}
