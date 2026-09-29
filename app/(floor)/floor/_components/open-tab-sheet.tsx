'use client';

import { notify } from '@bliss/ui/components/notices';
import type { ServiceTable } from '@bliss/shared/domain';
import { placeLabel, tabLabel, walkUpLabel } from '@bliss/shared/trade';
import { Button } from '@bliss/ui/components/button';
import { Stepper, TextField } from '@bliss/ui/components/fields';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ChoiceChip, Sheet, SheetCancel, SheetIcon, SheetPanel, SheetSection } from '@bliss/ui/components/floor/sheet';
import { IconTablePlus } from '@tabler/icons-react';
import { cx } from '@bliss/ui/lib/cx';
import { seatBgClass } from '@bliss/ui/lib/seat';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { openTab } from '@/lib/pos/mutations';
import { posDb } from '@/lib/pos/db';
import { syncNow } from '@/lib/pos/sync';
import { useNextWalkUpNo, usePlaceName } from '@/lib/pos/queries';

/** A place's name for people: Table 4, Stool 2, or Walk up. docs/14 section 2. */
export function tableLabel(table: ServiceTable | null): string {
  return table ? placeLabel(table.label) : 'Walk up';
}

const MIN_GUESTS = 1;
const MAX_GUESTS = 20;
/** Above this, the ring reads as a crowd rather than individual seats — a
 *  count is clearer than trying to fit 20 dots around one table. */
const MAX_SEAT_DOTS = 12;
/** The counts a host reaches for most, one tap each. */
const QUICK = [1, 2, 4, 6] as const;

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
    () => (guests <= MAX_SEAT_DOTS ? seatPositions(guests, 48) : []),
    [guests],
  );

  const caption =
    guests === 1
      ? 'Seated at the counter, no seat numbers needed'
      : guests <= MAX_SEAT_DOTS
        ? `${guests} seats arranged around the table`
        : `${guests} guests · seating assigned at the table`;

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-wrap gap-8" role="group" aria-label="Quick picks">
        {QUICK.map((n) => (
          <ChoiceChip key={n} on={guests === n} onClick={() => onChange(n)}>
            {n === 1 ? '1 guest' : `${n} guests`}
          </ChoiceChip>
        ))}
      </div>
      {/* The table on the left, the count and what it means on the right: justified apart, with room. */}
      <SheetPanel className="px-24 py-20">
        <div className="flex items-center justify-between gap-32">
          <div className="relative size-seat-ring shrink-0" aria-hidden="true">
            <div className="absolute inset-12 rounded-dot border border-rule-raised/50 bg-gradient-to-br from-glass to-transparent shadow-well" />
            {guests === 1 ? (
              <div className={cx('absolute left-1/2 top-1/2 flex size-seat-dot -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-dot text-label font-medium text-seat-ink ring-2 ring-sunken', seatBgClass(1))}>1</div>
            ) : (
              seats.map((pos, i) => (
                <div
                  key={i}
                  className={cx('absolute flex size-seat-dot -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-dot text-label font-medium text-seat-ink ring-2 ring-sunken', seatBgClass(i + 1))}
                  style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)` }}
                >
                  {i + 1}
                </div>
              ))
            )}
          </div>
          <div className="flex min-w-0 flex-col items-end gap-12 text-right">
            <Stepper value={guests} min={MIN_GUESTS} max={MAX_GUESTS} onChange={onChange} label="Guests" size="lg" decreaseLabel="One fewer guest" increaseLabel="One more guest" />
            <p className="max-w-card-preview text-body-sm text-ink-muted" aria-live="polite">
              {caption}
            </p>
          </div>
        </div>
      </SheetPanel>
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
  const placeName = usePlaceName();
  const nextWalkUp = useNextWalkUpNo();
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
    if (!zoneId) {
      // Never a button that does nothing: say why, and fetch the venue again. The server puts a zone
      // back when a venue has none, so the next tap works.
      setError('This station has not received the venue layout yet. It is fetching it now; try again in a moment.');
      void syncNow().catch(() => undefined);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const tabId = await openTab({ tableId: table?.id ?? null, zoneId, guestCount: guests, name: name || null });
      const opened = table ? null : await posDb().tabs.get(tabId);
      onClose();
      notify({
        key: `open:${tabId}`,
        title: `${table ? placeName(table) : tabLabel({ name: opened?.name, walkUpNo: opened?.walkUpNo })} is open`,
        body: guests === 1 ? 'One guest. Add from the grid, then fire.' : `${guests} seats. Pick a seat, add from the grid, then fire.`,
      });
      router.push(`/floor/tabs/${tabId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The tab did not open. Nothing was saved.');
    } finally {
      setPending(false);
    }
  };

  const title = table ? `Open a tab on ${placeName(table)}` : `Open ${walkUpLabel(nextWalkUp)}`;

  const footerActions = (
    <>
      <SheetCancel onClick={onClose} />
      <div className="flex-1" />
      <Button
        variant="primary"
        size="lg"
        loading={pending}
        onClick={() => void submit()}
        shape="pill"
        className="px-32"
      >
        {guests === 1 ? 'Open tab' : `Open tab · ${guests} ${seatWord}`}
      </Button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} width="md" footer={footerActions} leading={<SheetIcon icon={IconTablePlus} />}>
      <div className="flex flex-col gap-32">
        <SheetSection label="Guests" aside={guests === 1 ? 'One seat' : `${guests} seats`}>
          <GuestSeatSelector guests={guests} onChange={setGuests} />
        </SheetSection>

        <TextField label="Tab name" helper={table ? 'Optional. It shows on the tab and the ticket.' : `Optional. Without one, the tab goes by ${walkUpLabel(nextWalkUp)}.`} placeholder="A birthday, the corner booth" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />

        {/* Error */}
        {error ? (
          <InlineNotice tone="stop">{error}</InlineNotice>
        ) : null}
      </div>
    </Sheet>
  );
}