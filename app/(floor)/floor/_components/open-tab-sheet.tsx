'use client';

import { notify } from '@bliss/ui/components/notices';
import type { ServiceTable } from '@bliss/shared/domain';
import { placeLabel } from '@bliss/shared/trade';
import { Button } from '@bliss/ui/components/button';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { cx } from '@bliss/ui/lib/cx';
import { seatBgClass } from '@bliss/ui/lib/seat';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { openTab } from '@/lib/pos/mutations';

/** A place's name for people: Table 4, Stool 2, or Walk up. docs/14 section 2. */
export function tableLabel(table: ServiceTable | null): string {
  return table ? placeLabel(table.label) : 'Walk up';
}

const MIN_GUESTS = 1;
const MAX_GUESTS = 20;
/** Above this, the ring reads as a crowd rather than individual seats — a
 *  count is clearer than trying to fit 20 dots around one table. */
const MAX_SEAT_DOTS = 12;

/**
 * Seat positions evenly spaced around a table, one arrangement per guest
 * count — not a generic ring of dots, but the shape a host would actually
 * see looking down at the table. 2 sits people across from each other; 3
 * makes a triangle; from 4 up, seats distribute evenly starting from the
 * top so the arrangement stays visually stable as the count grows or
 * shrinks by one.
 */
function seatPositions(count: number, radius: number): { x: number; y: number }[] {
  if (count === 2) {
    return [
      { x: -radius, y: 0 },
      { x: radius, y: 0 },
    ];
  }
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

/**
 * The guest-count control and its seat preview, as one unit. Previously a
 * stepper and a "seats" card sat side by side as two unrelated surfaces for
 * one decision; here the table is the control's own face, so changing the
 * count visibly rearranges seats around it rather than updating a separate
 * chip list elsewhere on the sheet.
 */
function GuestSeatSelector({
  guests,
  onChange,
}: {
  guests: number;
  onChange: (next: number) => void;
}) {
  const seats = useMemo(
    () => (guests <= MAX_SEAT_DOTS ? seatPositions(guests, 64) : []),
    [guests],
  );

  const caption =
    guests === 1
      ? 'Seated at the counter, no seat numbers needed'
      : guests <= MAX_SEAT_DOTS
        ? `${guests} seats arranged around the table`
        : `${guests} guests · seating assigned at the table`;

  return (
    <div className="flex flex-col items-start gap-12 compact:flex-row compact:items-center compact:gap-16">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="inline-flex w-max items-center gap-12 rounded-full border border-rule-raised/40 bg-sunken/40 p-8 ">
          <button
            type="button"
            onClick={() => onChange(Math.max(MIN_GUESTS, guests - 1))}
            disabled={guests <= MIN_GUESTS}
            aria-label="One fewer guest"
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-glass text-[32px] font-regular text-ink transition-colors hover:bg-glass-strong disabled:opacity-30 disabled:hover:bg-glass disabled:hover:ring-rule-raised/30 press-feedback"
          >
            −
          </button>
          <span className="min-w-[48px] text-center text-[40px] font-medium leading-none text-ink tabular-nums">
            {guests}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(MAX_GUESTS, guests + 1))}
            disabled={guests >= MAX_GUESTS}
            aria-label="One more guest"
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-glass text-[32px] font-regular text-ink transition-colors hover:bg-glass-strong disabled:opacity-30 disabled:hover:bg-glass disabled:hover:ring-rule-raised/30 press-feedback"
          >
            +
          </button>
        </div>
        <p className="text-body-sm text-ink-subtle px-4" aria-live="polite">
          {caption}
        </p>
      </div>

      <div className="relative mx-auto h-[160px] w-[160px] shrink-0" aria-hidden="true">
        <div className="absolute inset-[16px] rounded-full border border-rule-raised/50 bg-gradient-to-br from-glass to-transparent shadow-[inset_0_1px_8px_rgba(0,0,0,0.4)]" />
        {guests === 1 ? (
          <div className={cx("absolute left-1/2 top-1/2 flex h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-medium text-seat-ink shadow-[0_0_0_3px_var(--color-sunken)]", seatBgClass(1))}>
            1
          </div>
        ) : (
          seats.map((pos, i) => (
            <div
              key={i}
              className={cx("absolute flex h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-medium text-seat-ink shadow-[0_0_0_3px_var(--color-sunken)]", seatBgClass(i + 1))}
              style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)` }}
            >
              {i + 1}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Open a tab against a table. docs/10 F4, docs/13 §4 Layer 7.
 *
 * eyebrow: zone context (when table has one) → title: "Open a tab on Table 4" or walk-up.
 * The guest count and its seat preview are one control (GuestSeatSelector),
 * not a stepper next to a separate seats card — changing the count visibly
 * rearranges seats around the table face.
 * Errors are role="alert" so they are announced immediately.
 * Opening offline: works silently — the tab is local first.
 */
export function OpenTabSheet({
  open,
  onClose,
  table,
  walkUpZoneId,
}: {
  open: boolean;
  onClose: () => void;
  table: ServiceTable | null;
  walkUpZoneId: string | null;
}) {
  const router = useRouter();
  const [guests, setGuests] = useState(table?.seats ?? 2);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGuests(Math.max(1, table?.seats ?? 2));
      setName('');
      setError(null);
    }
  }, [open, table]);

  const zoneId = table?.zoneId ?? walkUpZoneId;
  const seatWord = guests === 1 ? 'seat' : 'seats';

  const submit = async () => {
    if (!zoneId) return;
    setPending(true);
    try {
      const tabId = await openTab({ tableId: table?.id ?? null, zoneId, guestCount: guests, name: name || null });
      onClose();
      notify({
        key: `open:${tabId}`,
        title: `${table ? tableLabel(table) : name || 'Walk-up tab'} is open`,
        body: guests === 1 ? 'One guest. Add from the grid, then fire.' : `${guests} seats. Pick a seat, add from the grid, then fire.`,
      });
      router.push(`/floor/tabs/${tabId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The tab did not open. Nothing was saved.');
    } finally {
      setPending(false);
    }
  };

  const title = table ? `Open a tab on ${tableLabel(table)}` : 'Open a walk-up tab';

  const footerActions = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="-ml-8 flex h-control-lg items-center rounded-full px-8 text-body font-medium text-ink-muted transition-colors hover:text-ink press-feedback"
      >
        Cancel
      </button>
      <div className="flex-1" />
      <Button
        variant="primary"
        size="lg"
        loading={pending}
        onClick={() => void submit()}
        className="!rounded-full !bg-ink !text-page px-32 transition-all hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
      >
        {guests === 1 ? 'Open tab' : `Open tab · ${guests} ${seatWord}`}
      </Button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} width="md" footer={footerActions}>
      <div className="flex flex-col gap-40">
        {/* Guest count */}
        <div className="flex flex-col gap-12">
          <span className="px-4 text-body font-medium text-ink" id="guest-count-label">
            Number of guests
          </span>
          <div role="group" aria-labelledby="guest-count-label">
            <GuestSeatSelector guests={guests} onChange={setGuests} />
          </div>
        </div>

        {/* Tab name */}
        <div className="flex flex-col gap-12">
          <label htmlFor="tab-name-input" className="px-4 text-body font-medium text-ink">
            Tab name (optional)
          </label>
          <div className="flex h-[56px] items-center border-b border-rule-raised/50 px-4 transition-colors focus-within:border-glass-edge-hover">
            <input
              id="tab-name-input"
              type="text"
              placeholder="Birthday, Kevin's table..."
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="h-full w-full bg-transparent text-body font-medium text-ink outline-none placeholder:font-regular placeholder:text-ink-disabled"
            />
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-lg border border-stop/20 bg-stop/10 px-20 py-16">
            <p role="alert" className="text-center text-body font-medium text-stop">
              {error}
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}