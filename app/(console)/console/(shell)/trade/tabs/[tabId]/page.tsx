import { formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { isPositive, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { type StatusKey, StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft, IconMapPin, IconCalendar, IconClock, IconUser, IconReceipt2, IconHistory, IconNote } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as audit from '@/modules/audit/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { SCOPE_LABEL, TENDER_LABEL, actionLabel } from '../../../_lib/labels';
import { LineDerivation } from './line-derivation';

export const metadata: Metadata = { title: 'Tab' };

const LINE_STATUS: Record<'pending' | 'served' | 'voided' | 'draft', { status: StatusKey; label?: string }> = {
  draft: { status: 'draft' },
  pending: { status: 'fired', label: 'At the bar' },
  served: { status: 'poured' },
  voided: { status: 'voided' },
};

/**
 * One tab, read back exactly as it happened: lines grouped by seat with the stored price derivation
 * behind each one (docs/01 R4, "the full derivation is shown as an ordered chain"), the bills it
 * closed onto, and what happened to it in order.
 */
export default async function TabPage({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  if (!tab) notFound();
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const summary = trade.summarise(tab);
  const seats = trade.seatsFor(tab.id).filter((s) => s.status !== 'removed');
  const lines = trade.linesFor(tab.id).sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
  const orders = trade.ordersFor(tab.id);
  const bills = settlement.billsBetween(tab.businessDate, tab.businessDate).filter((b) => b.tabId === tab.id);
  const voided = lines.filter((l) => l.status === 'voided');
  const settled = sum(bills.filter((b) => b.status === 'settled').map((b) => b.totalCents));
  const showSeats = seats.length > 1;

  const groups = [
    ...seats.map((s) => ({ key: s.id, seat: s, lines: lines.filter((l) => l.tabSeatId === s.id) })),
    { key: 'shared', seat: null, lines: lines.filter((l) => l.tabSeatId === null || !seats.some((s) => s.id === l.tabSeatId)) },
  ].filter((g) => g.lines.length > 0);

  const lineIds = new Set(lines.map((l) => l.id));
  const events: { at: number; text: string; reason?: string | null }[] = [
    { at: tab.openedAt, text: `Opened by ${identity.displayName(tab.openedBy)} for ${plural(tab.guestCount, 'guest')}` },
    ...orders.filter((o) => o.firedAt).map((o) => ({ at: o.firedAt!, text: `Order ${o.orderNumber ?? ''} fired by ${identity.displayName(o.firedBy)}, ${plural(lines.filter((l) => l.orderId === o.id).length, 'line')}`.replace('  ', ' ') })),
    ...audit
      .list()
      .filter((e) => lineIds.has(e.entityId) || e.entityId === tab.id)
      .map((e) => ({ at: e.occurredAt, text: `${actionLabel(e.action)} by ${identity.displayName(e.actorStaffId)}`, reason: e.reason })),
    ...bills.filter((b) => b.settledAt).map((b) => ({ at: b.settledAt!, text: `Bill ${b.billNumber} settled by ${identity.displayName(b.settledBy)}` })),
    ...(tab.closedAt ? [{ at: tab.closedAt, text: 'Tab closed' }] : []),
  ].sort((a, b) => a.at - b.at);

  const tableLabel = summary.tableLabel;
  const isOpen = tab.status === 'open' || tab.status === 'part_settled' || tab.status === 'settling';

  return (
    <div className="flex flex-col gap-24 max-w-[1400px] mx-auto w-full pb-32">
      <div className="flex items-center justify-end">
        <ButtonLink href={isOpen ? '/console/trade/open' : '/console/trade/bills'} variant="ghost" icon={IconArrowLeft} className="-mr-12 text-ink-subtle hover:text-ink transition-colors">
          {isOpen ? 'Open tabs' : 'Bills'}
        </ButtonLink>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col desktop:flex-row items-start desktop:items-center justify-between gap-24 pb-12">
        <div className="flex flex-col gap-12 min-w-0">
          <div className="flex items-center gap-12 flex-wrap">
            <h2 className="text-[28px] font-medium text-ink tracking-tight flex flex-wrap items-center gap-10">
              {tableLabel}
              {tab.tabNumber ? <span className="font-mono tabular text-[22px] text-ink-subtle mt-1">· tab {tab.tabNumber}</span> : null}
            </h2>
            <StatusChip status={tabStatus(tab.status)} label={tab.status === 'part_settled' ? 'Part settled' : undefined} />
          </div>
          
          <div className="flex items-center gap-12 flex-wrap text-body-sm text-ink-subtle">
            <span className="flex items-center gap-6"><IconMapPin size={15} className="text-ink-muted" /> {summary.zoneName}</span>
            <span className="text-hairline/80">•</span>
            <span className="flex items-center gap-6"><IconCalendar size={15} className="text-ink-muted" /> <span className="font-mono tabular">{formatIsoDate(tab.businessDate)}</span></span>
            <span className="text-hairline/80">•</span>
            <span className="flex items-center gap-6"><IconClock size={15} className="text-ink-muted" /> <span className="font-mono tabular">{formatTime(tab.openedAt, tz)}</span></span>
            <span className="text-hairline/80">•</span>
            <span className="flex items-center gap-6"><IconUser size={15} className="text-ink-muted" /> {identity.displayName(tab.assignedTo)}</span>
            {tab.closedAt ? <><span className="text-hairline/80">•</span><span className="flex items-center gap-6">Duration: {formatElapsed(tab.closedAt - tab.openedAt)}</span></> : null}
          </div>
        </div>

        <div className="flex items-stretch gap-16 shrink-0 bg-page px-20 py-12 rounded-[16px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col items-end gap-2 pr-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">Total</span>
            <div className="font-mono text-title-md font-medium text-ink">
              <Money value={summary.total} />
            </div>
          </div>
          <div className="w-[1px] bg-hairline/60 my-2" />
          <div className="flex flex-col items-end gap-2 px-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">Settled</span>
            <div className={`font-mono text-title-md font-medium ${isPositive(settled) ? 'text-poured' : 'text-ink-muted'}`}>
              <Money value={settled} tone={isPositive(settled) ? 'poured' : 'subtle'} />
            </div>
          </div>
          <div className="w-[1px] bg-hairline/60 my-2" />
          <div className="flex flex-col items-end gap-2 pl-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">Voided</span>
            <div className={`font-mono text-title-md font-medium ${voided.length > 0 ? 'text-stop' : 'text-ink-muted'}`}>
              <Money value={sum(voided.map((l) => l.lineTotalCents))} tone={voided.length > 0 ? 'attention' : 'subtle'} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-32 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        
        {/* ── LEFT COLUMN: LINES BY SEAT ── */}
        <div className="flex flex-col gap-24">
          {groups.length === 0 ? (
            <div className="p-32 rounded-[16px] bg-page border border-hairline/60 text-center text-ink-subtle shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              Nothing has been ordered on this tab yet.
            </div>
          ) : null}
          
          {groups.map((group) => {
            const own = group.lines.filter((l) => l.status !== 'voided');
            return (
              <div key={group.key} className="overflow-hidden rounded-[16px] bg-page border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-16 border-b border-hairline/60 bg-control/20 px-20 py-16">
                  <span className="flex items-center gap-12">
                    {showSeats ? <SeatChip seat={group.seat ? group.seat.seatNo : 'shared'} label={group.seat?.label} settled={group.seat?.status === 'settled'} size="row" /> : null}
                    <span className="text-subtitle font-medium text-ink">
                      {group.seat ? (showSeats ? `Seat ${group.seat.seatNo}${group.seat.label ? `, ${group.seat.label}` : ''}` : 'Lines') : showSeats ? 'Shared' : 'Lines'}
                    </span>
                    {group.seat?.status === 'settled' ? <StatusChip status="settled" /> : null}
                  </span>
                  <div className="flex items-center gap-12 bg-page px-16 py-6 rounded-full border border-hairline/40 shadow-sm">
                    <span className="text-micro font-medium uppercase tracking-wider text-ink-subtle">Seat Total</span>
                    <span className="font-mono text-title-sm font-medium text-ink"><Money value={sum(own.map((l) => l.lineTotalCents))} /></span>
                  </div>
                </div>
                <ul className="divide-y divide-hairline/60">
                  {group.lines.map((line) => {
                    const variant = catalogue.variantById(line.productVariantId);
                    const mods = trade.modifiersFor(line.id);
                    const state = LINE_STATUS[line.status];
                    const firedAt = trade.orderFiredAt(line.orderId);
                    return (
                      <li key={line.id} className="p-20 hover:bg-control/5 transition-colors">
                        <div className="grid grid-cols-[48px_minmax(0,1fr)_auto_90px] items-baseline gap-16">
                          <span className="font-mono tabular text-body font-medium text-ink-subtle bg-control/30 px-6 py-2 rounded border border-hairline/40 text-center shadow-xs">
                            {line.qty} ×
                          </span>
                          <span className="min-w-0 flex flex-col gap-4">
                            <span className={line.status === 'voided' ? 'text-body font-medium text-ink-subtle line-through' : 'text-body font-medium text-ink'}>{variant?.name ?? 'Unknown item'}</span>
                            {mods.length > 0 ? <span className="text-body-sm text-ink-subtle">{mods.map((m) => m.name).join(', ')}</span> : null}
                            {line.note ? <span className="text-body-sm text-ink-subtle flex items-center gap-4"><IconNote size={14} className="text-ink-muted"/> {line.note}</span> : null}
                            {line.status === 'voided' ? (
                              <span className="text-body-sm text-stop bg-stop/10 px-8 py-4 rounded-md border border-red-500/20 inline-block mt-4 w-fit">
                                Voided by {identity.displayName(line.voidedBy)}
                                {line.voidedAt ? ` at ${formatTime(line.voidedAt, tz)}` : ''}: {line.voidReason}
                              </span>
                            ) : null}
                            <span className="font-mono tabular text-[11px] text-ink-muted mt-2">
                              {firedAt ? `Fired ${formatTime(firedAt, tz)}` : 'Not fired'} by {identity.displayName(line.createdBy)}
                            </span>
                          </span>
                          <StatusChip status={state.status} label={state.label} />
                          <span className="text-right">
                            <span className={`font-mono text-body font-medium ${line.status === 'voided' ? 'text-ink-muted line-through' : 'text-ink'}`}>
                               <Money value={line.lineTotalCents} currency={false} />
                            </span>
                          </span>
                        </div>
                        <div className="mt-12 pl-[64px]">
                          <LineDerivation steps={line.priceDerivation} unit={line.unitPriceCents} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT COLUMN: BILLS & ACTIVITY ── */}
        <div className="flex flex-col gap-24">
          <div className="overflow-hidden rounded-[16px] bg-page border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="px-20 py-16 border-b border-hairline/60 bg-control/20 flex items-center justify-between">
              <div className="flex items-center gap-10">
                <IconReceipt2 size={18} className="text-ink-subtle" />
                <h3 id="tab-bills" className="text-subtitle font-medium text-ink">Bills</h3>
              </div>
              <span className="font-mono text-[11px] font-medium text-ink-subtle uppercase tracking-wider">{bills.length} {bills.length === 1 ? 'Bill' : 'Bills'}</span>
            </div>
            {bills.length === 0 ? (
              <p className="p-20 text-body text-ink-muted text-center">{isOpen ? 'Nothing settled yet. Bills are closed at the counter.' : 'No bills on this tab.'}</p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {bills.map((b) => {
                  const tenders = settlement.tendersFor(b.id);
                  const seat = seats.find((s) => s.id === b.tabSeatId);
                  return (
                    <li key={b.id} className="p-16 hover:bg-control/5 transition-colors">
                      <Link href={`/console/trade/bills/${b.id}`} className="flex flex-col gap-8 rounded-sm group">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-8 text-body font-medium text-ink group-hover:text-accent transition-colors">
                            {seat && showSeats ? <SeatChip seat={seat.seatNo} size="dense" /> : null}
                            Bill <span className="font-mono tabular">{b.billNumber}</span>
                          </span>
                          <span className="font-mono font-medium text-ink group-hover:text-accent transition-colors"><Money value={b.totalCents} /></span>
                        </div>
                        <div className="flex items-center justify-between text-body-sm">
                           <span className="text-ink-muted bg-control/40 px-6 py-2 rounded text-[11px] uppercase tracking-wider border border-hairline/40">{SCOPE_LABEL[b.scope].toLowerCase()}</span>
                           <span className="text-ink-subtle text-right">
                             {tenders.map((t) => `${TENDER_LABEL[t.kind]}${t.reference ? ` ref ${t.reference}` : ''}`).join(', ')}
                             {b.settledAt ? ` · ${formatTime(b.settledAt, tz)}` : ''}
                           </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="overflow-hidden rounded-[16px] bg-page border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="px-20 py-16 border-b border-hairline/60 bg-control/20 flex items-center gap-10">
              <IconHistory size={18} className="text-ink-subtle" />
              <h3 id="tab-activity" className="text-subtitle font-medium text-ink">What happened</h3>
            </div>
            <div className="p-24 pl-32">
              <ol className="relative flex flex-col gap-24 border-l-[2px] border-hairline/60 pl-24 ml-4">
                {events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="relative">
                    <span aria-hidden="true" className="absolute -left-[32px] top-[4px] size-[14px] rounded-full bg-page border-[2px] border-hairline/80 ring-4 ring-page shadow-sm" />
                    <span className="block font-mono tabular text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{formatTime(e.at, tz)}</span>
                    <span className="block text-body-sm font-medium text-ink mt-2">{e.text}</span>
                    {e.reason ? <span className="block text-micro text-ink-muted mt-2 p-8 bg-control/20 rounded border border-hairline/40">{e.reason}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function tabStatus(status: string): StatusKey {
  if (status === 'settled' || status === 'part_settled') return 'settled';
  if (status === 'voided') return 'voided';
  if (status === 'merged_into') return 'cancelled';
  return 'open';
}
