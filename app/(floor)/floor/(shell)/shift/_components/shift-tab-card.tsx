'use client';

import type { Cents } from '@bliss/shared/money';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { SeatChipStack } from '@bliss/ui/components/working';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconCheck,
  IconChevronRight,
  IconClockHour4,
} from '@tabler/icons-react';

export interface ShiftTabSeat {
  id: string;
  seatNo: number;
  status: string;
}

export interface ShiftTabCardProps {
  tabId: string;
  label: string;
  zoneName?: string;
  seats: readonly ShiftTabSeat[];
  showSeats: boolean;
  openedAt: number;
  total: Cents;
  pouredCount?: number;
  selected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  className?: string;
}

/**
 * Production-grade assigned table card for the Floor Waiter Shift console.
 * Replaces the flat borderless list with a tactile, interactive raised surface.
 * Conforms strictly to docs/12-surface-language.md, bliss/one-pane and bliss/max-font-weight.
 */
export function ShiftTabCard({
  label,
  zoneName,
  seats,
  showSeats,
  openedAt,
  total,
  pouredCount = 0,
  selected,
  onSelect,
  onOpen,
  className,
}: ShiftTabCardProps) {
  const settledCount = seats.filter((s) => s.status === 'settled').length;

  return (
    <div
      className={cx(
        'relative flex flex-col justify-between overflow-hidden rounded-lg p-18 mr-12 tablet:p-20 gap-16 transition-all duration-200 select-none group',
        // Sleek frosted glass tactile raised surface
        'bg-raised/70 backdrop-blur-md border border-rule-raised/40 shadow-lift',
        selected
          ? 'border-accent ring-1 ring-accent/40 bg-accent/[0.06]'
          : 'hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-glow',
        className,
      )}
    >
      {/* ── Top Row: Table Label, Zone, Elapsed & Status Badges ──────── */}
      <div className="flex items-center justify-between gap-12 flex-wrap">
        <div className="flex items-center gap-10 min-w-0">
          {onSelect ? (
            <button
              type="button"
              aria-label={`Select ${label} for handover`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={cx(
                'size-[24px] rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer',
                selected
                  ? 'bg-accent border-accent text-accent-ink shadow-sm'
                  : 'border-rule-sunken/60 hover:border-accent text-transparent',
              )}
            >
              <IconCheck size={14} stroke={2.5} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className="text-left font-medium text-title text-ink group-hover:text-accent transition-colors truncate cursor-pointer tracking-tight"
          >
            {label}
          </button>

          {zoneName ? (
            <Badge tone="neutral" className="!rounded-dot px-8 py-1 font-mono text-micro">
              {zoneName}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-8 shrink-0">
          <div className="flex items-center gap-4 px-8 py-2 rounded-dot bg-sunken border border-rule-raised/30 font-mono text-micro text-ink-subtle">
            <IconClockHour4 size={12} stroke={ICON_STROKE} className="text-ink-muted" />
            <Elapsed since={openedAt} />
          </div>

          {pouredCount > 0 ? (
            <Badge
              tone="poured"
              className="!rounded-dot px-8 py-1 font-mono text-micro shadow-[0_0_10px_color-mix(in_oklab,var(--color-poured)_20%,transparent)]"
            >
              <Dot tone="poured" />
              <span>{pouredCount} poured</span>
            </Badge>
          ) : null}
        </div>
      </div>

      {/* ── Middle Row: Guest Covers & Overlapping Seat Chip Stack ──── */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between font-mono text-micro text-ink-subtle">
          <span>Guest covers</span>
          {seats.length > 0 ? (
            <span>
              {seats.length} seated{settledCount > 0 ? ` · ${settledCount} settled` : ''}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-8 min-h-[32px]">
          {showSeats && seats.length > 0 ? (
            <SeatChipStack
              seats={seats.map((s) => ({
                seatNo: s.seatNo,
                settled: s.status === 'settled',
              }))}
              max={8}
              size="dense"
              overlapping
            />
          ) : (
            <span className="font-mono text-micro text-ink-subtle">
              Single bill · No individual seats assigned
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Grand Total Spend & Tactile Open Action ──────── */}
      <div className="flex items-center justify-between pt-12 border-t border-rule-raised/20 gap-12">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-micro uppercase tracking-wider text-ink-subtle">
            Tab spend
          </span>
          <Money value={total} size="num-lg" tone="default" />
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={IconChevronRight}
          iconPosition="end"
          onClick={onOpen}
          className="!rounded-dot px-14 text-body-sm font-medium border border-rule-raised/40 hover:border-accent/40 group-hover:text-accent transition-all shadow-sm"
        >
          Open tab
        </Button>
      </div>
    </div>
  );
}

