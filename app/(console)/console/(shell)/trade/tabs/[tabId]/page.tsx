import { formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { isPositive, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { type StatusKey, StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft } from '@tabler/icons-react';
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
    <>
      <div className="mb-16">
        <ButtonLink href={isOpen ? '/console/trade/open' : '/console/trade/bills'} variant="ghost" icon={IconArrowLeft} className="-ml-12">
          {isOpen ? 'Open tabs' : 'Bills'}
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-24 border-b border-hairline pb-20">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-12 text-title text-ink">
            {tableLabel}
            {tab.tabNumber ? <span className="font-mono tabular text-num-lg text-ink-subtle">tab {tab.tabNumber}</span> : null}
            <StatusChip status={tabStatus(tab.status)} label={tab.status === 'part_settled' ? 'Part settled' : undefined} />
          </h2>
          <p className="mt-4 text-body text-ink-muted">
            {summary.zoneName} · business date <span className="font-mono tabular text-num-sm">{formatIsoDate(tab.businessDate)}</span> · opened {formatTime(tab.openedAt, tz)} · with {identity.displayName(tab.assignedTo)}
            {tab.closedAt ? ` · open for ${formatElapsed(tab.closedAt - tab.openedAt)}` : ''}
          </p>
        </div>
        <dl className="flex gap-32">
          <Figure label="Total">
            <Money value={summary.total} size="num-lg" />
          </Figure>
          <Figure label="Settled">
            <Money value={settled} size="num-lg" tone={isPositive(settled) ? 'default' : 'subtle'} />
          </Figure>
          <Figure label="Voided">
            <Money value={sum(voided.map((l) => l.lineTotalCents))} size="num-lg" tone={voided.length > 0 ? 'attention' : 'subtle'} />
          </Figure>
        </dl>
      </div>

      <div className="mt-24 grid grid-cols-1 gap-40 desktop:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <RevealSection aria-label="Lines">
          {groups.length === 0 ? <p className="py-24 text-body text-ink-muted">Nothing has been ordered on this tab yet.</p> : null}
          {groups.map((group) => {
            const own = group.lines.filter((l) => l.status !== 'voided');
            return (
              <div key={group.key} className="mb-24">
                <div className="flex items-center justify-between gap-16 border-b border-hairline pb-8">
                  <span className="flex items-center gap-8">
                    {showSeats ? <SeatChip seat={group.seat ? group.seat.seatNo : 'shared'} label={group.seat?.label} settled={group.seat?.status === 'settled'} size="row" /> : null}
                    <span className="text-subtitle text-ink">
                      {group.seat ? (showSeats ? `Seat ${group.seat.seatNo}${group.seat.label ? `, ${group.seat.label}` : ''}` : 'Lines') : showSeats ? 'Shared' : 'Lines'}
                    </span>
                    {group.seat?.status === 'settled' ? <StatusChip status="settled" /> : null}
                  </span>
                  <Money value={sum(own.map((l) => l.lineTotalCents))} tone="muted" />
                </div>
                <ul>
                  {group.lines.map((line) => {
                    const variant = catalogue.variantById(line.productVariantId);
                    const mods = trade.modifiersFor(line.id);
                    const state = LINE_STATUS[line.status];
                    const firedAt = trade.orderFiredAt(line.orderId);
                    return (
                      <li key={line.id} className="border-b border-rule py-12">
                        <div className="grid grid-cols-[48px_minmax(0,1fr)_auto_120px] items-baseline gap-16">
                          <span className="font-mono tabular text-num text-ink-muted">{line.qty} ×</span>
                          <span className="min-w-0">
                            <span className={line.status === 'voided' ? 'text-body text-ink-subtle line-through' : 'text-body text-ink'}>{variant?.name ?? 'Unknown item'}</span>
                            {mods.length > 0 ? <span className="block text-body-sm text-ink-muted">{mods.map((m) => m.name).join(', ')}</span> : null}
                            {line.note ? <span className="block text-body-sm text-ink-muted">Note: {line.note}</span> : null}
                            {line.status === 'voided' ? (
                              <span className="block text-body-sm text-stop">
                                Voided by {identity.displayName(line.voidedBy)}
                                {line.voidedAt ? ` at ${formatTime(line.voidedAt, tz)}` : ''}: {line.voidReason}
                              </span>
                            ) : null}
                            <span className="block font-mono tabular text-num-sm text-ink-subtle">
                              {firedAt ? `Fired ${formatTime(firedAt, tz)}` : 'Not fired'} by {identity.displayName(line.createdBy)}
                            </span>
                          </span>
                          <StatusChip status={state.status} label={state.label} />
                          <span className="text-right">
                            <Money value={line.lineTotalCents} tone={line.status === 'voided' ? 'subtle' : 'default'} currency={false} />
                          </span>
                        </div>
                        <LineDerivation steps={line.priceDerivation} unit={line.unitPriceCents} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </RevealSection>

        <div className="flex flex-col gap-32">
          <RevealSection aria-labelledby="tab-bills">
            <h3 id="tab-bills" className="border-b border-hairline pb-8 text-subtitle text-ink">
              Bills
            </h3>
            {bills.length === 0 ? (
              <p className="py-16 text-body text-ink-muted">{isOpen ? 'Nothing settled yet. Bills are closed at the counter.' : 'No bills on this tab.'}</p>
            ) : (
              <ul>
                {bills.map((b) => {
                  const tenders = settlement.tendersFor(b.id);
                  const seat = seats.find((s) => s.id === b.tabSeatId);
                  return (
                    <li key={b.id} className="border-b border-rule py-12">
                      <Link href={`/console/trade/bills/${b.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-16 gap-y-4 rounded-sm hover:text-accent-text">
                        <span className="flex items-center gap-8 text-body text-ink">
                          {seat && showSeats ? <SeatChip seat={seat.seatNo} size="dense" /> : null}
                          Bill <span className="font-mono tabular text-num">{b.billNumber}</span>
                          <span className="text-ink-subtle">{SCOPE_LABEL[b.scope].toLowerCase()}</span>
                        </span>
                        <Money value={b.totalCents} />
                        <span className="col-span-2 text-body-sm text-ink-muted">
                          {tenders.map((t) => `${TENDER_LABEL[t.kind]}${t.reference ? ` ref ${t.reference}` : ''}`).join(', ')}
                          {b.settledAt ? ` · ${formatTime(b.settledAt, tz)}` : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </RevealSection>

          <RevealSection aria-labelledby="tab-activity">
            <h3 id="tab-activity" className="border-b border-hairline pb-8 text-subtitle text-ink">
              What happened
            </h3>
            <ol className="relative mt-12 flex flex-col gap-12 border-l border-hairline pl-16">
              {events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="relative">
                  <span aria-hidden="true" className="absolute -left-[20px] top-[7px] size-dot rounded-dot bg-ink-subtle" />
                  <span className="block font-mono tabular text-num-sm text-ink-subtle">{formatTime(e.at, tz)}</span>
                  <span className="block text-body text-ink">{e.text}</span>
                  {e.reason ? <span className="block text-body-sm text-ink-muted">{e.reason}</span> : null}
                </li>
              ))}
            </ol>
          </RevealSection>
        </div>
      </div>
    </>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-4">
      <dt className="text-label text-ink-subtle">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function tabStatus(status: string): StatusKey {
  if (status === 'settled' || status === 'part_settled') return 'settled';
  if (status === 'voided') return 'voided';
  if (status === 'merged_into') return 'cancelled';
  return 'open';
}
