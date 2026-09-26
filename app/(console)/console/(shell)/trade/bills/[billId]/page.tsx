import { formatDateTime, formatIsoDate, formatQty, formatTime, plural } from '@bliss/shared/format';
import { isPositive, isZero } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { DetailHeader, KeyValueList, MetaRow, Totals } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconCalendar, IconClock, IconMapPin, IconPrinter, IconReceipt, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { SCOPE_LABEL, TENDER_LABEL } from '../../../_lib/labels';

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
  const lines = settlement.billLines(bill.id);
  const tenders = settlement.tendersFor(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const table = tab ? (trade.tableById(tab.serviceTableId)?.label ?? tab.name ?? 'Walk up') : 'Quick sale';
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
              { icon: IconMapPin, value: table },
              { icon: IconReceipt, value: SCOPE_LABEL[bill.scope] },
              { icon: IconCalendar, value: formatIsoDate(bill.businessDate) },
              bill.settledAt ? { icon: IconClock, value: `Settled ${formatTime(bill.settledAt, tz)}` } : null,
              bill.settledBy ? { icon: IconUser, value: identity.displayName(bill.settledBy) } : null,
            ]}
          />
        }
        actions={
          <>
            {tab ? (
              <ButtonLink href={`/console/trade/tabs/${tab.id}`} variant="secondary" icon={IconReceipt}>
                Open the tab
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/print/bill/${bill.id}`} target="_blank" variant="secondary" icon={IconPrinter}>
              Print the bill
            </ButtonLink>
          </>
        }
      />

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
                        <span className="truncate text-ui text-ink">{l.description}</span>
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
              ]}
              total={{ label: 'Total', value: <Money value={bill.totalCents} size="num-lg" /> }}
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
              {tenders.map((t) => (
                <li key={t.id} className="flex flex-col gap-12 border-b border-rule px-20 py-16 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-12">
                    <h3 className="text-title-card text-ink">{TENDER_LABEL[t.kind]}</h3>
                    <Money value={t.amountCents} size="num-lg" />
                  </div>
                  <KeyValueList
                    layout="inline"
                    items={[
                      ...(t.reference ? [{ label: 'Reference', value: t.reference, mono: true }] : []),
                      ...(t.tenderedCents ? [{ label: 'Handed over', value: <Money value={t.tenderedCents} size="num-md" /> }] : []),
                      ...(t.changeCents && isPositive(t.changeCents) ? [{ label: 'Change given', value: <Money value={t.changeCents} size="num-md" /> }] : []),
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
