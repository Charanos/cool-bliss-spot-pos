import { formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { isPositive, sum } from '@bliss/shared/money';
import { canSignInOn } from '@bliss/shared/identity';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { type StatusKey, StatusChip } from '@bliss/ui/components/status';
import { IconCalendar, IconClock, IconHourglass, IconMapPin, IconPrinter, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as audit from '@/modules/audit/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { SCOPE_LABEL, TENDER_LABEL, actionLabel } from '../../../_lib/labels';
import { LineDerivation } from './line-derivation';
import { LineVoid, TabActions } from './tab-actions';

export async function generateMetadata({ params }: { params: Promise<{ tabId: string }> }): Promise<Metadata> {
  const tab = trade.tabById((await params).tabId);
  return { title: tab ? tabTitle(trade.summarise(tab).tableLabel, tab.tabNumber) : 'Tab' };
}

const LINE_STATUS: Record<'pending' | 'served' | 'voided' | 'draft', { status: StatusKey; label?: string }> = {
  draft: { status: 'draft', label: 'Not fired' },
  pending: { status: 'fired', label: 'At the bar' },
  served: { status: 'poured' },
  voided: { status: 'voided' },
};

function tabTitle(table: string, number: number | null) {
  return number ? `${table}, tab ${number}` : table;
}

/**
 * One tab, read back exactly as it happened: lines grouped by seat with the stored price derivation
 * behind each one (docs/01 R4, "the full derivation is shown as an ordered chain"), the bills it
 * closed onto, and what happened to it in order.
 */
export default async function TabPage({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = await params;
  const tab = trade.tabById(tabId);
  if (!tab) notFound();
  const tz = identity.outlet().timezone;
  const summary = trade.summarise(tab);
  const seats = trade.seatsFor(tab.id).filter((s) => s.status !== 'removed');
  const lines = trade.linesFor(tab.id).sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
  const orders = trade.ordersFor(tab.id);
  const actor = await identity.currentConsoleActor();
  const allBills = settlement.allBillsForTab(tab.id).sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0));
  const bills = allBills.filter((b) => b.status !== 'voided');
  const voided = lines.filter((l) => l.status === 'voided');
  const settled = sum(bills.filter((b) => b.status !== 'open').map(settlement.billNet));
  const showSeats = seats.length > 1;
  const title = tabTitle(summary.tableLabel, tab.tabNumber);
  const isOpen = tab.status === 'open' || tab.status === 'part_settled' || tab.status === 'settling';
  const canManage = isOpen && identity.can(actor.staffId, 'void.approve');
  const billed = settlement.billedLineIds();
  const unbilled = lines.filter((l) => l.status !== 'voided' && !billed.has(l.id));
  const busy = new Set(trade.openTabs().map((x) => x.tab.serviceTableId));
  const freeTables = canManage
    ? trade
        .tables()
        .filter((t) => t.status !== 'out_of_service' && t.id !== tab.serviceTableId && !busy.has(t.id))
        .map((t) => ({ value: t.id, label: `${t.label}, ${trade.zoneById(t.zoneId)?.name ?? ''}`.replace(/, $/, '') }))
    : [];
  const waiters = canManage
    ? identity
        .staffList()
        .filter((m) => m.employmentStatus === 'active' && canSignInOn('floor', identity.roleFor(m.id)?.key))
        .map((m) => ({ value: m.id, label: m.displayName }))
    : [];
  const orderName = (id: string) => {
    const n = orders.find((o) => o.id === id)?.orderNumber;
    return n ? `order ${n}` : 'an order';
  };

  const groups = [
    ...seats.map((s) => ({ key: s.id, seat: s, lines: lines.filter((l) => l.tabSeatId === s.id) })),
    { key: 'shared', seat: null, lines: lines.filter((l) => l.tabSeatId === null || !seats.some((s) => s.id === l.tabSeatId)) },
  ].filter((g) => g.lines.length > 0);

  // Lines poured together, by the same person, read as one event.
  const poured = new Map<string, { at: number; orderId: string; by: string; count: number }>();
  for (const l of lines) {
    if (!l.servedAt) continue;
    const key = `${l.servedAt}:${l.orderId}:${l.servedBy}`;
    const entry = poured.get(key) ?? { at: l.servedAt, orderId: l.orderId, by: l.servedBy ?? '', count: 0 };
    entry.count += 1;
    poured.set(key, entry);
  }

  const lineIds = new Set(lines.map((l) => l.id));
  const events: { at: number; text: string; reason?: string | null; tone?: 'stop' | 'poured' }[] = [
    { at: tab.openedAt, text: `Opened by ${identity.displayName(tab.openedBy)} for ${plural(tab.guestCount, 'guest')}` },
    ...orders
      .filter((o) => o.firedAt)
      .map((o) => ({ at: o.firedAt!, text: `${o.orderNumber ? `Order ${o.orderNumber}` : 'An order'} fired by ${identity.displayName(o.firedBy)}, ${plural(lines.filter((l) => l.orderId === o.id).length, 'line')}` })),
    ...audit
      .list()
      .filter((e) => lineIds.has(e.entityId) || e.entityId === tab.id)
      .map((e) => ({ at: e.occurredAt, text: `${actionLabel(e.action)} by ${identity.displayName(e.actorStaffId)}`, reason: e.reason, tone: e.action.includes('void') ? ('stop' as const) : undefined })),
    ...[...poured.values()].map((p) => ({ at: p.at, text: `${plural(p.count, 'line')} on ${orderName(p.orderId)} poured by ${identity.displayName(p.by)}`, tone: 'poured' as const })),
    ...orders.filter((o) => o.deliveredAt).map((o) => ({ at: o.deliveredAt!, text: `${o.orderNumber ? `Order ${o.orderNumber}` : 'An order'} taken to the table by ${identity.displayName(o.deliveredBy)}` })),
    ...(tab.billAskedAt ? [{ at: tab.billAskedAt, text: `Bill asked for by ${identity.displayName(tab.billAskedBy)}` }] : []),
    ...allBills.filter((b) => b.settledAt).map((b) => ({ at: b.settledAt!, text: `Bill ${b.billNumber} settled by ${identity.displayName(b.settledBy)}`, tone: 'poured' as const })),
    ...allBills.filter((b) => b.voidedAt).map((b) => ({ at: b.voidedAt!, text: `Bill ${b.billNumber} voided by ${identity.displayName(b.voidedBy)}, its lines back on the tab`, reason: b.voidReason ?? null, tone: 'stop' as const })),
    ...(tab.closedAt ? [{ at: tab.closedAt, text: 'Tab closed' }] : []),
  ].sort((a, b) => a.at - b.at);

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={title} />
      <DetailHeader
        back={isOpen ? { href: '/console/trade/open', label: 'Open tabs' } : { href: '/console/trade/bills', label: 'Bills' }}
        title={title}
        status={<StatusChip status={tabStatus(tab.status)} label={tab.status === 'part_settled' ? 'Part settled' : tab.status === 'merged_into' ? 'Merged' : undefined} />}
        meta={
          <MetaRow
            items={[
              { icon: IconMapPin, value: <EntityLink kind="zone" id={tab.zoneId} muted>{summary.zoneName}</EntityLink> },
              { icon: IconCalendar, value: formatIsoDate(tab.businessDate) },
              { icon: IconClock, value: `Opened ${formatTime(tab.openedAt, tz)}` },
              { icon: IconUser, value: <EntityLink kind="staff" id={tab.assignedTo} muted>{identity.displayName(tab.assignedTo)}</EntityLink> },
              tab.closedAt ? { icon: IconHourglass, value: `Open for ${formatElapsed(tab.closedAt - tab.openedAt)}` } : null,
            ]}
          />
        }
        actions={
          isOpen ? (
            <>
              <ButtonLink href={`/print/tab/${tab.id}`} target="_blank" variant="secondary" icon={IconPrinter}>
                Print the bill
              </ButtonLink>
              {canManage ? <TabActions tabId={tab.id} title={title} freeTables={freeTables} waiters={waiters} assignedTo={tab.assignedTo} unbilled={unbilled.length} /> : null}
            </>
          ) : null
        }
      />

      <MetricGrid columns={3}>
        <Metric label="Tab total" value={<Money value={summary.total} size="num-kpi" />} detail={plural(lines.length - voided.length, 'line')} />
        <Metric label="Settled" tone={isPositive(settled) ? 'poured' : 'default'} value={<Money value={settled} size="num-kpi" />} detail={bills.length > 0 ? `On ${plural(bills.length, 'bill')}` : 'Nothing settled yet'} />
        <Metric
          label="Voided"
          tone={voided.length > 0 ? 'stop' : 'default'}
          value={<Money value={sum(voided.map((l) => l.lineTotalCents))} size="num-kpi" />}
          detail={voided.length > 0 ? plural(voided.length, 'line') : 'Nothing was voided'}
        />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-24">
          {groups.length === 0 ? (
            <Card>
              <CardBody className="pt-20">
                <p className="text-ui text-ink-muted">Nothing has been ordered on this tab yet.</p>
              </CardBody>
            </Card>
          ) : null}

          {groups.map((group) => {
            const own = group.lines.filter((l) => l.status !== 'voided');
            const heading = group.seat ? (showSeats ? `Seat ${group.seat.seatNo}${group.seat.label ? `, ${group.seat.label}` : ''}` : 'Lines') : showSeats ? 'Shared' : 'Lines';
            return (
              <Card key={group.key} aria-labelledby={`seat-${group.key}`}>
                <CardHeader
                  band
                  level="h2"
                  titleId={`seat-${group.key}`}
                  icon={showSeats ? <SeatChip seat={group.seat ? group.seat.seatNo : 'shared'} label={group.seat?.label} settled={group.seat?.status === 'settled'} size="dense" /> : undefined}
                  title={heading}
                  meta={group.seat?.status === 'settled' ? <StatusChip status="settled" /> : null}
                  subtitle={plural(own.length, 'line')}
                  actions={<Money value={sum(own.map((l) => l.lineTotalCents))} size="num-md" />}
                />
                <ul className="flex flex-col">
                  {group.lines.map((line) => {
                    const variant = catalogue.variantById(line.productVariantId);
                    const mods = trade.modifiersFor(line.id);
                    const state = LINE_STATUS[line.status];
                    const firedAt = trade.orderFiredAt(line.orderId);
                    const gone = line.status === 'voided';
                    return (
                      <li key={line.id} className="flex flex-col gap-8 border-b border-rule px-20 py-16 last:border-b-0">
                        <div className="grid grid-cols-[40px_minmax(0,1fr)_auto_112px_32px] items-baseline gap-16">
                          <span className="font-mono tabular text-num-md text-ink-muted">{line.qty} ×</span>
                          <span className="flex min-w-0 flex-col gap-2">
                            <span className={gone ? 'text-ui text-ink-subtle line-through' : 'text-ui font-medium text-ink'}>{variant?.name ?? 'Item no longer on the menu'}</span>
                            {mods.length > 0 ? <span className="text-body-sm text-ink-muted">{mods.map((m) => m.name).join(', ')}</span> : null}
                            {line.note ? <span className="text-body-sm text-ink-muted">Note: {line.note}</span> : null}
                            <span className="text-body-sm text-ink-subtle">
                              {firedAt ? `Fired ${formatTime(firedAt, tz)}` : 'Not fired'} by {identity.displayName(line.createdBy)}
                            </span>
                            {gone ? (
                              <span className="text-body-sm text-stop">
                                Voided by {identity.displayName(line.voidedBy)}
                                {line.voidedAt ? ` at ${formatTime(line.voidedAt, tz)}` : ''}
                                {line.voidReason ? `: ${line.voidReason}` : ''}
                              </span>
                            ) : null}
                          </span>
                          <StatusChip status={state.status} label={state.label} />
                          <span className="text-right">
                            <Money value={line.lineTotalCents} currency={false} size="num-md" tone={gone ? 'subtle' : 'default'} className={gone ? 'line-through' : undefined} />
                          </span>
                          <span className="self-center">{canManage && !gone && !billed.has(line.id) ? <LineVoid lineId={line.id} name={variant?.name ?? 'this line'} /> : null}</span>
                        </div>
                        <div className="pl-56">
                          <LineDerivation steps={line.priceDerivation} unit={line.unitPriceCents} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="tab-bills">
            <CardHeader band level="h2" titleId="tab-bills" title="Bills" subtitle={allBills.length > 0 ? plural(bills.length, 'bill') + (allBills.length > bills.length ? `, ${allBills.length - bills.length} voided` : '') : undefined} />
            {allBills.length === 0 ? (
              <CardBody className="pt-16">
                <p className="text-body-sm text-ink-muted">{isOpen ? 'Nothing settled yet. Bills are settled at the counter.' : 'No bill was settled on this tab.'}</p>
              </CardBody>
            ) : (
              <ul className="flex flex-col">
                {allBills.map((b) => {
                  const tenders = settlement.tendersFor(b.id).filter((t) => isPositive(t.amountCents));
                  const seat = seats.find((s) => s.id === b.tabSeatId);
                  return (
                    <li key={b.id} className="relative flex flex-col gap-4 border-b border-rule px-20 py-12 transition-hover last:border-b-0 hover:bg-band">
                      <div className="flex items-baseline justify-between gap-12">
                        <Link href={`/console/trade/bills/${b.id}`} className="link-stretched inline-flex items-center gap-8 rounded-sm text-ui font-medium text-ink">
                          {seat && showSeats ? <SeatChip seat={seat.seatNo} size="dense" /> : null}
                          Bill <span className="font-mono tabular">{b.billNumber}</span>
                        </Link>
                        <Money value={b.totalCents} size="num-md" tone={b.status === 'voided' ? 'subtle' : 'default'} className={b.status === 'voided' ? 'line-through' : undefined} />
                      </div>
                      <p className="flex items-baseline justify-between gap-12 text-body-sm text-ink-muted">
                        <span>{b.status === 'voided' ? 'Voided' : b.status === 'refunded' ? 'Refunded' : b.status === 'partially_refunded' ? 'Part refunded' : SCOPE_LABEL[b.scope]}</span>
                        <span className="truncate text-right">
                          {tenders.map((t) => TENDER_LABEL[t.kind]).join(' and ') || 'No tender'}
                          {b.settledAt ? `, ${formatTime(b.settledAt, tz)}` : ''}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card aria-labelledby="tab-activity">
            <CardHeader band level="h2" titleId="tab-activity" title="What happened" subtitle="In order, from open to close" />
            <CardBody className="pt-16">
              <LedgerList label="Tab activity">
                {events.map((e, i) => (
                  <LedgerItem key={`${e.at}-${i}`} tone={e.tone}>
                    <span className="block font-mono tabular text-num-sm text-ink-subtle">{formatTime(e.at, tz)}</span>
                    <span className="block text-body-sm text-ink">{e.text}</span>
                    {e.reason ? <span className="block text-body-sm text-ink-muted">Reason: {e.reason}</span> : null}
                  </LedgerItem>
                ))}
              </LedgerList>
            </CardBody>
          </Card>
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
