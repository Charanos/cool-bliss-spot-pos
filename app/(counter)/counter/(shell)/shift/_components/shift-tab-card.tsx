'use client';

import type { Cents } from '@bliss/shared/money';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { SeatChipStack } from '@bliss/ui/components/working';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconChevronRight, IconClockHour4 } from '@tabler/icons-react';

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
 * A table in this waiter's name: what it is, who is seated, how long it has been open and what it
 * has run up. The card itself opens the tab, so the whole surface is the target on a phone; the
 * checkbox, where handover is selecting, keeps its own.
 */
export function ShiftTabCard({ label, zoneName, seats, showSeats, openedAt, total, pouredCount = 0, selected, onSelect, onOpen, className }: ShiftTabCardProps) {
  const settledCount = seats.filter((s) => s.status === 'settled').length;

  return (
    <div
      className={cx(
        'relative flex flex-col gap-12 overflow-hidden rounded-md border bg-raised/70 p-12 backdrop-blur-glass pad:rounded-lg pad:p-16',
        selected ? 'border-accent bg-accent/[0.06]' : 'border-rule-raised/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-center gap-8">
          {onSelect ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={Boolean(selected)}
              aria-label={`Hand over ${label}`}
              onClick={onSelect}
              className={cx(
                'flex size-24 shrink-0 items-center justify-center rounded-sm press-feedback',
                selected ? 'bg-accent text-accent-ink' : 'bg-control text-transparent hover:text-ink-subtle',
              )}
            >
              <IconCheck size={14} stroke={ICON_STROKE} aria-hidden="true" />
            </button>
          ) : null}

          <button type="button" onClick={onOpen} className="min-w-0 truncate text-left text-title font-medium text-ink press-feedback hover:text-accent">
            {label}
          </button>

          {zoneName ? (
            <Badge tone="neutral" className="hidden shrink-0 compact:inline-flex">
              {zoneName}
            </Badge>
          ) : null}
        </div>

        <span className="flex shrink-0 items-center gap-4 rounded-sm bg-sunken px-8 py-2 font-mono text-micro text-ink-subtle">
          <IconClockHour4 size={12} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-muted" />
          <Elapsed since={openedAt} />
        </span>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-8 font-mono text-micro text-ink-subtle">
          <span>Guest covers</span>
          {seats.length > 0 ? (
            <span>
              {seats.length} seated
              {settledCount > 0 ? ` · ${settledCount} settled` : ''}
              {pouredCount > 0 ? ` · ${pouredCount} poured` : ''}
            </span>
          ) : null}
        </div>
        {showSeats && seats.length > 0 ? (
          <SeatChipStack seats={seats.map((s) => ({ seatNo: s.seatNo, settled: s.status === 'settled' }))} max={8} size="dense" overlapping />
        ) : (
          <span className="font-mono text-micro text-ink-subtle">One bill, no seats named</span>
        )}
      </div>

      <div className="flex items-end justify-between gap-12 border-t border-rule-raised/20 pt-12">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="caps text-ink-subtle">Tab spend</span>
          <Money value={total} size="num-lg" />
        </span>

        <Button variant="secondary" size="md" icon={IconChevronRight} iconPosition="end" onClick={onOpen} className="shrink-0">
          Open tab
        </Button>
      </div>
    </div>
  );
}
