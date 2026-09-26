import { formatDateTime, formatIsoDate, formatQty } from '@bliss/shared/format';
import { isPositive, isZero } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArrowLeft, IconReceipt, IconPrinter, IconMapPin, IconCalendar, IconClock, IconUser } from '@tabler/icons-react';
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
    <div className="flex flex-col gap-24 max-w-[1400px] mx-auto w-full pb-32">
      <div className="flex items-center justify-between">
        <ButtonLink href="/console/trade/bills" variant="ghost" icon={IconArrowLeft} className="-ml-12 text-ink-subtle hover:text-ink transition-colors">
          Bills
        </ButtonLink>
        <div className="flex items-center gap-12">
          {tab ? (
            <ButtonLink href={`/console/trade/tabs/${tab.id}`} variant="secondary" icon={IconReceipt}>
              Open tab
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/print/bill/${bill.id}`} target="_blank" variant="secondary" icon={IconPrinter}>
            Print receipt
          </ButtonLink>
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col desktop:flex-row items-start desktop:items-center justify-between gap-24 pb-12">
        <div className="flex flex-col gap-12 min-w-0">
          <div className="flex items-center gap-12 flex-wrap">
            <h2 className="text-[28px] font-medium text-ink tracking-tight flex flex-wrap items-baseline gap-2">
              Bill&nbsp;<span className="font-mono tabular text-[24px] text-ink-subtle">{bill.billNumber}</span>
            </h2>
            <StatusChip status={bill.status === 'settled' ? 'settled' : bill.status === 'voided' ? 'voided' : 'review'} />
          </div>
          
          <div className="flex items-center gap-12 flex-wrap text-body-sm text-ink-subtle">
            {table ? <span className="flex items-center gap-6"><IconMapPin size={15} className="text-ink-muted" /> {table}</span> : null}
            {table ? <span className="text-hairline/80">•</span> : null}
            <span className="flex items-center gap-6"><IconReceipt size={15} className="text-ink-muted" /> {SCOPE_LABEL[bill.scope]}</span>
            <span className="text-hairline/80">•</span>
            <span className="flex items-center gap-6"><IconCalendar size={15} className="text-ink-muted" /> <span className="font-mono tabular">{formatIsoDate(bill.businessDate)}</span></span>
            {bill.settledAt ? (
              <>
                <span className="text-hairline/80">•</span>
                <span className="flex items-center gap-6">
                  <IconClock size={15} className="text-ink-muted" /> Settled <span className="font-mono tabular">{formatDateTime(bill.settledAt, tz)}</span>
                </span>
                <span className="text-hairline/80">•</span>
                <span className="flex items-center gap-6">
                  <IconUser size={15} className="text-ink-muted" /> {identity.displayName(bill.settledBy)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-32 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* ── LEFT COLUMN: BILL LINES ── */}
        <div className="flex flex-col gap-24">
          <div className="overflow-hidden rounded-[16px] bg-page border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_110px_120px] gap-16 border-b border-hairline/60 px-24 py-16 bg-control/20">
              <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wider">Item</span>
              <span className="text-right text-[10px] font-medium text-ink-subtle uppercase tracking-wider">Qty</span>
              <span className="text-right text-[10px] font-medium text-ink-subtle uppercase tracking-wider">Each</span>
              <span className="text-right text-[10px] font-medium text-ink-subtle uppercase tracking-wider">Total</span>
            </div>
            
            <ul className="divide-y divide-hairline/60 flex flex-col">
              {lines.map((l) => (
                <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_64px_110px_120px] items-center gap-16 px-24 py-20 transition-colors hover:bg-control/5 group">
                  <span className="flex min-w-0 flex-col gap-4">
                    <span className="flex items-center gap-8">
                      {showSeats ? <SeatChip seat={l.seatNo ?? 'shared'} label={l.seatLabel} size="dense" /> : null}
                      <span className="truncate text-body font-medium text-ink group-hover:text-accent-text transition-colors">{l.description}</span>
                    </span>
                  </span>
                  <span className="text-right font-mono tabular text-body font-medium text-ink-subtle">
                    {formatQty(l.qty)}
                  </span>
                  <span className="text-right font-mono text-body font-medium text-ink-subtle">
                    <Money value={l.unitPriceCents} currency={false} tone="muted" />
                  </span>
                  <span className="text-right font-mono text-body font-medium text-ink">
                    <Money value={l.lineTotalCents} currency={false} />
                  </span>
                </li>
              ))}
            </ul>

            <div className="bg-control/20 px-24 py-24 flex flex-col items-end border-t border-hairline/60">
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
                    <Money value={bill.totalCents} size="title-lg" className="text-ink font-medium" />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: TENDERS ── */}
        <div className="flex flex-col gap-24">
          <div className="overflow-hidden rounded-[16px] bg-page border border-hairline/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="p-20 border-b border-hairline/60 bg-control/20">
              <h3 id="bill-tenders" className="flex items-center gap-10 text-subtitle font-medium text-ink">
                Tenders, as recorded
              </h3>
              <p className="mt-8 text-body-sm text-ink-muted leading-relaxed">
                A tender is what the cashier saw and typed. Bliss does not contact any payment provider and cannot confirm a payment.
              </p>
            </div>
            
            <ul className="flex flex-col">
              {tenders.map((t, i) => (
                <li key={t.id} className={`p-24 transition-colors group ${i > 0 ? 'border-t border-hairline/60' : ''}`}>
                  <div className="flex items-center justify-between mb-20">
                    <div className="flex items-center gap-12">
                      <span className="flex items-center justify-center size-[32px] rounded-[10px] bg-control/50 border border-hairline/40 text-ink-subtle group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                        <IconReceipt size={16} stroke={1.5} />
                      </span>
                      <span className="text-[16px] font-medium text-ink group-hover:text-accent transition-colors">{TENDER_LABEL[t.kind]}</span>
                    </div>
                    <span className="font-mono text-title-md font-medium text-ink group-hover:text-accent transition-colors"><Money value={t.amountCents} /></span>
                  </div>
                  
                  <div className="ml-[15px] pl-[28px] border-l-[2px] border-hairline/40 flex flex-col gap-12">
                    {t.reference ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">Reference</span>
                        <span className="font-mono tabular text-[12px] text-ink-muted bg-control/30 px-6 py-2 rounded border border-hairline/40 shadow-xs">{t.reference}</span>
                      </div>
                    ) : null}
                    
                    {t.tenderedCents ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">Handed over</span>
                        <span className="font-mono text-[13px] text-ink-muted"><Money value={t.tenderedCents} currency={false} /></span>
                      </div>
                    ) : null}
                    
                    {t.changeCents && isPositive(t.changeCents) ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">Change given</span>
                        <span className="font-mono text-[13px] text-ink-muted"><Money value={t.changeCents} currency={false} /></span>
                      </div>
                    ) : null}
                    
                    <div className="flex items-center justify-between mt-4 pt-12 border-t border-hairline/40">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">Recorded by</span>
                      <span className="text-body-sm text-ink-muted text-right">
                        {identity.displayName(t.createdBy)} <span className="text-hairline/60 mx-4">•</span> <span className="font-mono tabular text-[11px]">{formatDateTime(t.createdAt, tz)}</span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
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
