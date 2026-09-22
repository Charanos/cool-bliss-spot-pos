'use client';

import { formatTime, plural } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import {
  IconAlertCircle,
  IconCheck,
  IconChevronRight,
  IconClockHour4,
  IconDots,
} from '@tabler/icons-react';
import { useLongPress } from '../../hooks';
import { cx } from '../../lib/cx';
import { Badge } from '../badge';
import { Elapsed } from '../elapsed';
import { ICON_STROKE } from '../icon';
import { Money } from '../money';
import { SeatChip } from '../seat-chip';
import { Dot } from '../status';
import { paneClass } from '../working';
import type { TicketLineState } from './ticket';

export interface OrderCardLine {
  id: string;
  name: string;
  qty: number;
  seatNo: number | null;
  state: TicketLineState;
  modifiers?: string[];
  servedAt?: number | null;
}

export interface OrderCardProps {
  orderId: string;
  tabId: string;
  label: string;
  firedAt: number;
  state: 'held' | 'at_bar' | 'poured' | 'served' | 'needs_you';
  deliveredAt?: number | null;
  unsent?: boolean;
  lines: readonly OrderCardLine[];
  waiter?: string | null;
  mine: boolean;
  zoneName?: string | null;
  total?: Cents;
  timezone?: string;
  onOpen: () => void;
  onMarkServed?: () => void;
  onActionMenu?: () => void;
}

/**
 * High-fidelity Order Card on the Floor Orders surface.
 * Conforms to docs/13-floor-tabs-revamp.md & docs/12-surface-language.md:
 * - Clear operational distinction between "Poured" (counter ready) and "Served" (table delivered)
 * - Mobile ergonomics: 1-tap "Mark served" button on poured cards + 450ms haptic long-press sheet
 * - Desktop parity: 3-dot menu trigger + right-click context menu
 * - Composes paneClass with tactile glass surface and distinct ambient accents
 * - Utilizes the Badge component primitive for line-level and card-level status pills
 * - Accessible name synthesized for screen readers
 */
export function OrderCard({
  tabId: _tabId,
  label,
  firedAt,
  state,
  deliveredAt,
  lines,
  waiter,
  mine,
  zoneName,
  total,
  timezone = 'Africa/Nairobi',
  onOpen,
  onMarkServed,
  onActionMenu,
}: OrderCardProps) {
  const isNeedsYou = state === 'needs_you';
  const isPoured = state === 'poured';
  const isServed = state === 'served';
  const isAtBar = state === 'at_bar';
  const isHeld = state === 'held';

  const totalQty = lines.reduce((acc, l) => acc + l.qty, 0);
  const ranOutCount = lines.filter((l) => l.state === 'ran_out').length;

  const emphasis = isNeedsYou ? 'attention' : mine ? 'mine' : 'default';

  // Accessible name for screen readers
  const accessibleStatePhrase = isNeedsYou
    ? `, needs attention, ${ranOutCount} item ran out`
    : isServed
      ? ', served to table'
      : isPoured
        ? ', poured and ready to deliver to table'
        : isHeld
          ? ', held on tablet'
          : ', at the bar';
  const accessibleName = `${label}${mine ? ', your order' : waiter ? `, ${waiter}'s order` : ''}, ${lines.length} lines${accessibleStatePhrase}`;

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      onActionMenu?.();
    },
    onPress: onOpen,
    disabled: !onActionMenu,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      {...(onActionMenu ? longPressHandlers : { onClick: onOpen })}
      onContextMenu={(e) => {
        if (onActionMenu) {
          e.preventDefault();
          onActionMenu();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cx(
        paneClass({ emphasis }),
        'group relative flex w-full flex-col justify-between rounded-[20px] tablet:rounded-[22px] p-12 tablet:p-20 text-left transition-all duration-300 min-h-[200px] cursor-pointer select-none',
        'bg-raised/70 backdrop-blur-glass border',
        isNeedsYou && 'border-stop/40 hover:border-stop/70 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-stop)_25%,transparent)]',
        isPoured && 'border-poured/45 hover:border-poured/75 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-poured)_20%,transparent)]',
        isServed && 'border-served/40 hover:border-served/70 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-served)_18%,transparent)]',
        isAtBar && 'border-rule-raised/50 hover:border-accent-subtle/60 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)]',
        isHeld && 'border-rule-raised/40 hover:border-rule-raised',
      )}
    >
      <div>
        {/* ── Header: Title, Zone, Card Status Badge & Actions ─────────────── */}
        <div className="flex items-start justify-between gap-8 tablet:gap-12">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-6 tablet:gap-8 min-w-0 flex-wrap">
              <span className="truncate text-subtitle tablet:text-title font-medium text-ink" title={label}>
                {label}
              </span>
              {zoneName ? (
                <Badge tone="neutral" className="!rounded-full px-6 py-6 tablet:px-8 tablet:py-2 font-mono text-micro ">
                  {zoneName}
                </Badge>
              ) : null}
              {!mine && waiter ? (
                <span className="shrink-0 truncate rounded-full bg-sunken/60 px-6 py-4 tablet:px-8 tablet:py-6 font-mono text-micro text-ink-subtle max-w-[100px]">
                  {waiter}
                </span>
              ) : null}
            </div>

            {/* MetaLine: Fired time, elapsed, lines count, items count */}
            <div className="mt-4 tablet:mt-6 flex items-center flex-wrap gap-x-6 gap-y-2 font-mono text-micro tablet:text-body-sm text-ink-subtle">
              <span>Fired {formatTime(firedAt, timezone)}</span>
              <span aria-hidden="true" className="text-ink-disabled">·</span>
              <span className="inline-flex items-center gap-4">
                <IconClockHour4 size={13} stroke={ICON_STROKE} className="text-ink-subtle" />
                <Elapsed since={firedAt} warnAfterMs={15 * 60 * 1000} />
              </span>
              <span aria-hidden="true" className="text-ink-disabled">·</span>
              <span>{plural(lines.length, 'line')}</span>
              {totalQty > lines.length ? (
                <>
                  <span aria-hidden="true" className="text-ink-disabled">·</span>
                  <span>{totalQty} items</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Card Top-Right Status Badge & 3-Dot Action Trigger */}
          <div className="shrink-0 flex items-center gap-6">
            {isNeedsYou ? (
              <Badge tone="stop" className="!rounded-full px-8 py-12 tablet:px-12 tablet:py-4 shadow-[0_0_12px_color-mix(in_oklab,var(--color-stop)_20%,transparent)]">
                <IconAlertCircle size={13} stroke={ICON_STROKE} className="shrink-0 animate-breathe" />
                <span>Needs you</span>
              </Badge>
            ) : isPoured ? (
              <Badge tone="poured" className="!rounded-full px-8 py-12 tablet:px-12 tablet:py-4 shadow-[0_0_12px_color-mix(in_oklab,var(--color-poured)_15%,transparent)]">
                <Dot tone="poured" />
                <span>Poured · Ready</span>
              </Badge>
            ) : isServed ? (
              <Badge tone="served" className="!rounded-full px-8 py-12 tablet:px-12 tablet:py-4 shadow-[0_0_12px_color-mix(in_oklab,var(--color-served)_15%,transparent)]">
                <Dot tone="served" />
                <span>Served</span>
              </Badge>
            ) : isHeld ? (
              <Badge tone="attention" className="!rounded-full px-8 py-12 tablet:px-12 tablet:py-4">
                <Dot tone="low" />
                <span>Held</span>
              </Badge>
            ) : (
              <Badge tone="accent" className="!rounded-full px-8 py-12 tablet:px-12 tablet:py-4 shadow-[0_0_12px_color-mix(in_oklab,var(--color-accent)_15%,transparent)]">
                <span className="size-6 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)] animate-breathe" />
                <span>At the bar</span>
              </Badge>
            )}

            {onActionMenu ? (
              <button
                type="button"
                aria-label={`Actions for order ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onActionMenu();
                }}
                className="size-32 rounded-full flex items-center justify-center text-ink-subtle hover:text-ink hover:bg-sunken/80 transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <IconDots size={16} stroke={ICON_STROKE} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 tablet:my-12 border-t border-rule-raised/30" />

        {/* ── Order Line Items List (utilizing Badge primitive for status) ── */}
        <div className="flex flex-col gap-4">
          {lines.map((l) => (
            <div
              key={l.id}
              className={cx(
                'flex min-h-[36px] tablet:min-h-[38px] items-center justify-between gap-8 tablet:gap-12 rounded-md px-6 py-4 tablet:px-8 tablet:py-6 transition-colors border-t border-rule-raised/20 first:border-t-0',
                l.state === 'ran_out' ? 'bg-stop/10' : 'hover:bg-sunken/40',
              )}
            >
              {/* Left group: Seat chip, Qty multiplier, Item name & modifiers */}
              <div className="flex items-center gap-8 tablet:gap-12 min-w-0 flex-1">
                {/* Seat Chip */}
                <div className="shrink-0">
                  {l.seatNo !== null ? (
                    <SeatChip seat={l.seatNo} size="dense" />
                  ) : (
                    <SeatChip seat="shared" size="dense" />
                  )}
                </div>

                {/* Quantity with multiplier */}
                <span className="w-12 tablet:w-16 shrink-0 text-center font-mono tabular text-micro tablet:text-body-sm font-medium text-ink-muted">
                  {l.qty}×
                </span>

                {/* Name & Modifiers */}
                <div className="flex flex-1 flex-col min-w-0 pr-4 tablet:pr-8">
                  <span
                    className={cx(
                      'truncate text-micro tablet:text-body-sm font-medium ',
                      l.state === 'ran_out' ? 'text-stop' : 'text-ink',
                    )}
                    title={l.name}
                  >
                    {l.name}
                  </span>
                  {l.modifiers && l.modifiers.length > 0 ? (
                    <span className="truncate font-mono text-[9px] tablet:text-micro text-ink-subtle mt-4">
                      {l.modifiers.join(' · ')}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Right: Badge Component Primitive for Line Status */}
              <div className="shrink-0 ml-4 tablet:ml-8">
                {isServed ? (
                  <Badge tone="served" className="px-6 py-2 tablet:px-8 tablet:py-2 font-mono text-micro tablet:text-badge shrink-0">
                    <Dot tone="served" />
                    <span>
                      <span>{deliveredAt ? formatTime(deliveredAt, timezone) : (l.servedAt ? formatTime(l.servedAt, timezone) : 'Served')}</span>
                    </span>
                  </Badge>
                ) : l.state === 'poured' ? (
                  <Badge tone="poured" className="px-6 py-2 tablet:px-8 tablet:py-2 font-mono text-micro tablet:text-badge shrink-0">
                    <Dot tone="poured" />
                    <span>
                      <span>{l.servedAt ? formatTime(l.servedAt, timezone) : 'Poured'}</span>
                    </span>
                  </Badge>
                ) : l.state === 'ran_out' ? (
                  <Badge tone="stop" className="px-6 py-2 tablet:px-8 tablet:py-2 font-mono text-micro tablet:text-badge shrink-0">
                    <Dot tone="stop" />
                    <span>Ran out</span>
                  </Badge>
                ) : l.state === 'unsent' ? (
                  <Badge tone="attention" className="px-6 py-2 tablet:px-8 tablet:py-2 font-mono text-micro tablet:text-badge shrink-0">
                    <Dot tone="low" />
                    <span>Held</span>
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="px-6 py-2 tablet:px-8 tablet:py-2 font-mono text-micro tablet:text-badge shrink-0">
                    <span className="size-4 rounded-full bg-accent/70 animate-breathe" />
                    <span>Waiting</span>
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer / Action Banners ────────────────────────────────── */}
      <div className="mt-12 tablet:mt-16">
        {isNeedsYou ? (
          <div className="flex items-center justify-between rounded-lg bg-stop-wash px-12 py-6 tablet:px-12 tablet:py-8 text-body-sm text-stop transition-colors group-hover:bg-stop/[0.18]">
            <div className="flex items-center gap-6 tablet:gap-8 min-w-0">
              <IconAlertCircle size={15} stroke={ICON_STROKE} className="shrink-0 text-stop animate-breathe" />
              <span className="text-micro tablet:text-body-sm font-medium truncate">
                Item ran out. Tap to swap or void.
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-micro uppercase text-stop shrink-0 font-medium">
              <span>Resolve</span>
              <IconChevronRight size={13} stroke={ICON_STROKE} className="transition-transform group-hover:translate-x-4" />
            </div>
          </div>
        ) : isPoured ? (
          <div className="flex items-center justify-between gap-8 rounded-lg bg-poured-wash px-12 py-6 tablet:px-12 tablet:py-8 text-body-sm text-poured transition-colors group-hover:bg-poured/[0.14]">
            <div className="flex items-center gap-6 tablet:gap-8 min-w-0">
              <IconCheck size={15} stroke={ICON_STROKE} className="shrink-0 text-poured" />
              <span className="text-micro tablet:text-body-sm font-medium truncate">
                Poured at bar · Ready to serve
              </span>
            </div>
            {onMarkServed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkServed();
                }}
                className="shrink-0 rounded-lg bg-poured px-12 py-6 font-mono text-micro font-medium uppercase text-page hover:brightness-110 active:scale-95 transition-all shadow-raised flex items-center gap-6"
              >
                <IconCheck size={14} stroke={2.5} className="text-page" />
                <span>Mark served</span>
              </button>
            ) : (
              <div className="flex items-center gap-4 font-mono text-micro uppercase text-poured shrink-0 font-medium">
                <span>Open tab</span>
                <IconChevronRight size={13} stroke={ICON_STROKE} className="transition-transform group-hover:translate-x-4" />
              </div>
            )}
          </div>
        ) : isServed ? (
          <div className="flex items-center justify-between pt-6 border-t border-rule-raised/20 text-body-sm text-ink-subtle">
            {total !== undefined ? (
              <div className="flex flex-col items-baseline gap-6 font-mono text-micro tablet:text-body-sm text-ink-subtle">
                <span className="text-micro uppercase ">Total</span>
                <Money value={total} size="num-sm" decimals="whole" tone="default" />
              </div>
            ) : (
              <div />
            )}
            <div className="flex flex-col items-end gap-4">
              {deliveredAt ? (
                <span className="font-mono text-micro text-served font-medium">
                  Served {formatTime(deliveredAt, timezone)}
                </span>
              ) : (
                <span className="font-mono text-micro text-served font-medium">Served to table</span>
              )}
              <div className="flex items-center gap-4 font-mono text-micro tablet:text-body-sm text-ink-subtle group-hover:text-accent transition-colors font-medium">
                <span>View tab</span>
                <IconChevronRight size={13} stroke={ICON_STROKE} className="transition-transform group-hover:translate-x-4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-6 border-t border-rule-raised/20 text-body-sm text-ink-subtle">
            {total !== undefined ? (
              <div className="flex flex-col items-baseline gap-6 font-mono text-micro tablet:text-body-sm text-ink-subtle">
                <span className="text-micro uppercase ">Total</span>
                <Money value={total} size="num-sm" decimals="whole" tone="default" />
              </div>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-4 font-mono text-micro tablet:text-body-sm text-ink-subtle group-hover:text-accent transition-colors font-medium">
              <span>View tab</span>
              <IconChevronRight size={13} stroke={ICON_STROKE} className="transition-transform group-hover:translate-x-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
