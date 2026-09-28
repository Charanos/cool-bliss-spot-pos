import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Printed tickets for an 80mm thermal printer: bills, requested bills and order tickets.
 *
 * The paper is white and the ink is black, never grey: a thermal head dithers grey into dots. Weight
 * and size carry the hierarchy instead, and a solid black band marks what the ticket is. Figures are
 * monospaced so every total lines up; names wrap rather than truncate, since a cut-off drink on a
 * bill is a dispute. 72mm of printable width is about 42 characters at 12px.
 */

/** The printed page: auto-prints once loaded, and on screen sits on a desk so the ticket reads as paper. */
export function PrintPage({ children, autoPrint = true }: { children: ReactNode; autoPrint?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper-desk py-32 print:bg-paper print:py-0">
      {/* 80mm roll, no browser margins, and nothing but the ticket on paper. */}
      <style>{`@page { size: 80mm auto; margin: 0; } @media print { html, body { background: var(--color-paper); } }`}</style>
      {autoPrint ? <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });` }} /> : null}
      <div className="flex flex-col gap-24 print:gap-0">{children}</div>
    </div>
  );
}

export function Receipt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cx(
        'mx-auto flex w-[80mm] flex-col bg-paper px-[4mm] pb-[10mm] pt-[5mm] font-mono text-[12px] leading-[1.35] text-paper-ink shadow-raised print:shadow-none',
        // A second copy starts on its own length of paper.
        'print:break-after-page',
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Who the ticket is from: the mark, the name, a line under it, and how to find and call the place. */
export function ReceiptBrand({ name, tagline, lines, logoUrl }: { name: string; tagline?: string | null; lines?: readonly (string | null | undefined)[]; logoUrl?: string | null }) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- printed as is, no optimiser in the way of the print dialog
        <img src={logoUrl} alt="" className="mb-4 size-[18mm] object-contain grayscale" />
      ) : null}
      <h1 className="font-sans text-[20px] font-print uppercase leading-none tracking-[0.04em]">{name}</h1>
      {tagline ? <p className="text-[10px] uppercase tracking-[0.12em]">{tagline}</p> : null}
      {lines?.filter(Boolean).map((line) => (
        <p key={line} className="text-[11px]">
          {line}
        </p>
      ))}
    </header>
  );
}

/** What the ticket is, reversed out of a black band so it is read first: "BILL", "KITCHEN ORDER". */
export function ReceiptBand({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div className="my-8 flex items-baseline justify-between gap-8 bg-paper-ink px-8 py-6 text-paper print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      <span className="font-sans text-[15px] font-print uppercase tracking-[0.06em]">{title}</span>
      {detail ? <span className="text-[13px] font-print">{detail}</span> : null}
    </div>
  );
}

export function ReceiptRule({ strong = false }: { strong?: boolean }) {
  return <div aria-hidden="true" className={cx('my-6 w-full', strong ? 'border-b-2 border-solid border-paper-ink' : 'border-b border-dashed border-paper-ink')} />;
}

/** Facts about the ticket, label on the left and value on the right, one per line. */
export function ReceiptFacts({ items }: { items: readonly ({ label: string; value: ReactNode } | null | false)[] }) {
  return (
    <dl className="grid w-full grid-cols-[auto_1fr] gap-x-12 text-[11px]">
      {items.filter(Boolean).map((item) => {
        const { label, value } = item as { label: string; value: ReactNode };
        return (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="text-right font-print">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A heading inside the ticket: "BAR", "KITCHEN", "PAYMENT". */
export function ReceiptSection({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 mt-8 flex items-baseline justify-between border-b-2 border-paper-ink pb-2">
      <span className="font-sans text-[12px] font-print uppercase tracking-[0.1em]">{title}</span>
      {aside ? <span className="text-[11px] font-print">{aside}</span> : null}
    </div>
  );
}

/**
 * One item. The name on its own line, wrapped in full; under it the count and the price of one on
 * the left, the line total on the right. Notes and extras sit under it, indented.
 */
export function ReceiptLine({ name, qty, unit, total, notes }: { name: string; qty: string; unit?: string | null; total?: string | null; notes?: readonly (string | null | undefined)[] }) {
  return (
    <div className="flex w-full flex-col py-4">
      <div className="flex items-start justify-between gap-8">
        <span className="min-w-0 break-words font-print">{name}</span>
        {total && !unit ? <span className="shrink-0 font-print tabular-nums">{total}</span> : null}
      </div>
      {unit ? (
        <div className="flex justify-between gap-8 tabular-nums">
          <span>
            {qty} x {unit}
          </span>
          {total ? <span className="font-print">{total}</span> : null}
        </div>
      ) : null}
      {notes?.filter(Boolean).map((n) => (
        <div key={n} className="pl-12 text-[11px]">
          {n}
        </div>
      ))}
    </div>
  );
}

/** One line of an order ticket: a big count, the name, and where it goes. */
export function TicketLine({ qty, name, where, notes }: { qty: string; name: string; where?: string | null; notes?: readonly (string | null | undefined)[] }) {
  return (
    <div className="flex w-full gap-8 border-b border-dashed border-paper-ink py-6 last:border-b-0">
      <span className="w-[9mm] shrink-0 font-sans text-[18px] font-print leading-none tabular-nums">{qty}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-8">
          <span className="min-w-0 break-words font-sans text-[14px] font-print leading-[1.15]">{name}</span>
          {where ? <span className="shrink-0 border border-paper-ink px-4 text-[10px] font-print uppercase">{where}</span> : null}
        </div>
        {notes?.filter(Boolean).map((n) => (
          <span key={n} className="text-[12px] font-print uppercase">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReceiptTotalRow({ label, value, bold = false, large = false }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className={cx('flex w-full items-baseline justify-between tabular-nums', bold && 'font-print', large ? 'my-4 font-sans text-[18px]' : 'text-[12px]')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * How to pay by M-Pesa: the till for each part of the bill, drawn as a box so it is found at once.
 * With one part, one big till; with drinks and food, each till with what is paid to it.
 */
export function ReceiptPay({ parts, currency = 'KES' }: { parts: readonly { label: string; till: string; amount?: string | null }[]; currency?: string }) {
  if (parts.length === 0) return null;
  return (
    <section className="my-8 border-2 border-paper-ink px-8 py-6">
      <p className="text-center font-sans text-[11px] font-print uppercase tracking-[0.12em]">Pay with M-Pesa · Buy Goods</p>
      {parts.length === 1 ? (
        <div className="flex flex-col items-center py-2">
          <span className="text-[10px] uppercase">Till number</span>
          <span className="font-sans text-[24px] font-print leading-[1.15] tracking-[0.08em]">{parts[0]!.till}</span>
          {parts[0]!.amount ? (
            <span className="text-[12px] font-print">
              {currency} {parts[0]!.amount}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {parts.map((p) => (
            <div key={p.label} className="flex items-baseline justify-between gap-8 border-t border-dashed border-paper-ink pt-4 first:border-t-0 first:pt-0">
              <span className="flex flex-col">
                <span className="text-[10px] font-print uppercase">{p.label}</span>
                <span className="font-sans text-[18px] font-print leading-[1.15] tracking-[0.06em]">{p.till}</span>
              </span>
              {p.amount ? (
                <span className="text-[12px] font-print tabular-nums">
                  {currency} {p.amount}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReceiptTenderRow({ kind, reference, amount, tendered, change }: { kind: string; reference?: string | null; amount: string; tendered?: string | null; change?: string | null }) {
  return (
    <div className="flex w-full flex-col py-2 tabular-nums">
      <div className="flex justify-between font-print">
        <span className="uppercase">{kind}</span>
        <span>{amount}</span>
      </div>
      {reference ? (
        <div className="flex justify-between text-[11px]">
          <span>Reference</span>
          <span className="font-print">{reference}</span>
        </div>
      ) : null}
      {tendered && change ? (
        <div className="flex justify-between text-[11px]">
          <span>Given {tendered}</span>
          <span>Change {change}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-12 flex flex-col items-center gap-2 text-center text-[11px]">{children}</footer>;
}

/**
 * The page a print opens when there is nothing to print yet, or it may not be printed: said on
 * paper, in words, never a browser's 404. `retry` reloads it on its own while a bill is on its way.
 */
export function PrintNotice({ title, body, retry }: { title: string; body: string; retry?: { href: string; seconds: number } | null }) {
  return (
    <PrintPage autoPrint={false}>
      {retry ? <meta httpEquiv="refresh" content={`${retry.seconds};url=${retry.href}`} /> : null}
      <Receipt>
        <ReceiptBand title={title} />
        <p className="py-8 text-[12px]">{body}</p>
        {retry ? <p className="text-[11px] font-print">Trying again in a moment.</p> : null}
      </Receipt>
    </PrintPage>
  );
}
