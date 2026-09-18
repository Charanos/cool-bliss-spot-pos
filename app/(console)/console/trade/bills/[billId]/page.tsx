import { formatDateTime, formatIsoDate, formatQty } from '@bliss/shared/format';
import { isPositive, isZero } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft, IconReceipt } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { SCOPE_LABEL, TENDER_LABEL } from '../../../_lib/labels';

export const metadata: Metadata = { title: 'Bill' };

/**
 * One bill as printed: lines with their seats, the totals, and each tender row exactly as recorded.
 * A tender row is what the cashier observed; nothing here claims a payment went through.
 */
export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const bill = settlement.billById(billId);
  if (!bill) notFound();
  const tz = identity.outlet().timezone;
  const lines = settlement.billLines(bill.id);
  const tenders = settlement.tendersFor(bill.id);
  const tab = bill.tabId ? trade.tabById(bill.tabId) : null;
  const table = tab ? (trade.tableById(tab.serviceTableId)?.label ?? tab.name ?? 'Walk up') : null;
  const showSeats = lines.some((l) => l.seatNo !== null) && new Set(lines.map((l) => l.seatNo)).size > 1;

  return (
    <>
      <div className="mb-16 flex flex-wrap items-center justify-between gap-16">
        <ButtonLink href="/console/trade/bills" variant="ghost" icon={IconArrowLeft} className="-ml-12">
          Bills
        </ButtonLink>
        {tab ? (
          <ButtonLink href={`/console/trade/tabs/${tab.id}`} variant="secondary" icon={IconReceipt}>
            Open the tab
          </ButtonLink>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-40 desktop:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <RevealSection aria-labelledby="bill-title">
          <div className="border-b border-hairline pb-16">
            <h2 id="bill-title" className="flex flex-wrap items-center gap-12 text-title text-ink">
              Bill <span className="font-mono tabular">{bill.billNumber}</span>
              <StatusChip status={bill.status === 'settled' ? 'settled' : bill.status === 'voided' ? 'voided' : 'review'} />
            </h2>
            <p className="mt-4 text-body text-ink-muted">
              {table ? `${table} · ` : ''}
              {SCOPE_LABEL[bill.scope]} · business date <span className="font-mono tabular text-num-sm">{formatIsoDate(bill.businessDate)}</span>
              {bill.settledAt ? ` · settled ${formatDateTime(bill.settledAt, tz)} by ${identity.displayName(bill.settledBy)}` : ''}
            </p>
          </div>

          <div role="table" aria-label="Bill lines" className="mt-8">
            <div role="row" className="grid grid-cols-[minmax(0,1fr)_64px_110px_120px] gap-16 border-b border-hairline py-8">
              <span role="columnheader" className="text-label text-ink-subtle">
                Item
              </span>
              <span role="columnheader" className="text-right text-label text-ink-subtle">
                Qty
              </span>
              <span role="columnheader" className="text-right text-label text-ink-subtle">
                Each
              </span>
              <span role="columnheader" className="text-right text-label text-ink-subtle">
                Total
              </span>
            </div>
            {lines.map((l) => (
              <div key={l.id} role="row" className="grid min-h-row grid-cols-[minmax(0,1fr)_64px_110px_120px] items-center gap-16 border-b border-rule">
                <span role="cell" className="flex min-w-0 items-center gap-8">
                  {showSeats ? <SeatChip seat={l.seatNo ?? 'shared'} label={l.seatLabel} size="dense" /> : null}
                  <span className="truncate text-body text-ink">{l.description}</span>
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink">
                  {formatQty(l.qty)}
                </span>
                <span role="cell" className="text-right">
                  <Money value={l.unitPriceCents} currency={false} tone="muted" />
                </span>
                <span role="cell" className="text-right">
                  <Money value={l.lineTotalCents} currency={false} />
                </span>
              </div>
            ))}
          </div>

          <dl className="ml-auto mt-16 flex max-w-[360px] flex-col gap-8">
            <TotalRow label="Subtotal">
              <Money value={bill.subtotalCents} currency={false} />
            </TotalRow>
            {isPositive(bill.discountCents) ? (
              <TotalRow label="Discount">
                <Money value={bill.discountCents} currency={false} tone="attention" />
              </TotalRow>
            ) : null}
            <TotalRow label="VAT included">
              <Money value={bill.taxCents} currency={false} tone="muted" />
            </TotalRow>
            {!isZero(bill.roundingCents) ? (
              <TotalRow label="Rounding">
                <Money value={bill.roundingCents} currency={false} tone="muted" />
              </TotalRow>
            ) : null}
            <div className="flex items-baseline justify-between gap-16 border-t border-hairline pt-8">
              <dt className="text-subtitle text-ink">Total</dt>
              <dd>
                <Money value={bill.totalCents} size="num-lg" />
              </dd>
            </div>
          </dl>
        </RevealSection>

        <RevealSection aria-labelledby="bill-tenders">
          <h3 id="bill-tenders" className="border-b border-hairline pb-8 text-subtitle text-ink">
            Tenders, as recorded
          </h3>
          <ul>
            {tenders.map((t) => (
              <li key={t.id} className="border-b border-rule py-12">
                <div className="flex items-baseline justify-between gap-16">
                  <span className="text-body text-ink">{TENDER_LABEL[t.kind]}</span>
                  <Money value={t.amountCents} />
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-16 gap-y-2 text-body-sm">
                  {t.reference ? (
                    <>
                      <dt className="text-ink-subtle">Reference</dt>
                      <dd className="font-mono tabular text-num-sm text-ink">{t.reference}</dd>
                    </>
                  ) : null}
                  {t.tenderedCents ? (
                    <>
                      <dt className="text-ink-subtle">Handed over</dt>
                      <dd>
                        <Money value={t.tenderedCents} currency={false} size="num-sm" tone="muted" />
                      </dd>
                    </>
                  ) : null}
                  {t.changeCents && isPositive(t.changeCents) ? (
                    <>
                      <dt className="text-ink-subtle">Change given</dt>
                      <dd>
                        <Money value={t.changeCents} currency={false} size="num-sm" tone="muted" />
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-ink-subtle">Recorded by</dt>
                  <dd className="text-ink-muted">
                    {identity.displayName(t.createdBy)} at <span className="font-mono tabular text-num-sm">{formatDateTime(t.createdAt, tz)}</span>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-body-sm text-ink-subtle">A tender is what the cashier saw and typed. Bliss does not contact any payment provider and cannot confirm a payment.</p>
        </RevealSection>
      </div>
    </>
  );
}

function TotalRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-16">
      <dt className="text-body text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
