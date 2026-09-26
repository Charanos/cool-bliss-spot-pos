import { formatDateTime, formatIsoDate, formatQty, formatTime, plural } from '@bliss/shared/format';
import { compare, isNegative, isPositive, isZero } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Callout, DetailHeader, KeyValueList, MetaRow, Totals } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconCalendar, IconCash, IconClock, IconMapPin, IconPrinter, IconReceipt, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as corrections from '@/modules/settlement/corrections';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { SCOPE_LABEL, TENDER_LABEL } from '../../../_lib/labels';
import { BillActions } from './bill-actions';

export async function generateMetadata({ params }: { params: Promise<{ billId: string }> }): Promise<Metadata> {
  const bill = settlement.billById((await params).billId);
  return { title: bill ? `Bill ${bill.billNumber}` : 'Bill' };
}

/**
 * One bill as printed: the lines with their seats, the totals, and each tender exactly as the
 * cashier recorded it. A tender is what the cashier saw; nothing here claims a payment went through.
 */
export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const bill = settlement.billById(billId);
  if (!bill) notFound();
  const tz = identity.outlet().timezone;
  const actor = await identity.currentConsoleActor();
  const lines = settlement.billLines(bill.id);
  const tenders = settlement.tendersFor(bill.id);
  const paid = tenders.filter((t) => !isNegative(t.amountCents));
  const refunds = tenders.filter((t) => isNegative(t.amountCents));
  const refunded = settlement.refundedLineIds(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const serviceTable = tab ? trade.tableById(tab.serviceTableId) : null;
  const zone = tab ? trade.zoneById(tab.zoneId) : null;
  const table = tab ? (serviceTable?.label ?? tab.name ?? 'Walk up') : 'Quick sale';
  const drawer = settlement.drawerForBill(bill);
  const drawerDevice = drawer ? identity.devices().find((d) => d.id === drawer.deviceId) : null;
  const canCorrect = identity.can(actor.staffId, 'refund.approve');
  const devices = new Map(identity.devices().map((d) => [d.id, d.label]));
  const openDrawers = canCorrect
    ? corrections.openDrawers().map((d) => ({ value: d.id, label: `${devices.get(d.deviceId) ?? 'A counter'}, opened by ${identity.displayName(d.openedBy)}` }))
    : [];
  const mainTender = [...paid].sort((a, b) => compare(b.amountCents, a.amountCents))[0]?.kind;
  const showSeats = lines.some((l) => l.seatNo !== null) && new Set(lines.map((l) => l.seatNo)).size > 1;
  const title = `Bill ${bill.billNumber}`;

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/trade/bills', label: 'Bills' }}
        title={title}
        status={
          bill.status === 'settled' ? (
            <StatusChip status="settled" />
          ) : bill.status === 'voided' ? (
            <StatusChip status="voided" />
          ) : (
            <ToneChip tone="low">{bill.status === 'partially_refunded' ? 'Part refunded' : bill.status === 'refunded' ? 'Refunded' : 'Open'}</ToneChip>
          )
        }
        meta={
          <MetaRow
            items={[
              {
                icon: IconMapPin,
                value: tab ? (
                  <EntityLink kind="tab" id={tab.id} muted>
                    {zone ? `${table}, ${zone.name}` : table}
                  </EntityLink>
                ) : (
                  table
                ),
              },
              { icon: IconReceipt, value: SCOPE_LABEL[bill.scope] },
              { icon: IconCalendar, value: formatIsoDate(bill.businessDate) },
              bill.settledAt ? { icon: IconClock, value: `Settled ${formatTime(bill.settledAt, tz)}` } : null,
              bill.settledBy
                ? {
                    icon: IconUser,
                    value: (
                      <EntityLink kind="staff" id={bill.settledBy} muted>
                        {identity.displayName(bill.settledBy)}
                      </EntityLink>
                    ),
                  }
                : null,
              drawer
                ? {
                    icon: IconCash,
                    value: (
                      <EntityLink kind="drawer" id={drawer.id} muted>
                        {drawerDevice ? `${drawerDevice.label} drawer` : 'The drawer'}
                      </EntityLink>
                    ),
                  }
                : null,
            ]}
          />
        }
        actions={
          <>
            <ButtonLink href={`/print/bill/${bill.id}`} target="_blank" variant="secondary" icon={IconPrinter}>
              Print the bill
            </ButtonLink>
            <BillActions
              billId={bill.id}
              billNumber={bill.billNumber}
              voidable={canCorrect && bill.status === 'settled' && bill.scope !== 'even_split'}
              refundable={canCorrect && (bill.status === 'settled' || bill.status === 'partially_refunded')}
              lines={lines.map((l) => ({ id: l.id, description: l.description, totalCents: l.lineTotalCents, refunded: refunded.has(l.id) }))}
              drawers={openDrawers}
              paidWith={mainTender === 'mpesa' || mainTender === 'card' ? mainTender : 'cash'}
            />
          </>
        }
      />

      {bill.status === 'voided' ? (
        <Callout tone="stop" title={`Voided by ${identity.displayName(bill.voidedBy ?? null)}${bill.voidedAt ? `, ${formatDateTime(bill.voidedAt, tz)}` : ''}`}>
          {bill.voidReason ? `${bill.voidReason.replace(/\.$/, '')}. ` : ''}
          {tab ? 'Its lines went back on the tab to be settled again. It counts in no total.' : 'The sale did not count, and its stock went back on the shelf.'}
        </Callout>
      ) : refunds.length > 0 ? (
        <Callout tone="low" title={bill.status === 'refunded' ? 'Refunded in full' : 'Part refunded'}>
          <Money value={bill.refundedCents ?? bill.totalCents} size="num-sm" /> given back. The bill counts at what was kept.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card aria-labelledby="bill-lines">
          <CardHeader band title="Lines" titleId="bill-lines" level="h2" subtitle={plural(lines.length, 'line')} />
          <CardBody flush>
            <table className="w-full border-collapse">
              <caption className="sr-only">Lines on {title}</caption>
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="px-20 py-12 text-left text-label text-ink-subtle">
                    Item
                  </th>
                  <th scope="col" className="w-[64px] px-12 py-12 text-right text-label text-ink-subtle">
                    Qty
                  </th>
                  <th scope="col" className="w-[112px] px-12 py-12 text-right text-label text-ink-subtle">
                    Each
                  </th>
                  <th scope="col" className="w-[128px] px-20 py-12 text-right text-label text-ink-subtle">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule last:border-b-0">
                    <td className="px-20 py-12">
                      <span className="flex min-w-0 items-center gap-8">
                        {showSeats ? <SeatChip seat={l.seatNo ?? 'shared'} label={l.seatLabel} size="dense" /> : null}
                        <span className={refunded.has(l.id) ? 'truncate text-ui text-ink-subtle line-through' : 'truncate text-ui text-ink'}>{l.description}</span>
                        {refunded.has(l.id) ? <ToneChip tone="low">Refunded</ToneChip> : null}
                      </span>
                    </td>
                    <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(l.qty)}</td>
                    <td className="px-12 py-12 text-right">
                      <Money value={l.unitPriceCents} currency={false} size="num-md" tone="muted" />
                    </td>
                    <td className="px-20 py-12 text-right">
                      <Money value={l.lineTotalCents} currency={false} size="num-md" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
          <footer className="flex justify-end border-t border-edge px-20 py-16 card-band">
            <Totals
              className="w-full max-w-totals"
              items={[
                { label: 'Subtotal', value: <Money value={bill.subtotalCents} size="num-md" tone="muted" /> },
                isPositive(bill.discountCents) ? { label: 'Discount', value: <Money value={bill.discountCents} size="num-md" tone="attention" /> } : null,
                { label: 'VAT included', value: <Money value={bill.taxCents} size="num-md" tone="muted" /> },
                !isZero(bill.roundingCents) ? { label: 'Rounding', value: <Money value={bill.roundingCents} size="num-md" tone="muted" /> } : null,
                bill.refundedCents && isPositive(bill.refundedCents) ? { label: 'Given back', value: <Money value={bill.refundedCents} size="num-md" tone="attention" /> } : null,
              ]}
              total={bill.refundedCents && isPositive(bill.refundedCents) ? { label: 'Kept', value: <Money value={settlement.billNet(bill)} size="num-lg" /> } : { label: 'Total', value: <Money value={bill.totalCents} size="num-lg" /> }}
            />
          </footer>
        </Card>

        <Card aria-labelledby="bill-tenders">
          <CardHeader band title="Tenders" titleId="bill-tenders" level="h2" subtitle="As the cashier recorded them. Bliss does not confirm a payment with any provider." />
          {tenders.length === 0 ? (
            <CardBody className="pt-16">
              <p className="text-body-sm text-ink-muted">No tender was recorded on this bill.</p>
            </CardBody>
          ) : (
            <ul className="flex flex-col">
              {[...paid, ...refunds].map((t) => (
                <li key={t.id} className="flex flex-col gap-12 border-b border-rule px-20 py-16 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-12">
                    <h3 className="text-title-card text-ink">{isNegative(t.amountCents) ? `Refund, ${TENDER_LABEL[t.kind].toLowerCase()}` : TENDER_LABEL[t.kind]}</h3>
                    <Money value={t.amountCents} size="num-lg" tone={isNegative(t.amountCents) ? 'attention' : 'default'} />
                  </div>
                  <KeyValueList
                    layout="inline"
                    items={[
                      ...(t.reference ? [{ label: 'Reference', value: t.reference, mono: true }] : []),
                      ...(t.tenderedCents ? [{ label: 'Handed over', value: <Money value={t.tenderedCents} size="num-md" /> }] : []),
                      ...(t.changeCents && isPositive(t.changeCents) ? [{ label: 'Change given', value: <Money value={t.changeCents} size="num-md" /> }] : []),
                      ...(t.refundOfLineIds ? [{ label: 'For', value: lines.filter((l) => t.refundOfLineIds?.includes(l.id)).map((l) => l.description).join(', ') }] : []),
                      { label: 'Recorded by', value: `${identity.displayName(t.createdBy)}, ${formatDateTime(t.createdAt, tz)}` },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
