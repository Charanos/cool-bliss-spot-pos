'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { compare } from '@bliss/shared/money';
import type { HistoryBill, HistoryLine, HistorySale, HistoryTab, HistoryTabState } from '@bliss/shared/trade';
import { Button } from '@bliss/ui/components/button';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot, type Tone } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconArrowRight,
  IconBan,
  IconBeer,
  IconCheck,
  IconChevronDown,
  IconClockHour4,
  IconDoorEnter,
  IconDoorExit,
  IconReceipt,
  IconShoppingBag,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import { useId, useState } from 'react';
import { TENDER_ICON, TENDER_WORD } from '../tenders';

/**
 * One record in the history, closed by default and opened in place. docs/16 section 9.
 *
 * Closed, a tab reads the way a waiter would say it: the table, the tab number, whose it is, when it
 * opened, where it stands and what it came to. Opened, it is the tab's whole night in order: each
 * round as it was fired, every line poured, taken to the table or voided with its reason, each bill
 * and how it was paid, and when the table was cleared.
 */

export const STATE: Record<HistoryTabState, { word: string; tone: Tone }> = {
  ordering: { word: 'Open', tone: 'accent' },
  seated: { word: 'Paid, seated', tone: 'poured' },
  cleared: { word: 'Cleared', tone: 'neutral' },
  voided: { word: 'Closed empty', tone: 'stop' },
  merged: { word: 'Merged', tone: 'info' },
};

const SCOPE: Record<HistoryBill['scope'], string> = { tab: 'Whole tab', seat: 'Seat', even_split: 'Split share', quick_sale: 'Quick sale' };

function StateChip({ state }: { state: HistoryTabState }) {
  const s = STATE[state];
  return (
    <span className="inline-flex shrink-0 items-center gap-6 rounded-dot border border-rule-raised/40 bg-sunken/60 px-8 py-2 text-micro text-ink-muted">
      <Dot tone={s.tone} />
      {s.word}
    </span>
  );
}

function TenderChips({ bill }: { bill: HistoryBill }) {
  return (
    <span className="flex flex-wrap items-center gap-4">
      {bill.tenders.map((t, i) => {
        const Glyph = TENDER_ICON[t.kind];
        return (
          <span key={i} className="inline-flex items-center gap-4 rounded-dot bg-sunken/70 px-8 py-2 text-micro text-ink-muted">
            <Glyph size={12} stroke={ICON_STROKE} aria-hidden="true" />
            {TENDER_WORD[t.kind]}
            {t.amountCents !== null && bill.tenders.length > 1 ? <Money value={t.amountCents} size="num-sm" tone="subtle" currency={false} decimals="whole" /> : null}
          </span>
        );
      })}
    </span>
  );
}

/** A moment in the tab's night: a glyph on the rail, the time, and what happened. */
function Moment({ icon: Icon, tone = 'neutral', at, tz, children, last }: { icon: TablerIcon; tone?: 'neutral' | 'poured' | 'stop' | 'accent'; at: number | null; tz: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-12 pb-12 last:pb-0">
      {!last ? <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-[28px] w-px bg-rule-raised/50" /> : null}
      <span
        aria-hidden="true"
        className={cx(
          'relative flex size-[28px] shrink-0 items-center justify-center rounded-dot',
          tone === 'poured' ? 'bg-poured/15 text-poured' : tone === 'stop' ? 'bg-stop/15 text-stop' : tone === 'accent' ? 'bg-accent/15 text-accent-text' : 'bg-control text-ink-subtle',
        )}
      >
        <Icon size={14} stroke={ICON_STROKE} />
      </span>
      <div className="min-w-0 flex-1 pt-4">
        {at !== null ? <span className="mr-8 font-mono tabular text-num-sm text-ink-subtle">{formatTime(at, tz)}</span> : null}
        {children}
      </div>
    </li>
  );
}

function LineRow({ line, tz, ordering }: { line: HistoryLine; tz: string; ordering: boolean }) {
  const voided = line.status === 'voided';
  const poured = line.status === 'served';
  return (
    <li className="flex items-start gap-8 py-6">
      <span className={cx('w-[28px] shrink-0 pt-2 text-right font-mono tabular text-num-sm', voided ? 'text-ink-subtle' : 'text-ink-muted')}>{line.qty}×</span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-body', voided ? 'text-ink-subtle line-through' : 'text-ink')}>{line.name}</span>
        <span className="block text-body-sm text-ink-subtle">
          {[line.seatNo ? `Seat ${line.seatNo}` : null, line.detail].filter(Boolean).join(' · ')}
          {line.seatNo || line.detail ? ' · ' : ''}
          {voided ? (
            <span className="text-stop">Voided{line.voidReason ? `: ${line.voidReason}` : ''}</span>
          ) : poured ? (
            <span>
              <span className="text-poured">Poured</span>
              {line.servedAt ? ` ${formatTime(line.servedAt, tz)}` : ''}
              {line.servedBy ? ` by ${line.servedBy}` : ''}
              {line.deliveredAt ? ` · at the table ${formatTime(line.deliveredAt, tz)}` : ''}
            </span>
          ) : (
            <span className="text-low">{ordering ? 'Waiting at the counter' : 'Never poured'}</span>
          )}
        </span>
      </span>
      <Money value={line.lineTotalCents} size="num-sm" tone={voided ? 'disabled' : 'muted'} decimals="whole" className="shrink-0 pt-2" />
    </li>
  );
}

/** Rounds in the order they were fired, each with its lines. */
function rounds(lines: readonly HistoryLine[]) {
  const map = new Map<string, { orderNumber: number | null; firedAt: number | null; deliveredAt: number | null; lines: HistoryLine[] }>();
  for (const l of lines) {
    const key = String(l.orderNumber ?? 'x');
    const round = map.get(key) ?? { orderNumber: l.orderNumber, firedAt: l.firedAt, deliveredAt: l.deliveredAt, lines: [] };
    round.lines.push(l);
    map.set(key, round);
  }
  return [...map.values()].sort((a, b) => (a.firedAt ?? 0) - (b.firedAt ?? 0));
}

export function TabRecord({ tab, tz, now, onOpen }: { tab: HistoryTab; tz: string; now: number; onOpen?: (tabId: string) => void }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const live = tab.state === 'ordering' || tab.state === 'seated';
  const items = tab.lines.filter((l) => l.status !== 'voided').reduce((n, l) => n + l.qty, 0);
  const voided = tab.lines.filter((l) => l.status === 'voided').length;
  const pending = tab.lines.filter((l) => l.status === 'pending').length;
  const endedAt = tab.clearedAt ?? tab.closedAt;
  const length = (live ? now : (endedAt ?? now)) - tab.openedAt;
  const settledAt = tab.bills.reduce<number | null>((m, b) => (b.settledAt && (!m || b.settledAt > m) ? b.settledAt : m), null);

  return (
    <li className={cx('overflow-hidden rounded-[18px] border bg-raised/70 backdrop-blur-glass transition-colors', open ? 'border-rule-raised/70' : 'border-rule-raised/40', live && 'border-l-2 border-l-accent/60')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-row-floor w-full items-center gap-12 px-12 py-8 text-left press-feedback hover:bg-control/30 pad:px-16"
      >
        <span className="hidden w-[44px] shrink-0 font-mono tabular text-num-sm text-ink-subtle compact:block">{formatTime(tab.openedAt, tz)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-8">
            <span className="truncate text-body-lg text-ink">{tab.label}</span>
            {tab.tabNumber ? <span className="shrink-0 font-mono text-micro text-ink-subtle">#{tab.tabNumber}</span> : null}
          </span>
          <span className="block truncate text-body-sm text-ink-subtle">
            <span className="compact:hidden">{formatTime(tab.openedAt, tz)} · </span>
            {tab.waiter} · {plural(tab.guests, 'guest')} · {plural(items, 'item')}
            {voided > 0 ? ` · ${voided} voided` : ''}
          </span>
        </span>
        <span className="hidden pad:inline-flex">
          <StateChip state={tab.state} />
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <Money value={tab.totalCents} size="num" decimals="whole" />
          <span className="pad:hidden">
            <Dot tone={STATE[tab.state].tone} className="mr-4" />
            <span className="text-micro text-ink-subtle">{STATE[tab.state].word}</span>
          </span>
        </span>
        <IconChevronDown size={18} stroke={ICON_STROKE} aria-hidden="true" className={cx('shrink-0 text-ink-subtle transition-transform duration-[160ms]', open && 'rotate-180')} />
      </button>

      {open ? (
        <div id={panel} className="border-t border-rule-raised/30 px-12 pb-16 pt-12 pad:px-16">
          <p className="mb-12 flex flex-wrap items-center gap-x-12 gap-y-4 text-body-sm text-ink-muted">
            <span className="inline-flex items-center gap-4">
              <IconClockHour4 size={14} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-subtle" />
              {live ? `Open ${formatElapsed(length)}` : `Sat ${formatElapsed(length)}`}
            </span>
            {tab.zone ? <span>{tab.zone}</span> : null}
            {pending > 0 && live ? <span className="text-low">{plural(pending, 'line')} still to pour</span> : null}
          </p>

          <ol aria-label={`${tab.label}, the night in order`}>
            <Moment icon={IconDoorEnter} at={tab.openedAt} tz={tz} tone="accent">
              <span className="text-body text-ink">Opened by {tab.waiter}</span>
              <span className="text-body-sm text-ink-subtle"> · {plural(tab.guests, 'guest')}</span>
            </Moment>

            {rounds(tab.lines).map((r, i) => (
              <Moment key={i} icon={IconBeer} at={r.firedAt} tz={tz}>
                <span className="text-body text-ink">{r.orderNumber ? `Round ${r.orderNumber}` : 'Round'}</span>
                <span className="text-body-sm text-ink-subtle">
                  {' '}
                  · {plural(r.lines.length, 'line')}
                  {r.deliveredAt ? ` · at the table ${formatTime(r.deliveredAt, tz)}` : ''}
                </span>
                <ul className="mt-4 rounded-md bg-sunken/50 px-8 py-2">
                  {r.lines.map((l) => (
                    <LineRow key={l.id} line={l} tz={tz} ordering={tab.state === 'ordering'} />
                  ))}
                </ul>
              </Moment>
            ))}

            {tab.bills.map((b) => (
              <Moment key={b.id} icon={IconReceipt} at={b.settledAt} tz={tz} tone="poured">
                <span className="text-body text-ink">
                  Bill {b.billNumber} · {SCOPE[b.scope]}
                  {b.seatNo ? ` ${b.seatNo}` : ''}
                </span>
                <span className="text-body-sm text-ink-subtle">
                  {' '}
                  · {b.settledBy} at {b.device}
                </span>
                <span className="mt-4 flex flex-wrap items-center justify-between gap-8">
                  <TenderChips bill={b} />
                  <Money value={b.totalCents} size="num-sm" decimals="whole" />
                </span>
              </Moment>
            ))}

            {tab.state === 'voided' ? (
              <Moment icon={IconBan} at={tab.closedAt} tz={tz} tone="stop" last>
                <span className="text-body text-ink">Closed without an order</span>
              </Moment>
            ) : tab.state === 'merged' ? (
              <Moment icon={IconArrowRight} at={tab.closedAt} tz={tz} last>
                <span className="text-body text-ink">Merged into another tab</span>
              </Moment>
            ) : tab.state === 'cleared' ? (
              <Moment icon={IconDoorExit} at={tab.clearedAt} tz={tz} last>
                <span className="text-body text-ink">Table cleared</span>
                {settledAt && tab.clearedAt && tab.clearedAt > settledAt ? <span className="text-body-sm text-ink-subtle"> · {formatElapsed(tab.clearedAt - settledAt)} after paying</span> : null}
              </Moment>
            ) : tab.state === 'seated' ? (
              <Moment icon={IconToolsKitchen2} at={null} tz={tz} tone="poured" last>
                <span className="text-body text-ink">Paid, guests still at the table</span>
              </Moment>
            ) : (
              <Moment icon={IconCheck} at={null} tz={tz} tone="accent" last>
                <span className="text-body text-ink">Still open</span>
              </Moment>
            )}
          </ol>

          {tab.bills.length > 0 && compare(tab.paidCents, tab.totalCents) !== 0 ? (
            <p className="mt-12 flex items-center justify-between rounded-md bg-sunken/50 px-12 py-8 text-body-sm text-ink-muted">
              <span>Paid so far</span>
              <Money value={tab.paidCents} size="num-sm" decimals="whole" />
            </p>
          ) : null}

          {live && onOpen ? (
            <div className="mt-12 flex justify-end">
              <Button variant="secondary" size="md" icon={IconArrowRight} iconPosition="end" onClick={() => onOpen(tab.id)}>
                Go to the tab
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function SaleRecord({ sale, tz }: { sale: HistorySale; tz: string }) {
  const count = sale.items.reduce((n, i) => n + i.qty, 0);
  return (
    <li className="flex min-h-row-floor items-center gap-12 rounded-[18px] border border-rule-raised/40 bg-raised/50 px-12 py-8 backdrop-blur-glass pad:px-16">
      <span className="hidden w-[44px] shrink-0 font-mono tabular text-num-sm text-ink-subtle compact:block">{sale.bill.settledAt ? formatTime(sale.bill.settledAt, tz) : ''}</span>
      <span aria-hidden="true" className="flex size-control-sm shrink-0 items-center justify-center rounded-dot bg-money/15 text-money">
        <IconShoppingBag size={16} stroke={ICON_STROKE} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-ink">{sale.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ') || 'Quick sale'}</span>
        <span className="flex flex-wrap items-center gap-x-8 gap-y-2 text-body-sm text-ink-subtle">
          <span>
            Quick sale · {plural(count, 'item')} · {sale.bill.settledBy}
          </span>
          <TenderChips bill={sale.bill} />
        </span>
      </span>
      <Money value={sale.bill.totalCents} size="num" decimals="whole" className="shrink-0" />
    </li>
  );
}
