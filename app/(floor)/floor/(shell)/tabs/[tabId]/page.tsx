'use client';

import { formatElapsed } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { MetaLine } from '@bliss/ui/components/working';
import { SeatSelector } from '@bliss/ui/components/floor/seat-selector';
import { useNow } from '@bliss/ui/hooks';
import { orderFire } from '@bliss/ui/motion/floor';
import { IconArrowsRightLeft, IconFlame, IconUserPlus } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { posDb } from '@/lib/pos/db';
import {
  type SeatSelection,
  addLine,
  addSeat,
  fireOrder,
  labelSeat,
  moveLine,
  moveTab,
  removeSeat,
  selectSeat,
  setDraftQty,
  setLineNote,
  voidLine,
} from '@/lib/pos/mutations';
import { useGrid, useOpenTabs, useOutlet, useTab } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { ItemGrid } from './_parts/item-grid';
import { FinishedSheet, LabelSeatSheet, LineSheet, ModifierSheet, MoveLineSheet, MoveTabSheet, NoteSheet, SeatMenuSheet, VoidDialog } from './_parts/sheets';
import { TablesRail } from './_parts/tables-rail';
import { TicketColumn, type TicketColumnHandle } from './_parts/ticket-column';
import type { RowAction } from './_parts/ticket-row';

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
  | { kind: 'move-tab' };

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
  const tables = useLiveQuery(() => posDb().serviceTables.toArray(), []);

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

  const onAdd = (variantId: string) => {
    if (!detail) return;
    void run(() => addLine({ tabId, seat: detail.selected, variantId }));
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
    await run(() => fireOrder(tabId));
    setFiring(false);
  };

  const onAddSeat = () =>
    void run(async () => {
      const seatNo = await addSeat(tabId);
      setNotice(`Seat ${seatNo} added`);
      setTimeout(() => setNotice(null), 2000);
    });

  const freeTables = (tables ?? []).filter((t) => !(tabs ?? []).some((x) => x.tab.serviceTableId === t.id) && t.status !== 'out_of_service');
  // waiterName comes from the TabListItem (which has the staff map join), not TabDetail.
  const tabListItem = (tabs ?? []).find((t) => t.tab.id === tabId);
  const waiterName = tabListItem?.waiterName ?? null;
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
      {session && tabs ? <TablesRail tabs={tabs} currentTabId={tabId} currentZoneId={detail?.tab.zoneId ?? null} staffId={session.staffId} selectedSeatId={detail?.selected} /> : <div className="w-rail-tables shrink-0" />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col shadow-[inset_1px_0_8px_rgba(0,0,0,0.2)] bg-page/50">
        <header className="flex shrink-0 items-center justify-end gap-16 px-24 border-b border-rule z-10 h-[88px]">

          <div className="flex shrink-0 items-center gap-12 h-full">
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
                ]}
              />
            ) : null}
          </div>
        </header>
        {detail?.blocked ? (
          <InlineNotice tone="stop" className="px-16 shadow-sm z-10 relative">
            A change to this tab could not be sent. A manager can see why in Console, Settings, Sync.
          </InlineNotice>
        ) : null}
        {error ? (
          <InlineNotice tone="low" className="px-16 shadow-sm z-10 relative" action={<Button variant="ghost" size="md" onClick={() => setError(null)}>Dismiss</Button>}>
            {error}
          </InlineNotice>
        ) : null}
        <ItemGrid grid={grid} onAdd={onAdd} onLongPress={onTileLongPress} />
      </div>

      {detail ? (
        <TicketColumn
          ref={ticketRef}
          detail={detail}
          timezone={timezone}
          metaItems={metaItems}
          onLineAction={onLineAction}
        />
      ) : (
        <div className="w-rail-ticket shrink-0" aria-busy="true" />
      )}

      <BaseAction>
        <Button
          variant="primary"
          size="lg"
          icon={IconFlame}
          loading={firing}
          disabled={!detail || detail.draftCount === 0}
          onClick={() => void onFire()}
          className="!rounded-full px-20 tablet:px-24 desktop:px-28 h-[42px] tablet:h-[46px] desktop:h-[50px] min-w-[150px] tablet:min-w-[180px] desktop:min-w-[280px] desktop:max-w-[340px] whitespace-nowrap text-[13.5px] tablet:text-[14.5px] desktop:text-[15px] font-semibold shadow-[0_8px_32px_-8px_var(--color-accent)] disabled:!bg-white/5 disabled:!text-ink-disabled disabled:shadow-none [&:not(:disabled)]:!bg-accent [&:not(:disabled)]:!text-accent-ink hover:[&:not(:disabled)]:scale-[1.02] hover:[&:not(:disabled)]:shadow-[0_12px_48px_-8px_var(--color-accent)] transition-all"
        >
          {detail && detail.draftCount > 0 ? `Fire order · ${detail.draftCount} ${detail.draftCount === 1 ? 'line' : 'lines'}` : 'Fire order'}
        </Button>
      </BaseAction>

      {detail ? (
        <>
          <ModifierSheet
            variantId={overlay.kind === 'modifiers' ? overlay.variantId : null}
            detail={detail}
            timezone={timezone}
            onClose={close}
            onAdd={async (input) => {
              await run(() => addLine({ tabId, seat: detail.selected, ...input }));
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
              await removeSeat(seatId);
              close();
            }}
          />
          <LabelSeatSheet seatId={overlay.kind === 'label' ? overlay.seatId : null} detail={detail} onClose={close} onSave={(seatId, label) => labelSeat(seatId, label)} />
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
              void run(() => moveLine(overlayLineId, to));
            }}
          />
          <NoteSheet line={overlay.kind === 'note' ? (active?.line ?? null) : null} name={active?.name ?? ''} onClose={close} onSave={(note) => (overlayLineId ? setLineNote(overlayLineId, note) : Promise.resolve())} />
          <VoidDialog
            line={overlay.kind === 'void' ? (active?.line ?? null) : null}
            name={active?.name ?? ''}
            detail={detail}
            poured={active?.state === 'poured'}
            ranOut={active?.state === 'ran_out'}
            onClose={close}
            onVoid={(reason, token) => voidLine({ lineId: overlayLineId!, reason, approvalToken: token })}
          />
          <MoveTabSheet open={overlay.kind === 'move-tab'} detail={detail} freeTables={freeTables} onClose={close} onMove={(tableId) => moveTab(tabId, tableId)} />
        </>
      ) : null}
    </div>
  );
}
