'use client';

import { InlineNotice } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import type { Modifier, ModifierGroup, OrderLine, ServiceTable } from '@bliss/shared/domain';
import { formatKes } from '@bliss/shared/money';
import { tryResolvePrice } from '@bliss/shared/pricing';
import { SEAT_LABEL_MAX, displaySeatLabel } from '@bliss/shared/seats';
import { ActionList } from '@bliss/ui/components/action-list';
import { Button } from '@bliss/ui/components/button';
import { Stepper } from '@bliss/ui/components/fields';
import { ChoiceChip, FloorDialog, Sheet, SheetCancel, SheetIcon, SheetPanel, SheetRow, SheetSection } from '@bliss/ui/components/floor/sheet';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { SeatChip, SeatChipButton } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconArmchair, IconArrowsExchange, IconArrowsRightLeft, IconBan, IconGlassFull, IconListDetails, IconNote, IconPackageOff, IconTag, IconTrash, IconX } from '@tabler/icons-react';
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
  // A required choice, such as a shisha flavour, is made before the item can be added.
  const missing = data?.groups.find(({ group }) => group.minSelect > 0 && (picked[group.id]?.length ?? 0) < group.minSelect)?.group ?? null;

  const footerActions = (
    <>
      <SheetCancel onClick={onClose}>Cancel</SheetCancel>
      <div className="flex-1" />
      <Button
        variant="primary"
        size="lg"
        loading={pending}
        disabled={Boolean(missing)}
        onClick={async () => {
          if (!variantId || missing) return;
          setPending(true);
          try {
            await onAdd({ variantId, qty, modifiers: choices, note: note.trim() || null });
          } finally {
            setPending(false);
          }
        }}
        shape="pill"
        className="px-32"
      >
        {missing ? `Choose the ${missing.name.toLowerCase()}` : price ? `Add to ${target} · ${formatKes(price.lineTotalCents, { decimals: 'whole' })}` : `Add to ${target}`}
      </Button>
    </>
  );

  return (
    <Sheet
      open={Boolean(variantId)}
      onClose={onClose}
      title={data?.variant?.name ?? 'Add a serve'}
      leading={<SheetIcon icon={IconGlassFull} />}
      description={price ? `${formatKes(price.unitPriceCents)} each` : undefined}
      width={hasModifiers ? 'md' : 'sm'}
      footer={footerActions}
    >
      <div className="flex flex-col gap-24 py-4">
        {data?.groups.map(({ group, modifiers }) => (
          <SheetSection key={group.id} label={group.name} aside={group.maxSelect > 1 ? (group.minSelect > 0 ? `Choose one, or up to ${group.maxSelect}` : `Up to ${group.maxSelect}`) : 'Choose one'}>
            <div className="flex flex-wrap gap-8" role="group" aria-label={group.name}>
              {modifiers.map((m) => (
                <ChoiceChip
                  key={m.id}
                  on={(picked[group.id] ?? []).includes(m.id)}
                  onClick={() => toggle(group, m.id)}
                  extra={m.priceDeltaCents > 0n ? `+${formatKes(m.priceDeltaCents, { decimals: 'whole' }).replace('KES ', '')}` : undefined}
                >
                  {m.name}
                </ChoiceChip>
              ))}
            </div>
          </SheetSection>
        ))}

        <SheetPanel>
          <SheetRow title="How many" detail={price ? `${formatKes(price.unitPriceCents)} each` : 'Serves'}>
            <Stepper value={qty} min={1} max={24} onChange={setQty} label="How many" size="lg" decreaseLabel="One fewer" increaseLabel="One more" />
          </SheetRow>
          {price && qty > 1 ? <SheetRow title="Together" detail={`${qty} × ${formatKes(price.unitPriceCents, { decimals: 'whole' })}`}><Money value={price.lineTotalCents} size="num" /></SheetRow> : null}
        </SheetPanel>

        <TextField
          label="Note for the bar"
          helper="Optional. Anything else the guest asked for; the bar sees it on the ticket."
          placeholder="No ice, with the food"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          trailing={
            note ? (
              <button type="button" onClick={() => setNote('')} aria-label="Clear the note" className="flex size-control-sm items-center justify-center rounded-dot text-ink-subtle hover:bg-control hover:text-ink">
                <IconX size={16} stroke={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />
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
      shape="pill"
      fullWidth
    >
      Back to the menu
    </Button>
  );

  return (
    <Sheet
      open={Boolean(variantId)}
      onClose={onClose}
      title={name}
      leading={<SheetIcon icon={IconPackageOff} tone="low" />}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-4">
        <SheetPanel>
          <SheetRow title={held ? 'On hold' : 'Finished'} detail={held ? 'Kept off sale for now' : 'None left at the bar'}>
            <StatusChip status={held ? 'on_hold' : 'finished'} />
          </SheetRow>
        </SheetPanel>
        <p className="text-body text-ink-muted">
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
    <SheetCancel onClick={onClose}>Close</SheetCancel>
  );

  return (
    <Sheet
      open={Boolean(seatId)}
      onClose={onClose}
      title={`Seat ${seat.seatNo}${seat.label ? ` · ${seat.label}` : ''}`}
      leading={<SheetIcon icon={IconArmchair} />}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-2">
        <SheetPanel>
          <div className="flex min-h-row-floor items-center justify-between gap-16 py-8">
            <div className="flex min-w-0 items-center gap-12">
              <SeatChip seat={seat.seatNo} size="row" label={seat.label} />
              <span className="truncate text-body font-medium text-ink">{seat.label ? displaySeatLabel(seat.label) : `Seat ${seat.seatNo}`}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-label text-ink-subtle">On this seat</span>
              <Money value={seat.total} size="num" tone="default" />
            </div>
          </div>
        </SheetPanel>

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
          <InlineNotice tone="stop">{error}</InlineNotice>
        ) : null}

        <p className="text-body-sm text-ink-muted">Settling a seat happens at the counter. This seat dims here when it is settled.</p>
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
      <SheetCancel onClick={onClose}>Cancel</SheetCancel>
      <div className="flex-1" />
      <Button
        type="submit"
        form="label-seat-form"
        variant="primary"
        size="lg"
        shape="pill"
        className="px-32"
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
      leading={<SheetIcon icon={IconTag} />}
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
        <TextField
          label="Seat label"
          data-autofocus=""
          placeholder="Cap, birthday, the boss"
          value={value}
          maxLength={SEAT_LABEL_MAX}
          counter={`${value.length}/${SEAT_LABEL_MAX}`}
          helper="Only you and the bar see this on the floor."
          onChange={(e) => setValue(e.target.value)}
          trailing={
            value ? (
              <button type="button" onClick={() => setValue('')} aria-label="Clear the label" className="flex size-control-sm items-center justify-center rounded-dot text-ink-subtle hover:bg-control hover:text-ink">
                <IconX size={16} stroke={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />
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
    <SheetCancel onClick={onClose}>Close</SheetCancel>
  );

  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `${line.qty} × ${name}` : ''}
      leading={<SheetIcon icon={IconListDetails} />}
      description={line ? `${seat ? `Seat ${seat.seatNo}` : detail.showControls ? 'Shared' : detail.label} · ${formatKes(line.lineTotalCents)}` : undefined}
      width="sm"
      footer={footerActions}
    >
      <div className="flex flex-col gap-16 py-2">
        {line && draft ? (
          <SheetPanel>
            <SheetRow title="How many" detail="Not fired yet">
              <Stepper value={line.qty} min={1} max={24} onChange={onQty} label="How many" size="lg" decreaseLabel="One fewer" increaseLabel="One more" />
            </SheetRow>
          </SheetPanel>
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
    <SheetCancel onClick={onClose}>Cancel</SheetCancel>
  );

  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? `Move ${line.qty} × ${name} to another seat` : ''}
      leading={<SheetIcon icon={IconArrowsExchange} />}
      width="md"
      footer={footerActions}
    >
      <div className="py-4">
        <SheetPanel className="py-16">
          <div className="flex flex-wrap justify-center gap-16" role="group" aria-label="Seats">
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
                  <span className={cx('max-w-full truncate text-label', isCurrent ? 'text-accent-text' : 'text-ink-muted')}>
                    {isCurrent ? 'Here now' : option.seat === 'shared' ? 'Shared' : (displaySeatLabel(option.label) ?? `Seat ${option.seat}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </SheetPanel>
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
      <SheetCancel onClick={onClose}>Cancel</SheetCancel>
      <div className="flex-1" />
      <Button
        type="submit"
        form="line-note-form"
        variant="primary"
        size="lg"
        shape="pill"
        className="px-32"
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
      leading={<SheetIcon icon={IconNote} />}
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
        <TextField
          label="Note for the ticket"
          data-autofocus=""
          placeholder="No ice, with the food"
          value={value}
          maxLength={140}
          counter={`${value.length}/140`}
          helper="The bar and the kitchen see it printed on the ticket."
          onChange={(e) => setValue(e.target.value)}
          trailing={
            value ? (
              <button type="button" onClick={() => setValue('')} aria-label="Clear the note" className="flex size-control-sm items-center justify-center rounded-dot text-ink-subtle hover:bg-control hover:text-ink">
                <IconX size={16} stroke={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />
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
      leading={<SheetIcon icon={IconBan} tone="stop" />}
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
    <SheetCancel onClick={onClose}>Keep it here</SheetCancel>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Move ${detail.label} to another table`}
      leading={<SheetIcon icon={IconArrowsRightLeft} />}
      description="Seats, labels and lines move with the tab."
      width="md"
      footer={footerActions}
    >
      <div className="py-4">
        {freeTables.length === 0 ? (
          <SheetPanel className="items-center py-24 text-center">
            <p className="text-body font-medium text-ink">Every table is taken</p>
            <p className="text-body-sm text-ink-muted">A table frees up when its guests have paid and left.</p>
          </SheetPanel>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-8">
            {freeTables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void onMove(t.id).then(onClose)}
                className="flex min-h-tile-row flex-col justify-center gap-2 rounded-card border border-rule-raised/40 bg-control/60 px-16 py-12 text-left press-feedback transition-hover hover:border-accent/40 hover:bg-accent-wash"
              >
                <span className="text-subtitle font-medium text-ink">{tableLabel(t)}</span>
                <span className="text-body-sm text-ink-muted">{t.seats === 1 ? '1 seat' : `${t.seats} seats`}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
