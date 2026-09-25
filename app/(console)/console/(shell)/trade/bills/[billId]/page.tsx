import { formatDateTime, formatIsoDate, formatQty } from '@bliss/shared/format';
import { isPositive, isZero } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft, IconReceipt, IconPrinter } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { SCOPE_LABEL, TENDER_LABEL } from '../../../_lib/labels';
import { ConsoleBentoCard } from '@bliss/ui/components/console/metric';
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
        <div className="flex items-center gap-12">
          <ButtonLink href={`/print/bill/${bill.id}`} target="_blank" variant="secondary" icon={IconPrinter}>
            Print receipt
          </ButtonLink>
          {tab ? (
            <ButtonLink href={`/console/trade/tabs/${tab.id}`} variant="secondary" icon={IconReceipt}>
              Open the tab
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-24 desktop:grid-cols-[minmax(0,3fr)_minmax(320px,1.5fr)]">
        <RevealSection aria-labelledby="bill-title">
          <div className="flex flex-col rounded-[24px] bg-page ring-1 ring-inset ring-hairline/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Header Area */}
            <div className="px-24 py-24 bg-control/20 border-b border-hairline/60">
              <div className="flex items-center justify-between">
                <h2 id="bill-title" className="flex items-center gap-12 text-display-xs text-ink font-medium tracking-tight">
                  Bill <span className="font-mono text-ink-muted">{bill.billNumber}</span>
                </h2>
                <StatusChip status={bill.status === 'settled' ? 'settled' : bill.status === 'voided' ? 'voided' : 'review'} />
              </div>
              <p className="mt-8 text-body text-ink-subtle flex flex-wrap items-center gap-x-6 gap-y-2">
                {table ? <span className="font-medium text-ink">{table}</span> : null}
                {table ? <span>·</span> : null}
                <span>{SCOPE_LABEL[bill.scope]}</span>
                <span>·</span>
                <span>Business Date <span className="font-mono tabular text-num-sm ml-2">{formatIsoDate(bill.businessDate)}</span></span>
                {bill.settledAt ? (
                  <>
                    <span>·</span>
                    <span>Settled {formatDateTime(bill.settledAt, tz)} by <span className="font-medium text-ink">{identity.displayName(bill.settledBy)}</span></span>
                  </>
                ) : null}
              </p>
            </div>

            {/* Bill Lines */}
            <div role="table" aria-label="Bill lines" className="flex flex-col">
              <div role="row" className="grid grid-cols-[minmax(0,1fr)_64px_110px_120px] gap-16 border-b border-hairline px-24 py-12 bg-overlay/50">
                <span role="columnheader" className="text-label text-ink-subtle uppercase tracking-wider">Item</span>
                <span role="columnheader" className="text-right text-label text-ink-subtle uppercase tracking-wider">Qty</span>
                <span role="columnheader" className="text-right text-label text-ink-subtle uppercase tracking-wider">Each</span>
                <span role="columnheader" className="text-right text-label text-ink-subtle uppercase tracking-wider">Total</span>
              </div>
              
              <div className="flex flex-col px-12 py-8">
                {lines.map((l) => (
                  <div key={l.id} role="row" className="grid min-h-row grid-cols-[minmax(0,1fr)_64px_110px_120px] items-center gap-16 rounded-xl px-12 py-10 transition-colors hover:bg-control/30 group">
                    <span role="cell" className="flex min-w-0 items-center gap-12">
                      {showSeats ? <SeatChip seat={l.seatNo ?? 'shared'} label={l.seatLabel} size="dense" /> : null}
                      <span className="truncate text-body text-ink font-medium group-hover:text-accent-text transition-colors">{l.description}</span>
                    </span>
                    <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
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
            </div>

            {/* Elegant Separator */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-hairline/60 to-transparent opacity-80" aria-hidden="true" />

            {/* Totals */}
            <div className="bg-control/20 px-24 py-24 flex flex-col items-end">
              <dl className="w-full max-w-[320px] flex flex-col gap-12">
                <TotalRow label="Subtotal">
                  <Money value={bill.subtotalCents} currency={false} tone="muted" />
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
                
                <div className="mt-8 flex items-center justify-between border-t border-hairline/80 pt-16">
                  <dt className="text-title-sm text-ink font-medium">Total</dt>
                  <dd>
                    <Money value={bill.totalCents} size="title-lg" className="text-ink" />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </RevealSection>

        <RevealSection aria-labelledby="bill-tenders">
          <div className="flex flex-col rounded-[24px] bg-page ring-1 ring-inset ring-hairline/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-24 border-b border-hairline/60 bg-overlay/30">
              <h3 id="bill-tenders" className="flex items-center gap-8 text-title-sm font-medium text-ink">
                <IconReceipt size={20} className="text-ink-subtle" aria-hidden="true" />
                Tenders, as recorded
              </h3>
              <p className="mt-8 text-body text-ink-subtle leading-relaxed">
                A tender is what the cashier saw and typed. Bliss does not contact any payment provider and cannot confirm a payment.
              </p>
            </div>
            
            <ul className="flex flex-col p-16 gap-8">
              {tenders.map((t) => (
                <li key={t.id} className="rounded-[16px] ring-1 ring-inset ring-hairline/40 bg-page p-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-baseline justify-between gap-16 border-b border-hairline/60 pb-12 mb-12">
                    <span className="text-body font-medium text-ink">{TENDER_LABEL[t.kind]}</span>
                    <Money value={t.amountCents} size="num-lg" className="text-ink" />
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-16 gap-y-6 text-body-sm">
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
                      {identity.displayName(t.createdBy)} at <span className="font-mono tabular text-num-sm ml-4">{formatDateTime(t.createdAt, tz)}</span>
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
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
