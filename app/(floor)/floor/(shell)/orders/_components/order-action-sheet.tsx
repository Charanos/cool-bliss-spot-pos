'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StateMark, StatePill } from '@bliss/ui/components/status';
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCheck,
  IconChecks,
  IconChevronRight,
  IconClockHour4,
  IconReceipt,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deliver, deliverTable, undeliver } from '@/lib/pos/actions';
import type { FiredOrderView } from '@/lib/pos/queries';
import { pour } from '@/lib/pos/actions';

export interface OrderActionSheetProps {
  order: FiredOrderView | null;
  timezone: string;
  onClose: () => void;
}

/**
 * Production-grade Order Action Sheet on the Floor.
 * Conforms to docs/13-floor-tabs-revamp.md & docs/12-surface-language.md:
 * - High-fidelity tactile ticket breakdown showing each seat, quantity, and line status
 * - Contextual Hero Action button with distinct token colors (Poured = Mint Green, Served = Azure Blue)
 * - Table-wide batch fulfillment and rapid navigation shortcuts
 * - Strictly follows bliss/one-pane and bliss/max-font-weight guidelines
 */
export function OrderActionSheet({ order, timezone, onClose }: OrderActionSheetProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const isPoured = order.state === 'poured';
  const isServed = order.state === 'served';
  const isAtBar = order.state === 'at_bar';
  const isNeedsYou = order.state === 'needs_you';

  const totalQty = order.lines.reduce((acc, l) => acc + l.line.qty, 0);

  // The actions report their own outcome as a notice, with an undo where there is one, so the sheet
  // closes on success and stays open only while the change is being made.
  const handleAction = async (action: () => Promise<unknown>) => {
    try {
      setSubmitting(true);
      setError(null);
      await action();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={Boolean(order)}
      onClose={onClose}
      width="lg"
      className="desktop:!w-[760px] desktop:max-w-[760px]"
      title={
        <div className="flex flex-col gap-8 w-full pr-6">
          <div className="flex items-center justify-between gap-12 flex-wrap">
            <div className="flex items-center gap-8 min-w-0">
              <span className="text-title-lg font-medium text-ink truncate">
                {order.label}
              </span>
              {order.zoneName ? (
                <span className="shrink-0 rounded-dot bg-neutral-wash px-8 py-2 text-micro text-ink-subtle">{order.zoneName}</span>
              ) : null}
            </div>

            {/* The order's state */}
            {isNeedsYou ? (
              <StatePill tone="stop" live>
                Needs you
              </StatePill>
            ) : isPoured ? (
              <StatePill tone="poured" more="· ready">
                Poured
              </StatePill>
            ) : isServed ? (
              <StatePill tone="served">Served</StatePill>
            ) : (
              <StatePill tone="accent" live>
                At the bar
              </StatePill>
            )}
          </div>

          {/* Subtitle with Fired time, Elapsed timer, Server info, Ticket ID */}
          <div className="flex items-center gap-8 font-mono text-micro text-ink-subtle flex-wrap">
            <span className="inline-flex items-center gap-4">
              <IconClockHour4 size={13} stroke={ICON_STROKE} className="text-ink-subtle" />
              <span>Fired {formatTime(order.firedAt, timezone)}</span>
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="inline-flex items-center gap-4 text-ink-muted">
              <Elapsed since={order.firedAt} />
            </span>
            {order.waiterName ? (
              <>
                <span aria-hidden="true" className="text-ink-disabled">·</span>
                <span>Server: {order.waiterName}</span>
              </>
            ) : null}
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="text-ink-disabled font-mono">#{order.orderId.slice(-6).toUpperCase()}</span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-16 pb-8">
        {/* ── 1. High-Fidelity Itemized Ticket Breakdown ─────────────── */}
        <div className="rounded-lg bg-control overflow-hidden ">
          {/* Ticket header row */}
          <div className="flex items-center justify-between px-16 py-12 border-b border-rule-raised/25 font-mono text-micro uppercase text-ink-subtle">
            <span className="flex items-center gap-6">
              <span>Order items</span>
              <span className="text-ink-disabled font-regular">({totalQty} total)</span>
            </span>
            <span>{plural(order.lines.length, 'line')}</span>
          </div>

          {/* List of items */}
          <div className="flex flex-col max-h-[280px] desktop:max-h-[330px] overflow-y-auto no-scrollbar divide-y divide-rule-raised/20 px-12 py-6">
            {order.lines.map(({ line, name, seatNo, state, modifiers }) => (
              <div
                key={line.id}
                className="flex items-center justify-between py-8 px-8 gap-16 group/line hover:bg-control-hover/30 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-12 min-w-0 flex-1">
                  <div className="shrink-0">
                    <SeatChip seat={seatNo ?? 'shared'} size="dense" />
                  </div>
                  <span className="font-mono tabular text-body-sm font-medium text-ink w-[32px] shrink-0 text-center">
                    {line.qty}×
                  </span>
                  <div className="flex flex-col min-w-0 pr-8">
                    <span className="text-body-sm font-medium text-ink truncate ">
                      {name}
                    </span>
                    {modifiers && modifiers.length > 0 ? (
                      <span className="font-mono text-micro text-ink-subtle truncate mt-2">
                        {modifiers.join(' · ')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-16 shrink-0">
                  {line.lineTotalCents ? (
                    <div className="text-right flex flex-col items-end min-w-[76px]">
                      <Money value={line.lineTotalCents} size="num-sm" tone="subtle" decimals="whole" />
                    </div>
                  ) : null}

                  {isServed ? (
                    <StateMark tone="served">Served</StateMark>
                  ) : state === 'poured' ? (
                    <StateMark tone="poured">Poured</StateMark>
                  ) : state === 'ran_out' ? (
                    <StateMark tone="stop">Ran out</StateMark>
                  ) : (
                    <StateMark tone="neutral">At the bar</StateMark>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary footer */}
          <div className="flex items-center justify-between px-16 py-16 border-t border-rule-raised/25">
            <div className="flex flex-col">
              <span className="font-mono text-micro uppercase text-ink-subtle">
                Order Total
              </span>
              <span className="font-mono text-micro text-ink-disabled">
                Fired {formatTime(order.firedAt, timezone)} · {totalQty} items
              </span>
            </div>
            <Money value={order.total} size="num" tone="default" />
          </div>
        </div>

        {/* ── 2. Contextual Hero Action Card ─────────────────────────── */}
        {isPoured ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction(() => deliver(order.orderId, order.label))}
            className="w-full flex items-center justify-between p-16 desktop:p-16 rounded-[18px] bg-served text-page font-medium shadow-[0_6px_28px_color-mix(in_oklab,var(--color-served)_35%,transparent)] hover:brightness-105 active:scale-[0.99] transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-16 min-w-0">
              <div className="size-40 rounded-full bg-page/20 flex items-center justify-center shrink-0">
                <IconCheck size={22} stroke={2.5} className="text-page" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-body-lg font-medium text-page ">
                  Mark served to table
                </span>
                <span className="text-micro desktop:text-body-sm text-page/80 font-mono truncate">
                  Deliver poured drinks to {order.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-8 shrink-0">
              <span className="hidden tablet:inline-flex px-8 py-2 rounded-full bg-page/15 font-mono text-micro text-page">
                Deliver order
              </span>
              <IconChevronRight size={20} stroke={2.5} className="text-page/80 shrink-0 group-hover:translate-x-6 transition-transform" />
            </div>
          </button>
        ) : isServed ? (
          <div className="w-full flex items-center justify-between p-16 desktop:p-16 rounded-[18px] bg-served-wash border border-served/35 text-served">
            <div className="flex items-center gap-12 min-w-0">
              <div className="size-40 rounded-full bg-served/20 flex items-center justify-center shrink-0">
                <IconChecks size={20} stroke={2.5} className="text-served" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-body font-medium text-served ">
                  Delivered & served to table
                </span>
                <span className="text-micro font-mono text-served/80 truncate">
                  {order.deliveredAt ? `Delivered at ${formatTime(order.deliveredAt, timezone)}` : 'Delivered to guests'} · Order complete
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction(() => undeliver(order.orderId, order.label))}
              className="shrink-0 px-12 py-24 rounded-md text-micro font-mono uppercase text-ink-subtle hover:text-stop hover:bg-stop-wash border-t border-b border-rule-raised/20 transition-all font-medium flex items-center gap-6 cursor-pointer"
            >
              <IconRotateClockwise size={13} stroke={ICON_STROKE} />
              <span>Undo delivery</span>
            </button>
          </div>
        ) : isAtBar ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              handleAction(async () => {
                const pendingIds = order.lines.filter((l) => l.state === 'waiting').map((l) => l.line.id);
                if (pendingIds.length > 0) {
                  await pour(order.tabId, order.orderId, pendingIds, order.label, true);
                }
                await deliver(order.orderId, order.label);
              })
            }
            className="w-full flex items-center justify-between p-16 desktop:p-16 rounded-[18px] bg-page border border-accent/30 text-ink shadow-raised hover:border-accent/50 hover:bg-control active:scale-[0.99] transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-16 min-w-0">
              <div className="size-40 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <IconClockHour4 size={22} stroke={2.5} className="text-accent-text group-hover:text-accent transition-colors" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-body-lg font-medium text-ink">
                  Force mark served
                </span>
                <span className="text-micro desktop:text-body-sm text-ink-subtle font-mono truncate">
                  Fired <Elapsed since={order.firedAt} /> ago · Bypass counter
                </span>
              </div>
            </div>
            <div className="flex items-center gap-8 shrink-0">
              <span className="hidden tablet:inline-flex px-8 py-2 rounded-full bg-accent-wash font-mono text-micro text-accent-text">
                Override
              </span>
              <IconChevronRight size={20} stroke={2.5} className="text-ink-subtle shrink-0 group-hover:translate-x-6 group-hover:text-ink transition-all" />
            </div>
          </button>
        ) : isNeedsYou ? (
          <div className="w-full flex items-center justify-between p-16 desktop:p-16 rounded-[18px] bg-stop-wash border border-stop/35 text-stop">
            <div className="flex items-center gap-12 min-w-0">
              <div className="size-40 rounded-full bg-stop/20 flex items-center justify-center shrink-0">
                <IconAlertCircle size={20} stroke={2} className="text-stop" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-body font-medium text-stop ">
                  Attention: Stock ran out at bar
                </span>
                <span className="text-micro font-mono text-stop/80 truncate">
                  One or more items need replacement or voiding on the tab
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/floor/tabs/${order.tabId}`);
              }}
              className="shrink-0 px-12 py-24 rounded-md text-micro font-mono uppercase text-stop hover:bg-stop/20 border-t border-b border-stop/30 transition-all font-medium flex items-center gap-6 cursor-pointer"
            >
              <span>Resolve tab</span>
              <IconChevronRight size={13} stroke={ICON_STROKE} />
            </button>
          </div>
        ) : null}

        {/* ── 3. Table-Wide Batch & Navigation Actions ──────────────── */}
        <div className="flex flex-col gap-8">
          {/* Table batch delivery action */}
          {!isServed ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction(() => deliverTable(order.tabId, order.label))}
              className="w-full flex items-center justify-between p-12 desktop:p-16 rounded-[16px] hover:bg-control-hover border-t border-rule-raised/20 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-12 min-w-0">
                <div className="size-40 rounded-md bg-served-wash flex items-center justify-center shrink-0">
                  <IconChecks size={20} stroke={ICON_STROKE} className="text-served" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-body-sm font-medium text-ink truncate group-hover:text-served transition-colors">
                    Mark all orders for this table served
                  </span>
                  <span className="font-mono text-micro text-ink-subtle truncate">
                    Batch deliver all pending drinks for {order.label}
                  </span>
                </div>
              </div>
              <IconChevronRight size={16} stroke={ICON_STROKE} className="text-ink-subtle shrink-0 group-hover:translate-x-4 transition-transform" />
            </button>
          ) : null}

          {/* Rapid Tab Navigation Shortcuts */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-8 pt-4 border-t border-rule-raised/20">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/floor/tabs/${order.tabId}`);
              }}
              className="flex items-center gap-12 p-12 desktop:p-16 rounded-[16px] hover:bg-control-hover transition-colors text-left group cursor-pointer border-t border-rule-raised/15"
            >
              <div className="size-40 rounded-md bg-control flex items-center justify-center shrink-0 text-ink-subtle group-hover:text-ink transition-colors">
                <IconReceipt size={20} stroke={ICON_STROKE} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-body-sm font-medium text-ink truncate group-hover:text-accent transition-colors">Open tab & bill</span>
                <span className="font-mono text-micro text-ink-subtle truncate">View seats, additions & settle</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/floor/tabs/${order.tabId}`);
              }}
              className="flex items-center gap-12 p-12 desktop:p-16 rounded-[16px] hover:bg-control-hover transition-colors text-left group cursor-pointer border-t border-rule-raised/15"
            >
              <div className="size-40 rounded-md bg-control flex items-center justify-center shrink-0 text-ink-subtle group-hover:text-ink transition-colors">
                <IconArrowsExchange size={20} stroke={ICON_STROKE} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-body-sm font-medium text-ink truncate group-hover:text-accent transition-colors">Move tab</span>
                <span className="font-mono text-micro text-ink-subtle truncate">Transfer to other table or guest</span>
              </div>
            </button>
          </div>
        </div>

        {/* ── 4. Exception / Destructive Section ────────────────────── */}
        <div className="pt-6 border-t border-rule-raised/20">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/floor/tabs/${order.tabId}`);
            }}
            className="w-full flex items-center justify-between p-12 desktop:p-16 rounded-[16px] bg-stop-wash hover:bg-stop/[0.18] transition-colors text-left group text-stop cursor-pointer"
          >
            <div className="flex items-center gap-12 min-w-0">
              <IconAlertCircle size={20} stroke={ICON_STROKE} className="shrink-0 text-stop" />
              <div className="flex flex-col min-w-0">
                <span className="text-body-sm font-medium text-stop truncate">
                  Void or swap items on tab
                </span>
                <span className="font-mono text-micro text-stop/70 truncate">
                  Modify fired lines, resolve stock conflicts, or reassign seat
                </span>
              </div>
            </div>
            <IconChevronRight size={16} stroke={ICON_STROKE} className="text-stop shrink-0 group-hover:translate-x-4 transition-transform" />
          </button>
        </div>

        {/* Error notification if mutation fails */}
        {error ? (
          <div className="rounded-lg border border-stop/30 bg-stop-wash px-16 py-12 text-stop text-body-sm font-medium">
            {error}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
