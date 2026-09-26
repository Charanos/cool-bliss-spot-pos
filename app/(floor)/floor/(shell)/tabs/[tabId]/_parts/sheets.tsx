'use client';

import type { Modifier, ModifierGroup, OrderLine, ServiceTable } from '@bliss/shared/domain';
import { formatKes } from '@bliss/shared/money';
import { tryResolvePrice } from '@bliss/shared/pricing';
import { SEAT_LABEL_MAX, displaySeatLabel } from '@bliss/shared/seats';
import { ActionList } from '@bliss/ui/components/action-list';
import { Button } from '@bliss/ui/components/button';
import { Stepper } from '@bliss/ui/components/fields';
import { FloorDialog, Sheet } from '@bliss/ui/components/floor/sheet';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { SeatChip, SeatChipButton } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { InviteButton } from '@bliss/ui/components/working';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowsExchange, IconBan, IconNote, IconTag, IconTrash, IconX } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { posDb } from '@/lib/pos/db';
import type { ModifierChoice, SeatSelection } from '@/lib/pos/mutations';
import { usePricingIndex } from '@/lib/pos/pricing';
import type { TabDetail } from '@/lib/pos/queries';
import { requestApproval } from '@/lib/pos/session';
import { tableLabel } from '../../../../_components/open-tab-sheet';

export function seatPhrase(detail: TabDetail, seat: SeatSelection): string {
  if (!detail.showControls) return 'the tab';
  if (seat === 'shared') return 'Shared';
  const s = detail.seats.find((x) => x.id === seat);
  return s ? `Seat ${s.seatNo}${s.label ? ` · ${displaySeatLabel(s.label)}` : ''}` : 'the tab';
}

/* ----------------------------------------------------------- modifier sheet */

export function ModifierSheet({
  variantId,
  detail,
  timezone,
  onClose,
  onAdd,
}: {
  variantId: string | null;
  detail: TabDetail;
  timezone: string;
  onClose: () => void;
  onAdd: (input: { variantId: string; qty: number; modifiers: ModifierChoice[]; note: string | null }) => Promise<void>;
}) {
  const index = usePricingIndex();
  const data = useLiveQuery(async () => {
    if (!variantId) return null;
    const db = posDb();
    const variant = await db.variants.get(variantId);
    const links = await db.variantModifierGroups.where('productVariantId').equals(variantId).sortBy('sortOrder');
    const groups: { group: ModifierGroup; modifiers: Modifier[] }[] = [];
    for (const link of links) {
      const group = await db.modifierGroups.get(link.modifierGroupId);
      if (!group || group.status !== 'active' || link.removed) continue;
      const modifiers = (await db.modifiers.where('modifierGroupId').equals(group.id).toArray()).filter((m) => m.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
      groups.push({ group, modifiers });
    }
    return { variant, groups };
  }, [variantId]);

  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setQty(1);
    setPicked({});
    setNote('');
  }, [variantId]);

  const choices: ModifierChoice[] = useMemo(() => {
    if (!data) return [];
    return data.groups.flatMap(({ modifiers }) =>
      modifiers.filter((m) => Object.values(picked).flat().includes(m.id)).map((m) => ({ modifierId: m.id, name: m.name, priceDeltaCents: m.priceDeltaCents, linkedVariantId: m.linkedVariantId })),
    );
  }, [data, picked]);

  const price =
    variantId && index
      ? tryResolvePrice(index, { variantId, qty, at: Date.now(), timeZone: timezone, modifiers: choices.map((c) => ({ name: c.name, priceDeltaCents: c.priceDeltaCents, qty: 1 })) })
      : null;

  const toggle = (group: ModifierGroup, modifierId: string) => {
    setPicked((current) => {
      const selected = current[group.id] ?? [];
      if (selected.includes(modifierId)) return { ...current, [group.id]: selected.filter((id) => id !== modifierId) };
      const next = group.maxSelect <= 1 ? [modifierId] : [...selected, modifierId].slice(-group.maxSelect);
      return { ...current, [group.id]: next };
    });
  };

  const target = seatPhrase(detail, detail.selected);
  const hasModifiers = Boolean(data?.groups && data.groups.length > 0);

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
        onClick={async () => {
          if (!variantId) return;
          setPending(true);
          try {
            await onAdd({ variantId, qty, modifiers: choices, note: note.trim() || null });
          } finally {
            setPending(false);
          }
        }}
        className="!rounded-full !bg-accent !text-accent-ink px-32 transition-all hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(0,0,0,0.2)] font-medium"
      >
        {price ? `Add to ${target} · ${formatKes(price.lineTotalCents, { decimals: 'whole' })}` : `Add to ${target}`}
      </Button>
    </>
  );

  return (
    <Sheet
      open={Boolean(variantId)}
      onClose={onClose}
      title={data?.variant?.name ?? 'Add a serve'}
      description={price ? `${formatKes(price.unitPriceCents)} each` : undefined}
      width={hasModifiers ? 'md' : 'sm'}
      footer={footerActions}
    >
      <div className="flex flex-col gap-24 py-4">
        {/* Modifier groups */}
        {data?.groups.map(({ group, modifiers }) => (
          <fieldset key={group.id} className="flex flex-col gap-8">
            <div className="flex items-center justify-between px-2">
              <legend className="font-mono text-[11px] font-medium uppercase text-ink-subtle">
                {group.name}
              </legend>
              <span className="font-mono text-[10px] text-ink-disabled uppercase">
                {group.maxSelect > 1 ? `choose up to ${group.maxSelect}` : 'choose one'}
              </span>
            </div>
            <div className="flex flex-wrap gap-8" role="group">
              {modifiers.map((m) => {
                const on = (picked[group.id] ?? []).includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(group, m.id)}
                    className={cx(
                      'inline-flex min-h-[44px] items-center gap-8 rounded-sm px-16 text-body transition-all press-feedback',
                      on
                        ? 'bg-control-pressed text-ink font-medium ring-1 ring-rule-raised/50'
                        : 'bg-control text-ink-muted ring-1 ring-transparent hover:bg-control-hover hover:text-ink',
                    )}
                  >
                    <span>{m.name}</span>
                    {m.priceDeltaCents > 0n ? (
                      <span className={cx('font-mono tabular text-num-sm', on ? 'text-ink' : 'text-ink-subtle')}>
                        +{formatKes(m.priceDeltaCents, { decimals: 'whole' }).replace('KES ', '')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {/* Quantity in a sunken card */}
        <div className="flex items-center justify-between rounded-lg bg-control px-16 py-12 ring-1 ring-rule-raised/20">
          <div className="flex flex-col gap-2">
            <span className="text-body font-medium text-ink">Quantity</span>
            <span className="text-body-sm text-ink-subtle">
              {price ? `${formatKes(price.unitPriceCents)} each` : 'Number of serves'}
            </span>
          </div>
          <Stepper
            value={qty}
            min={1}
            max={24}
            onChange={setQty}
            label="Quantity"
            size="lg"
            decreaseLabel="One fewer"
            increaseLabel="One more"
          />
        </div>

        {/* Note field with sunken container */}
        <div className="flex flex-col gap-8">
          <label htmlFor="modifier-note-input" className="px-2 text-body font-medium text-ink">
            Note for the bar (optional)
          </label>
          <div className="flex h-[52px] items-center rounded-lg bg-control px-16 ring-1 ring-rule-raised/20 transition-colors focus-within:ring-rule-raised/50">
            <input
              id="modifier-note-input"
              type="text"
              placeholder="No ice, with the food..."
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              className="h-full w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-disabled"
            />
            {note ? (
              <button
                type="button"
                onClick={() => setNote('')}
                className="ml-8 text-ink-subtle hover:text-ink"
                aria-label="Clear note"
              >
                <IconX size={16} stroke={1.75} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ----------------------------------------------------------- finished tile */

export function FinishedSheet({ variantId, onClose }: { variantId: string | null; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    if (!variantId) return null;
    const db = posDb();
    const [variant, entry] = await Promise.all([db.variants.get(variantId), db.availability.get(variantId)]);
    return { variant, entry };
  }, [variantId]);
  const held = data?.entry?.reason === 'hold';
  const name = data?.variant?.name ?? 'This item';

  const footerActions = (
    <Button
      variant="secondary"
      size="lg"
      onClick={onClose}
      className="w-full !rounded-full font-medium"
    >
      Back to the menu
    </Button>
  );

  return (
    <Sheet
      open={Boolean(variantId)}
      onClose={onClose}
      title={name}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-4">
        <div className="flex items-center gap-12 rounded-lg bg-control px-16 py-12 ring-1 ring-rule-raised/20">
          <StatusChip status={held ? 'on_hold' : 'finished'} />
          <span className="text-body font-medium text-ink">
            {held ? 'Currently on hold' : 'Item is finished'}
          </span>
        </div>
        <p className="text-body text-ink px-2">
          {held
            ? `${name} is on hold. A supervisor can take it off hold in the Console when the bar is ready.`
            : `${name} is finished. A supervisor can put it back if the bar has more.`}
        </p>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------- seat menu */

export function SeatMenuSheet({
  seatId,
  detail,
  onClose,
  onLabel,
  onRemove,
}: {
  seatId: string | null;
  detail: TabDetail;
  onClose: () => void;
  onLabel: (seatId: string) => void;
  onRemove: (seatId: string) => Promise<void>;
}) {
  const seat = detail.seats.find((s) => s.id === seatId);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [seatId]);

  if (!seat) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const footerActions = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-control-lg items-center rounded-full px-16 text-body font-medium text-ink-muted transition-colors hover:text-ink press-feedback"
    >
      Close
    </button>
  );

  return (
    <Sheet
      open={Boolean(seatId)}
      onClose={onClose}
      title={`Seat ${seat.seatNo}${seat.label ? ` · ${seat.label}` : ''}`}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-2">
        <div className="flex items-center justify-between rounded-lg bg-control px-16 py-12 ring-1 ring-rule-raised/20">
          <div className="flex items-center gap-12">
            <SeatChip seat={seat.seatNo} size="row" label={seat.label} />
            <span className="text-body font-medium text-ink">
              {seat.label ? displaySeatLabel(seat.label) : `Seat ${seat.seatNo}`}
            </span>
          </div>
          <div className="text-right">
            <span className="block font-mono text-[10px] uppercase text-ink-subtle">Seat Total</span>
            <Money value={seat.total} size="num" tone="default" />
          </div>
        </div>

        <ActionList
          items={[
            { key: 'label', label: seat.label ? 'Change the label' : 'Label this seat', icon: IconTag, onSelect: () => onLabel(seat.id) },
            {
              key: 'remove',
              label: 'Remove this seat',
              icon: IconTrash,
              destructive: true,
              onSelect: () => {
                onRemove(seat.id).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The seat stayed on the tab.'));
              },
            },
          ]}
        />

        {error ? (
          <div className="rounded-lg border border-stop/20 bg-stop/10 px-16 py-12">
            <p role="alert" className="text-body font-medium text-stop">
              {error}
            </p>
          </div>
        ) : null}

        <p className="px-4 text-body-sm text-ink-subtle">
          Settling a seat happens at the counter. This seat dims here when it is settled.
        </p>
      </div>
    </Sheet>
  );
}

/* ----------------------------------------------------------- label seat */

export function LabelSeatSheet({
  seatId,
  detail,
  onClose,
  onSave,
}: {
  seatId: string | null;
  detail: TabDetail;
  onClose: () => void;
  onSave: (seatId: string, label: string) => Promise<void>;
}) {
  const seat = detail.seats.find((s) => s.id === seatId);
  const [value, setValue] = useState('');
  useEffect(() => setValue(seat?.label ?? ''), [seat?.id, seat?.label]);

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
        type="submit"
        form="label-seat-form"
        variant="primary"
        size="lg"
        className="!rounded-full px-32 font-medium"
      >
        {value.trim() ? 'Save label' : 'Clear label'}
      </Button>
    </>
  );

  return (
    <Sheet
      open={Boolean(seatId && seat)}
      onClose={onClose}
      title={`Label Seat ${seat?.seatNo ?? ''}`}
      width="sm"
      footer={footerActions}
    >
      <form
        id="label-seat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (seatId) void onSave(seatId, value.trim()).then(onClose);
        }}
        className="flex flex-col gap-12 py-4"
      >
        <div className="flex items-center justify-between px-2">
          <label htmlFor="seat-label-input" className="text-body font-medium text-ink">
            Seat label
          </label>
          <span className="font-mono text-num-sm text-ink-subtle">
            {value.length}/{SEAT_LABEL_MAX}
          </span>
        </div>
        <div className="flex h-[52px] items-center rounded-lg bg-control px-16 ring-1 ring-rule-raised/20 transition-colors focus-within:ring-rule-raised/50">
          <input
            id="seat-label-input"
            data-autofocus=""
            type="text"
            placeholder="Cap, birthday, boss..."
            value={value}
            maxLength={SEAT_LABEL_MAX}
            onChange={(e) => setValue(e.target.value)}
            className="h-full w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-disabled"
          />
          {value ? (
            <button
              type="button"
              onClick={() => setValue('')}
              className="ml-8 text-ink-subtle hover:text-ink"
              aria-label="Clear label"
            >
              <IconX size={16} stroke={1.75} />
            </button>
          ) : null}
        </div>
        <p className="px-2 text-body-sm text-ink-subtle">
          Only you and the bar see this on the floor.
        </p>
      </form>
    </Sheet>
  );
}

/* -------------------------------------------------------------- line menu */

export function LineSheet({
  line,
  name,
  state,
  detail,
  onClose,
  onMove,
  onNote,
  onVoid,
  onQty,
}: {
  line: OrderLine | null;
  name: string;
  state: string;
  detail: TabDetail;
  onClose: () => void;
  onMove: () => void;
  onNote: () => void;
  onVoid: () => void;
  onQty: (qty: number) => void;
}) {
  const draft = state === 'draft';
  const poured = state === 'poured';
  const seat = line ? detail.seats.find((s) => s.id === line.tabSeatId) : undefined;

  const footerActions = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-control-lg items-center rounded-full px-16 text-body font-medium text-ink-muted transition-colors hover:text-ink press-feedback"
    >
      Close
    </button>
  );

  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `${line.qty} × ${name}` : ''}
      description={line ? `${seat ? `Seat ${seat.seatNo}` : detail.showControls ? 'Shared' : detail.label} · ${formatKes(line.lineTotalCents)}` : undefined}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-2">
        {line && draft ? (
          <div className="flex items-center justify-between rounded-lg bg-control px-16 py-12 ring-1 ring-rule-raised/20">
            <div className="flex flex-col gap-2">
              <span className="text-body font-medium text-ink">Quantity</span>
              <span className="text-body-sm text-ink-subtle">Not fired yet</span>
            </div>
            <div className="inline-flex h-[40px] shrink-0 items-center rounded-full bg-control-hover select-none overflow-hidden">
              <button
                type="button"
                aria-label={line.qty === 1 ? 'Clear the line' : 'One fewer'}
                onClick={() => onQty(line.qty - 1)}
                className="flex h-full w-[40px] shrink-0 items-center justify-center text-ink font-regular transition-colors hover:bg-glass-hover active:bg-glass-strong press-feedback"
              >
                {line.qty === 1 ? <IconX size={18} stroke={1.75} className="text-stop" /> : '−'}
              </button>
              <span className="min-w-[40px] text-center font-mono tabular text-num-lg font-medium text-ink">
                {line.qty}
              </span>
              <button
                type="button"
                aria-label="One more"
                onClick={() => onQty(line.qty + 1)}
                className="flex h-full w-[40px] shrink-0 items-center justify-center text-ink font-regular transition-colors hover:bg-glass-hover active:bg-glass-strong press-feedback"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        <ActionList
          items={[
            ...(detail.showControls ? [{ key: 'move', label: 'Move to another seat', icon: IconArrowsExchange, onSelect: onMove }] : []),
            ...(poured ? [] : [{ key: 'note', label: line?.note ? 'Change the note' : 'Add a note', icon: IconNote, onSelect: onNote }]),
            draft
              ? { key: 'clear', label: 'Clear the line', icon: IconX, destructive: true, onSelect: () => onQty(0) }
              : { key: 'void', label: 'Void the line', icon: IconBan, destructive: true, onSelect: onVoid, hint: poured ? 'Needs a supervisor' : undefined },
          ]}
        />
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------ move line */

export function MoveLineSheet({
  line,
  name,
  detail,
  onClose,
  onMove,
}: {
  line: OrderLine | null;
  name: string;
  detail: TabDetail;
  onClose: () => void;
  onMove: (to: SeatSelection) => void;
}) {
  const current: SeatSelection = line?.tabSeatId ?? 'shared';

  const footerActions = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-control-lg items-center rounded-full px-16 text-body font-medium text-ink-muted transition-colors hover:text-ink press-feedback"
    >
      Cancel
    </button>
  );

  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `Move ${line.qty} × ${name} to another seat` : ''}
      width="md"
      footer={footerActions}
    >
      <div className="py-4">
        <div className="rounded-lg bg-control p-16 ring-1 ring-rule-raised/20">
          <div className="flex flex-wrap gap-16 justify-center" role="group" aria-label="Seats">
            {[
              ...detail.activeSeats.map((s) => ({ key: s.id as SeatSelection, seat: s.seatNo as number | 'shared', label: s.label })),
              { key: 'shared' as SeatSelection, seat: 'shared' as const, label: null },
            ].map((option) => {
              const isCurrent = option.key === current;
              return (
                <div key={option.key} className="flex w-[68px] flex-col items-center gap-6">
                  <SeatChipButton
                    seat={option.seat}
                    size="picker"
                    selected={false}
                    disabled={isCurrent}
                    label={option.label}
                    onClick={() => {
                      if (!isCurrent) onMove(option.key);
                    }}
                    className={cx(isCurrent && 'opacity-40')}
                  />
                  <span className="max-w-full truncate font-mono text-[11px] text-ink-subtle">
                    {isCurrent ? 'Current' : option.seat === 'shared' ? 'Shared' : (displaySeatLabel(option.label) ?? `Seat ${option.seat}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------ note sheet */

export function NoteSheet({
  line,
  name,
  onClose,
  onSave,
}: {
  line: OrderLine | null;
  name: string;
  onClose: () => void;
  onSave: (note: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  useEffect(() => setValue(line?.note ?? ''), [line?.id, line?.note]);

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
        type="submit"
        form="line-note-form"
        variant="primary"
        size="lg"
        className="!rounded-full px-32 font-medium"
      >
        {value.trim() ? 'Save note' : 'Clear note'}
      </Button>
    </>
  );

  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `Note for ${line.qty} × ${name}` : ''}
      width="sm"
      footer={footerActions}
    >
      <form
        id="line-note-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(value.trim() || null).then(onClose);
        }}
        className="flex flex-col gap-12 py-4"
      >
        <div className="flex items-center justify-between px-2">
          <label htmlFor="line-note-input" className="text-body font-medium text-ink">
            Note for the ticket
          </label>
          <span className="font-mono text-num-sm text-ink-subtle">
            {value.length}/140
          </span>
        </div>
        <div className="flex h-[52px] items-center rounded-lg bg-control px-16 ring-1 ring-rule-raised/20 transition-colors focus-within:ring-rule-raised/50">
          <input
            id="line-note-input"
            data-autofocus=""
            type="text"
            placeholder="No ice, with the food..."
            value={value}
            maxLength={140}
            onChange={(e) => setValue(e.target.value)}
            className="h-full w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-disabled"
          />
          {value ? (
            <button
              type="button"
              onClick={() => setValue('')}
              className="ml-8 text-ink-subtle hover:text-ink"
              aria-label="Clear note"
            >
              <IconX size={16} stroke={1.75} />
            </button>
          ) : null}
        </div>
        <p className="px-2 text-body-sm text-ink-subtle">
          The bar and kitchen see this printed on the ticket.
        </p>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------- void */

export function VoidDialog({
  line,
  name,
  detail,
  poured,
  ranOut,
  onClose,
  onVoid,
}: {
  line: OrderLine | null;
  name: string;
  detail: TabDetail;
  poured: boolean;
  ranOut: boolean;
  onClose: () => void;
  onVoid: (reason: string, approvalToken: string | null) => Promise<void>;
}) {
  const seat = line ? detail.seats.find((s) => s.id === line.tabSeatId) : undefined;
  const from = seat && detail.showControls ? ` from Seat ${seat.seatNo}` : line && !line.tabSeatId && detail.showControls ? ' from Shared' : '';
  const tabRef = detail.tab.tabNumber ? `tab ${detail.tab.tabNumber}` : detail.label.toLowerCase().startsWith('table') ? detail.label : `the ${detail.label} tab`;
  return (
    <FloorDialog
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `Void ${line.qty} × ${name}${from}?` : ''}
      description={line ? `This removes ${formatKes(line.lineTotalCents)} from ${tabRef}. It cannot be undone.` : undefined}
      width="md"
    >
      {line ? (
        <ReasonForm
          key={line.id}
          focus="chip"
          quickReasons={['Wrong item', 'Customer changed mind', 'Ran out']}
          initialReason={ranOut ? 'Ran out while the tablet was offline' : ''}
          confirmLabel="Void the line"
          approval={poured ? { label: 'Approve with your PIN' } : null}
          onCancel={onClose}
          onConfirm={async ({ reason, approverPin }) => {
            let token: string | null = null;
            if (poured) {
              const approval = await requestApproval(approverPin ?? '', 'void.approve');
              if (!approval.ok) throw new Error(approval.message);
              token = approval.token;
            }
            await onVoid(reason, token);
            onClose();
          }}
        />
      ) : null}
    </FloorDialog>
  );
}

/* --------------------------------------------------------------- move tab */

export function MoveTabSheet({
  open,
  detail,
  freeTables,
  onClose,
  onMove,
}: {
  open: boolean;
  detail: TabDetail;
  freeTables: ServiceTable[];
  onClose: () => void;
  onMove: (tableId: string) => Promise<void>;
}) {
  const footerActions = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-control-lg items-center rounded-full px-16 text-body font-medium text-ink-muted transition-colors hover:text-ink press-feedback"
    >
      Keep it here
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Move ${detail.label} to another table`}
      description="Seats, labels and lines move with the tab."
      width="md"
      footer={footerActions}
    >
      <div className="py-4">
        {freeTables.length === 0 ? (
          <div className="rounded-lg bg-control p-20 text-center ring-1 ring-rule-raised/20">
            <p className="text-body text-ink-muted">Every table is taken right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-8">
            {freeTables.map((t) => (
              <InviteButton
                key={t.id}
                onClick={() => void onMove(t.id).then(onClose)}
                className="flex min-h-[76px] flex-col justify-center rounded-lg bg-control px-16 ring-1 ring-rule-raised/20 transition-all hover:bg-control-hover hover:ring-rule-raised/40 press-feedback"
              >
                <span className="text-subtitle font-medium text-ink">{tableLabel(t)}</span>
                <span className="mt-2 text-body-sm text-ink-subtle">{t.seats === 1 ? '1 seat' : `${t.seats} seats`}</span>
              </InviteButton>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
