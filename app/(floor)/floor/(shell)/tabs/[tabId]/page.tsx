'use client';

import { formatElapsed, formatTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Money } from '@bliss/ui/components/money';
import { MetaLine } from '@bliss/ui/components/working';
import { SeatSelector } from '@bliss/ui/components/floor/seat-selector';
import { useNow } from '@bliss/ui/hooks';
import { orderFire } from '@bliss/ui/motion/floor';
import { IconArrowBackUp, IconArrowLeft, IconArrowsRightLeft, IconCheck, IconDoorExit, IconFlame, IconReceipt, IconReceipt2, IconUserPlus, IconPrinter } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { posDb } from '@/lib/pos/db';
import { notify } from '@bliss/ui/components/notices';
import { addItem, askBill, clear, closeEmpty, deliverTable, fire, takeBackBill } from '@/lib/pos/actions';
import { STAGE } from '@/app/_pos/table-stage';
import { StatePill } from '@bliss/ui/components/status';
import { FloorDialog } from '@bliss/ui/components/floor/sheet';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { holdsTable, isOrdering, isSeated, placeLabel } from '@bliss/shared/trade';
import {
  addLine,
  addSeat,
  labelSeat,
  moveLine,
  moveTab,
  removeSeat,
  selectSeat,
  setDraftQty,
  setLineNote,
  voidLine,
} from '@/lib/pos/mutations';
import { type TabDetail, useGrid, useOpenTabs, useOutlet, useTab } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { ItemGrid } from './_parts/item-grid';
import { FinishedSheet, LabelSeatSheet, LineSheet, ModifierSheet, MoveLineSheet, MoveTabSheet, NoteSheet, SeatMenuSheet, VoidDialog } from './_parts/sheets';
import { TablesRail } from './_parts/tables-rail';
import { TicketColumn, type TicketColumnHandle } from './_parts/ticket-column';
import type { RowAction } from './_parts/ticket-row';
import { printUrl } from '@/lib/pos/api';

type Overlay =
  | { kind: 'none' }
  | { kind: 'modifiers'; variantId: string }
  | { kind: 'finished'; variantId: string }
  | { kind: 'seat'; seatId: string }
  | { kind: 'label'; seatId: string }
  | { kind: 'line'; lineId: string }
  | { kind: 'move'; lineId: string }
  | { kind: 'note'; lineId: string }
  | { kind: 'void'; lineId: string }
  | { kind: 'move-tab' }
  | { kind: 'close-empty' };

/**
 * The tab: tables rail 180, item grid fluid, ticket rail 340, base layer with Fire order.
 * Three taps to a fired order: table, tile, fire. Four if the seat changes. docs/06 section 7.1.
 */
export default function TabScreen() {
  const { tabId } = useParams<{ tabId: string }>();
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const detail = useTab(tabId);
  const tabs = useOpenTabs();
  const now = useNow(30_000);
  const grid = useGrid(now, outlet?.timezone);
  const ticketRef = useRef<TicketColumnHandle>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [notice, setNotice] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTicketOpen, setMobileTicketOpen] = useState(false);
  const tables = useLiveQuery(() => posDb().serviceTables.toArray(), []);
  // Every tab that still holds a table, including paid ones whose guests have not left.
  const holding = useLiveQuery(async () => (await posDb().tabs.toArray()).filter((t) => holdsTable(t)), []);

  const close = () => setOverlay({ kind: 'none' });
  const timezone = outlet?.timezone ?? 'Africa/Nairobi';

  if (detail === null) {
    return (
      <div className="flex h-full items-center justify-center p-40">
        <EmptyState
          align="center"
          title="This tab is no longer open"
          body="It was settled, merged or handed over on another device. Nothing was lost."
          action={
            <Button variant="secondary" size="lg" onClick={() => router.push('/floor/tabs')}>
              Back to tabs
            </Button>
          }
        />
      </div>
    );
  }

  // Paid, cleared or closed: nothing more can be ordered here, so the grid gives way to what is true.
  if (detail && !isOrdering(detail.tab)) {
    return <SettledTab detail={detail} timezone={timezone} />;
  }

  const allLines = detail?.groups.flatMap((g) => g.lines) ?? [];
  const lineOf = (id: string | undefined) => allLines.find((l) => l.line.id === id);
  const overlayLineId = 'lineId' in overlay ? overlay.lineId : undefined;
  const active = lineOf(overlayLineId);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Nothing was changed.');
    }
  };

  // The seat the next tap lands on, named the way the ticket names it.
  const seatName = (() => {
    if (!detail) return 'the tab';
    if (detail.selected === 'shared') return 'Shared';
    const seat = detail.seats.find((x) => x.id === detail.selected);
    return seat ? `Seat ${seat.seatNo}` : 'the tab';
  })();

  // How many of each item are on the selected seat's draft, for the count on its tile.
  const inCart = new Map<string, number>();
  for (const group of detail?.groups ?? []) {
    if ((group.seat?.id ?? 'shared') !== detail?.selected) continue;
    for (const { line, state } of group.lines) if (state === 'draft') inCart.set(line.productVariantId, (inCart.get(line.productVariantId) ?? 0) + line.qty);
  }

  const onAdd = (variantId: string) => {
    if (!detail) return;
    const name = grid?.tiles.find((t) => t.variantId === variantId)?.name ?? 'Item';
    void run(() => addItem({ tabId, seat: detail.selected, seatName, variantId, name }));
  };

  const onTileLongPress = (variantId: string) => {
    const tile = grid?.tiles.find((t) => t.variantId === variantId);
    setOverlay(tile?.state === 'finished' ? { kind: 'finished', variantId } : { kind: 'modifiers', variantId });
  };

  const onLineAction = (lineId: string, action: RowAction) => {
    if (action === 'menu') setOverlay({ kind: 'line', lineId });
    else if (action === 'move') setOverlay({ kind: 'move', lineId });
    else if (action === 'note') setOverlay({ kind: 'note', lineId });
    else if (action === 'void') setOverlay({ kind: 'void', lineId });
    else if (action === 'clear') void run(() => setDraftQty(lineId, 0));
  };

  const onFire = async () => {
    if (!detail || detail.draftCount === 0 || firing) return;
    setFiring(true);
    const markers = Array.from(document.querySelectorAll('[data-draft-marker]'));
    await new Promise<void>((resolve) => orderFire(markers, resolve));
    await fire(tabId, detail.label);
    setFiring(false);
  };

  const onAddSeat = () =>
    void run(async () => {
      const seatNo = await addSeat(tabId);
      setNotice(`Seat ${seatNo} added`);
      setTimeout(() => setNotice(null), 2000);
    });

  const freeTables = (tables ?? []).filter((t) => !(holding ?? []).some((x) => x.serviceTableId === t.id) && t.status !== 'out_of_service');
  // waiterName comes from the TabListItem (which has the staff map join), not TabDetail.
  const tabListItem = (tabs ?? []).find((t) => t.tab.id === tabId);
  const waiterName = tabListItem?.waiterName ?? null;
  // Where the table stands. With nothing waiting to fire, the dock offers the table's next step.
  const stage = tabListItem?.stage ?? null;
  const label = detail?.label ?? 'this table';
  const idle = detail ? detail.draftCount === 0 : false;
  const metaItems = detail
    ? [
        detail.activeSeats.length > 0 ? { key: 'guests', text: `${detail.activeSeats.length} ${detail.activeSeats.length === 1 ? 'guest' : 'guests'}` } : null,
        detail.tab.tabNumber ? { key: 'num', text: `Tab ${detail.tab.tabNumber}` } : null,
        detail.zone?.name ? { key: 'zone', text: detail.zone.name } : null,
        { key: 'elapsed', text: `open ${formatElapsed(now - detail.tab.openedAt)}`, mono: true },
        detail.tab.assignedTo !== session?.staffId && waiterName
          ? { key: 'waiter', text: waiterName }
          : null,
        detail.tab.name ? { key: 'name', text: detail.tab.name } : null,
      ]
    : [];

  return (
    <div className="flex h-full min-h-0 bg-page">
      {/* ── Left Rail Sidebar (180px) ────────────────────────────────────── */}
      {session && tabs ? <TablesRail tabs={tabs} currentTabId={tabId} currentZoneId={detail?.tab.zoneId ?? null} staffId={session.staffId} selectedSeatId={detail?.selected} /> : <div className="hidden tablet:block w-rail-tables shrink-0" />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col shadow-[inset_1px_0_8px_rgba(0,0,0,0.2)] bg-page/50">
        <header className="z-10 flex shrink-0 flex-col gap-8 border-b border-rule px-12 py-8 pad:flex-row pad:items-center pad:justify-between pad:gap-16 pad:px-24 pad:py-12">
          {/* Which table this is, and what it has run up. The ticket is a drawer on a phone, so
              without this the waiter cannot see either without opening it. */}
          <div className="flex min-w-0 items-baseline justify-between gap-12 pad:justify-start">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-8">
                <h1 className="truncate text-title font-medium text-ink">{detail?.label ?? 'Tab'}</h1>
                {stage && stage !== 'empty' ? (
                  <StatePill tone={STAGE[stage].tone} more={STAGE[stage].more} live={STAGE[stage].live}>
                    {STAGE[stage].word}
                  </StatePill>
                ) : null}
              </div>
              <MetaLine items={metaItems} className="pad:hidden" />
            </div>
            {detail ? <Money value={detail.total} size="num-lg" decimals="whole" className="shrink-0 pad:hidden" /> : null}
          </div>

          <div className="flex h-full min-w-0 items-center gap-12 pad:shrink-0">
            {detail?.showControls ? (
              <SeatSelector
                seats={detail.seats.filter((s) => s.status !== 'removed').map((s) => ({ id: s.id, seatNo: s.seatNo, label: s.label, status: s.status === 'settled' ? 'settled' : 'active', total: s.total }))}
                sharedTotal={detail.sharedTotal}
                selected={detail.selected}
                onSelect={(seat) => void selectSeat(tabId, seat)}
                onSeatMenu={(seatId) => setOverlay({ kind: 'seat', seatId })}
                onAddSeat={onAddSeat}
                notice={notice}
              />
            ) : null}
            
            {detail ? (
              <OverflowMenu
                label="Tab actions"
                size="lg"
                items={[
                  { key: 'seat', label: 'Add seat', icon: IconUserPlus, onSelect: onAddSeat },
                  { key: 'move', label: 'Move to another table', icon: IconArrowsRightLeft, onSelect: () => setOverlay({ kind: 'move-tab' }) },
                  ...(stage === 'to_serve' ? [{ key: 'served', label: 'Mark everything served', icon: IconCheck, onSelect: () => void deliverTable(tabId, label) }] : []),
                  ...(stage === 'bill'
                    ? [
                        { key: 'bill', label: 'Take back the bill request', icon: IconArrowBackUp, onSelect: () => void takeBackBill(tabId, label) },
                        { key: 'print-bill', label: 'Print requested bill', icon: IconPrinter, onSelect: () => window.open(printUrl(`/print/tab/${tabId}`), '_blank') }
                      ]
                    : stage && stage !== 'empty'
                      ? [
                          { key: 'bill', label: 'Ask for the bill', icon: IconReceipt, onSelect: () => void askBill(tabId, label) },
                          { key: 'print-bill', label: 'Print requested bill', icon: IconPrinter, onSelect: () => window.open(printUrl(`/print/tab/${tabId}`), '_blank') }
                        ]
                      : []),
                  // Only while nothing has been fired: a tab with something on it is paid, not closed.
                  ...(allLines.every(({ state }) => state === 'draft')
                    ? [{ key: 'close', label: 'Guests left without ordering', icon: IconDoorExit, destructive: true, onSelect: () => setOverlay({ kind: 'close-empty' }) }]
                    : []),
                ]}
              />
            ) : null}
          </div>
        </header>
        {detail?.blocked ? (
          <InlineNotice tone="stop" className="px-16 shadow-raised z-10 relative">
            A change to this tab could not be sent. A manager can see why in Console, Settings, Sync.
          </InlineNotice>
        ) : null}
        {error ? (
          <InlineNotice tone="low" className="px-16 shadow-raised z-10 relative" action={<Button variant="ghost" size="md" onClick={() => setError(null)}>Dismiss</Button>}>
            {error}
          </InlineNotice>
        ) : null}
        <ItemGrid grid={grid} onAdd={onAdd} onLongPress={onTileLongPress} inCart={inCart} />
      </div>

      {detail ? (
        <TicketColumn
          ref={ticketRef}
          detail={detail}
          timezone={timezone}
          metaItems={metaItems}
          onLineAction={onLineAction}
          mobileOpen={mobileTicketOpen}
          onCloseMobile={() => setMobileTicketOpen(false)}
        />
      ) : (
        <div className="hidden tablet:block w-rail-ticket shrink-0" aria-busy="true" />
      )}

      <BaseAction>
        <Button
          variant="secondary"
          size="xl"
          icon={IconReceipt2}
          onClick={() => setMobileTicketOpen(!mobileTicketOpen)}
          className="tablet:hidden"
        >
          {detail && detail.groups.length > 0 ? `Ticket · ${detail.groups.reduce((n, g) => n + g.lines.length, 0)}` : 'Ticket'}
        </Button>
        {idle && stage === 'to_serve' ? (
          <Button variant="primary" size="xl" icon={IconCheck} onClick={() => void deliverTable(tabId, label)}>
            Mark served
          </Button>
        ) : idle && stage === 'served' ? (
          <Button variant="primary" size="xl" icon={IconReceipt} onClick={() => void askBill(tabId, label)}>
            Ask for the bill
          </Button>
        ) : idle && stage === 'bill' ? (
          <Button variant="secondary" size="xl" icon={IconArrowBackUp} onClick={() => void takeBackBill(tabId, label)}>
            Bill asked · take back
          </Button>
        ) : (
          <Button variant="primary" size="xl" icon={IconFlame} loading={firing} disabled={!detail || detail.draftCount === 0} onClick={() => void onFire()}>
            {detail && detail.draftCount > 0 ? `Fire · ${detail.draftCount}` : 'Fire'}
          </Button>
        )}
      </BaseAction>

      {detail ? (
        <>
          <ModifierSheet
            variantId={overlay.kind === 'modifiers' ? overlay.variantId : null}
            detail={detail}
            timezone={timezone}
            onClose={close}
            onAdd={async (input) => {
              await run(async () => {
                const lineId = await addLine({ tabId, seat: detail.selected, ...input });
                const name = grid?.tiles.find((t) => t.variantId === input.variantId)?.name ?? 'Item';
                if (lineId) notify({ key: `add:${tabId}:${String(detail.selected)}:${input.variantId}:with`, count: true, title: `${name} added`, body: `With its choices, on ${seatName}. Not fired yet.` });
              });
              close();
            }}
          />
          <FinishedSheet variantId={overlay.kind === 'finished' ? overlay.variantId : null} onClose={close} />
          <SeatMenuSheet
            seatId={overlay.kind === 'seat' ? overlay.seatId : null}
            detail={detail}
            onClose={close}
            onLabel={(seatId) => setOverlay({ kind: 'label', seatId })}
            onRemove={async (seatId) => {
              const seatNo = detail.seats.find((x) => x.id === seatId)?.seatNo;
              await removeSeat(seatId);
              notify({ key: `seat:${seatId}`, title: `Seat ${seatNo ?? ''} removed`, body: `${detail.label} has ${detail.activeSeats.length - 1} seats now.` });
              close();
            }}
          />
          <LabelSeatSheet
            seatId={overlay.kind === 'label' ? overlay.seatId : null}
            detail={detail}
            onClose={close}
            onSave={async (seatId, label) => {
              const before = detail.seats.find((x) => x.id === seatId);
              await labelSeat(seatId, label);
              notify({
                key: `seat:${seatId}`,
                title: label.trim() ? `Seat ${before?.seatNo ?? ''} is ${label.trim()}` : `Seat ${before?.seatNo ?? ''} label removed`,
                undo: () => labelSeat(seatId, before?.label ?? ''),
              });
            }}
          />
          <LineSheet
            line={overlay.kind === 'line' ? (active?.line ?? null) : null}
            name={active?.name ?? ''}
            state={active?.state ?? ''}
            detail={detail}
            onClose={close}
            onMove={() => overlayLineId && setOverlay({ kind: 'move', lineId: overlayLineId })}
            onNote={() => overlayLineId && setOverlay({ kind: 'note', lineId: overlayLineId })}
            onVoid={() => overlayLineId && setOverlay({ kind: 'void', lineId: overlayLineId })}
            onQty={(qty) => {
              if (!overlayLineId) return;
              void run(() => setDraftQty(overlayLineId, qty));
              if (qty < 1) close();
            }}
          />
          <MoveLineSheet
            line={overlay.kind === 'move' ? (active?.line ?? null) : null}
            name={active?.name ?? ''}
            detail={detail}
            onClose={close}
            onMove={(to) => {
              if (!overlayLineId) return;
              close();
              ticketRef.current?.captureForMove();
              const lineId = overlayLineId;
              const from = active?.line.tabSeatId ?? 'shared';
              const name = active?.name ?? 'The line';
              const toName = to === 'shared' ? 'Shared' : `Seat ${detail.seats.find((x) => x.id === to)?.seatNo ?? ''}`;
              void run(async () => {
                await moveLine(lineId, to);
                notify({ key: `move:${lineId}`, title: `${name} moved to ${toName}`, undo: () => moveLine(lineId, from) });
              });
            }}
          />
          <NoteSheet
            line={overlay.kind === 'note' ? (active?.line ?? null) : null}
            name={active?.name ?? ''}
            onClose={close}
            onSave={async (note) => {
              if (!overlayLineId) return;
              const lineId = overlayLineId;
              const before = active?.line.note ?? null;
              await setLineNote(lineId, note);
              notify({ key: `note:${lineId}`, title: note ? 'Note saved' : 'Note removed', body: note ? `"${note}" on ${active?.name ?? 'the line'}.` : undefined, undo: () => setLineNote(lineId, before) });
            }}
          />
          <VoidDialog
            line={overlay.kind === 'void' ? (active?.line ?? null) : null}
            name={active?.name ?? ''}
            detail={detail}
            poured={active?.state === 'poured'}
            ranOut={active?.state === 'ran_out'}
            onClose={close}
            onVoid={async (reason, token) => {
              const name = active?.name ?? 'The line';
              const qty = active?.line.qty ?? 1;
              await voidLine({ lineId: overlayLineId!, reason, approvalToken: token });
              // A void is audited and cannot be taken back, so there is no undo: the notice only confirms.
              notify({ tone: 'info', key: `void:${overlayLineId}`, title: `Voided · ${qty} × ${name}`, body: `Off ${detail.label}, with the reason kept.` });
            }}
          />
          <FloorDialog
            open={overlay.kind === 'close-empty'}
            onClose={close}
            title={`Close ${detail.label}?`}
            description="The guests left before anything was fired. The tab closes, the table is free, and the reason stays with the tab for the manager."
            width="md"
          >
            <ReasonForm
              focus="chip"
              quickReasons={['Guests left without ordering', 'Opened on the wrong table', 'Guests moved to another table']}
              confirmLabel="Close the tab"
              onCancel={close}
              onConfirm={async ({ reason }) => {
                await closeEmpty(tabId, detail.label, reason);
                close();
                router.push('/floor/tabs');
              }}
            />
          </FloorDialog>
          <MoveTabSheet
            open={overlay.kind === 'move-tab'}
            detail={detail}
            freeTables={freeTables}
            onClose={close}
            onMove={async (tableId) => {
              await moveTab(tabId, tableId);
              const to = freeTables.find((t) => t.id === tableId);
              notify({ key: `move-tab:${tabId}`, title: `Moved to ${to ? placeLabel(to.label) : 'the new table'}`, body: `${detail.label} was freed for the next party.` });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * A tab that can no longer take orders. docs/16 section 8.
 *
 * Paid with the guests still seated is the common case: the counter has settled it, and the table
 * stays theirs until the waiter sees them leave and clears it. Cleared, and closed empty, only say
 * so and point back to the list.
 */
function SettledTab({ detail, timezone }: { detail: TabDetail; timezone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const seated = isSeated(detail.tab);
  const voided = detail.tab.status === 'voided';

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-16 pad:p-40">
      <section aria-labelledby="settled-title" className="flex w-full max-w-[480px] flex-col items-center gap-16 rounded-[22px] border border-rule-raised/40 bg-raised/70 p-24 text-center backdrop-blur-glass">
        <span className={seated ? 'flex size-avatar items-center justify-center rounded-dot bg-poured/15 text-poured' : 'flex size-avatar items-center justify-center rounded-dot bg-control text-ink-subtle'}>
          {seated ? <IconCheck size={28} stroke={1.5} aria-hidden="true" /> : <IconDoorExit size={28} stroke={1.5} aria-hidden="true" />}
        </span>
        <div>
          <h1 id="settled-title" className="text-title-lg text-ink">
            {seated ? `${detail.label} is paid` : voided ? `${detail.label} was closed` : `${detail.label} is clear`}
          </h1>
          <p className="mt-8 text-body text-ink-muted">
            {seated
              ? `Settled at ${detail.tab.closedAt ? formatTime(detail.tab.closedAt, timezone) : 'the counter'}. The guests are still at the table. Clear it when they leave, and it is free on every device.`
              : voided
                ? 'Nothing was ordered on it. The reason is kept with the tab.'
                : `Cleared${detail.tab.clearedAt ? ` at ${formatTime(detail.tab.clearedAt, timezone)}` : ''}. It is in tonight's history.`}
          </p>
        </div>
        {seated ? <Money value={detail.total} size="num-xl" tone="money" /> : null}
        <Button variant="ghost" size="lg" icon={IconArrowLeft} onClick={() => router.push('/floor/tabs')}>
          Back to tabs
        </Button>
      </section>

      {seated ? (
        <BaseAction>
          <Button
            variant="primary"
            size="xl"
            icon={IconDoorExit}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await clear(detail.tab.id, detail.label);
              setBusy(false);
              if (ok) router.push('/floor/tabs');
            }}
          >
            Guests left · clear table
          </Button>
        </BaseAction>
      ) : null}
    </div>
  );
}
