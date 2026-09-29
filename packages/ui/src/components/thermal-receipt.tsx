import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Printed tickets for a 58mm thermal printer (POS-58 and its kind): bills, requested bills and order
 * tickets.
 *
 * A 58mm roll prints 48mm across, about 384 dots at 203 dpi, so the ticket is laid out to exactly
 * that: 58mm of paper with 5mm either side. A thermal head has no grey, only a dot or none, so
 * everything is black and nothing is thin. Type is set heavier and larger than on a screen (a stroke
 * one dot wide comes out broken), rules are borders two dots deep (backgrounds do not print unless
 * the dialog's Background graphics is on), and small letterspaced capitals are kept for labels only.
 * Names wrap rather than truncate; a cut-off drink on a bill is a dispute. About 28 characters fit a
 * line at the body size. Set in Geist throughout, figures included, with tabular numbers so totals
 * line up in a column.
 */

/** Body, labels and figures. Tuned on the printer, not the screen. */
const ink = 'text-paper-ink';
const caps = 'text-[9.5px] font-print-strong uppercase tracking-[0.14em]';

/** The printed page: auto-prints once loaded, and on screen sits on a desk so the ticket reads as paper. */
export function PrintPage({ children, autoPrint = true }: { children: ReactNode; autoPrint?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper-desk py-32 print:bg-paper print:py-0">
      {/*
        One 58mm by 210mm sheet, the size the POS-58 driver offers, with no browser margins. A ticket
        longer than a sheet runs on to the next without splitting a line. Colours print as they are,
        and a second copy starts a sheet of its own; the last one leaves no blank sheet after it.
      */}
      <style>{`@page { size: 58mm 210mm; margin: 0; }
@media print {
  html, body { background: var(--color-paper); margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.thermal-ticket + .thermal-ticket { break-before: page; }`}</style>
      {/* Printed once the fonts are in: printed before, a ticket comes out in the computer's fallback font. */}
      {autoPrint ? <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load', function () { var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); ready.then(function () { setTimeout(function () { window.print(); }, 150); }); });` }} /> : null}
      <div className="flex flex-col gap-24 print:gap-0">{children}</div>
    </div>
  );
}

export function Receipt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cx(
        'thermal-ticket mx-auto flex w-[58mm] flex-col bg-paper px-[5mm] pb-[8mm] pt-[4mm] font-sans tabular-nums text-[12.5px] font-print-body leading-[1.32]',
        ink,
        'shadow-raised print:shadow-none',
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Who the ticket is from: the mark, the name, and how to find and call the place. */
export function ReceiptBrand({ name, tagline, lines, logoUrl }: { name: string; tagline?: string | null; lines?: readonly (string | null | undefined)[]; logoUrl?: string | null }) {
  return (
    <header className="flex flex-col items-center gap-4 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- printed as is, no optimiser in the way of the print dialog
        <img src={logoUrl} alt={name} className="mb-2 h-[19mm] w-auto object-contain" />
      ) : null}
      {/* The logo already spells the name, so under it the house line takes its place; alone, the name is the title. */}
      {logoUrl && tagline ? (
        <p className="text-[12px] font-print italic leading-none">{tagline}</p>
      ) : (
        <>
          <h1 className={logoUrl ? 'text-[10.5px] font-print-strong uppercase leading-none tracking-[0.2em]' : 'text-[16px] font-print-strong uppercase leading-none tracking-[0.12em]'}>{name}</h1>
          {tagline ? <p className="text-[12px] font-print italic leading-none">{tagline}</p> : null}
        </>
      )}
      <div className="mt-2 flex flex-col text-[10.5px] font-print-body leading-[1.35]">
        {lines?.filter(Boolean).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </header>
  );
}

/** What the ticket is, set between two rules, with its number under it. */
export function ReceiptBand({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div className="my-8 flex flex-col items-center gap-2">
      <div className="flex w-full items-center gap-6">
        <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-paper-ink" />
        <span className="text-[14px] font-print-strong uppercase tracking-[0.2em]">{title}</span>
        <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-paper-ink" />
      </div>
      {detail ? <span className="font-sans text-[12.5px] font-print-strong tracking-[0.04em]">{detail}</span> : null}
    </div>
  );
}

export function ReceiptRule({ strong = false }: { strong?: boolean }) {
  return <div aria-hidden="true" className={cx('my-6 w-full border-paper-ink', strong ? 'border-b-2 border-solid' : 'border-b-2 border-dashed')} />;
}

/** Facts about the ticket, label on the left and value on the right, one per line. */
export function ReceiptFacts({ items }: { items: readonly ({ label: string; value: ReactNode } | null | false)[] }) {
  return (
    <dl className="grid w-full grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-[11.5px] leading-[1.25]">
      {items.filter(Boolean).map((item) => {
        const { label, value } = item as { label: string; value: ReactNode };
        return (
          <div key={label} className="contents">
            <dt className={cx(caps, 'self-baseline whitespace-nowrap pt-[1px]')}>{label}</dt>
            <dd className="break-words text-right font-print">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A heading inside the ticket, followed by a rule: "ITEMS", "PAID", "MAKE". */
export function ReceiptSection({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-12 flex items-center gap-6">
      <span className={caps}>{title}</span>
      <span aria-hidden="true" className="h-0 flex-1 border-b-2 border-dashed border-paper-ink" />
      {aside ? <span className="font-sans text-[11px] font-print">{aside}</span> : null}
    </div>
  );
}

/**
 * One item. The name on its own line, wrapped in full; under it the count and the price of one on
 * the left, the line total on the right. Notes and extras sit under it, indented. Never split across
 * two sheets.
 */
export function ReceiptLine({ name, qty, unit, total, notes }: { name: string; qty: string; unit?: string | null; total?: string | null; notes?: readonly (string | null | undefined)[] }) {
  return (
    <div className="flex w-full break-inside-avoid flex-col py-4">
      <div className="flex items-start justify-between gap-6">
        <span className="min-w-0 break-words text-[13px] font-print leading-[1.25]">{name}</span>
        {total && !unit ? <span className="shrink-0 font-sans text-[13px] font-print-strong tabular-nums">{total}</span> : null}
      </div>
      {unit ? (
        <div className="flex items-baseline justify-between gap-6 font-sans tabular-nums">
          <span className="text-[12px] font-print">
            {qty} × {unit}
          </span>
          {total ? <span className="text-[13px] font-print-strong">{total}</span> : null}
        </div>
      ) : null}
      {notes?.filter(Boolean).map((n) => (
        <div key={n} className="pl-8 text-[11px] font-print italic">
          {n}
        </div>
      ))}
    </div>
  );
}

/** One line of an order ticket: a big count, the name, and where it goes. Read at a glance, at arm's length. */
export function TicketLine({ qty, name, where, notes }: { qty: string; name: string; where?: string | null; notes?: readonly (string | null | undefined)[] }) {
  return (
    <div className="flex w-full break-inside-avoid gap-6 border-b-2 border-dashed border-paper-ink py-6 last:border-b-0">
      <span className="w-[8mm] shrink-0 font-sans text-[19px] font-print-strong leading-none tabular-nums">{qty}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* The name takes the full width of a 58mm ticket; where it goes sits under it. */}
        <span className="min-w-0 break-words text-[14.5px] font-print-strong leading-[1.2]">{name}</span>
        {where ? <span className="w-fit rounded-[3px] border-2 border-paper-ink px-4 text-[9.5px] font-print-strong uppercase tracking-[0.08em]">{where}</span> : null}
        {notes?.filter(Boolean).map((n) => (
          <span key={n} className="text-[12px] font-print-strong uppercase tracking-[0.02em]">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReceiptTotalRow({ label, value, bold = false, large = false }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  if (large) {
    return (
      <div className="my-6 flex w-full break-inside-avoid items-baseline justify-between gap-6">
        <span className="text-[11px] font-print-strong uppercase tracking-[0.12em]">{label}</span>
        <span className="font-sans text-[23px] font-print-strong leading-none tabular-nums">{value}</span>
      </div>
    );
  }
  return (
    <div className={cx('flex w-full items-baseline justify-between gap-6 py-[1px] text-[11.5px]', bold ? 'font-print-strong' : 'font-print-body')}>
      <span>{label}</span>
      <span className="font-sans font-print tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The M-Pesa tills a bill is paid to. Before it is paid, each till shows what to send it; once paid,
 * the same figure with the word Paid, so a receipt for food and drinks says how much went to the bar
 * till and how much to the kitchen's, not just that it was paid. With two tills, the parts add up to
 * the bill's total, and the last line says so.
 */
export function ReceiptPay({ parts, currency = 'KES', paid = false, viaMpesa = true, total }: { parts: readonly { label: string; till: string; amount?: string | null }[]; currency?: string; paid?: boolean; /** A paid bill settled wholly by M-Pesa went to the tills; paid any other way, the tills are only how it splits. */ viaMpesa?: boolean; total?: string | null }) {
  if (parts.length === 0) return null;
  return (
    <section className="mt-12 break-inside-avoid rounded-[5px] border-2 border-paper-ink px-8 py-6">
      <p className={cx(caps, 'text-center')}>{!paid ? 'M-Pesa · Buy Goods' : viaMpesa ? 'Paid to the tills' : 'Split by till'}</p>
      {paid && viaMpesa ? <p className="text-center text-[9.5px] font-print uppercase tracking-[0.1em]">M-Pesa Buy Goods</p> : null}
      <div className="mt-4 flex flex-col">
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col border-t-2 border-dashed border-paper-ink py-4 first:border-t-0 first:pt-0 last:pb-0">
            {/* What the till is for, and Paid across from it; under them the till and its amount on one line. */}
            <span className="flex items-baseline justify-between gap-6 text-[10.5px] font-print">
              <span>{p.label}</span>
              {paid && viaMpesa ? <span className="text-[9.5px] font-print-strong uppercase tracking-[0.1em]">Paid</span> : null}
            </span>
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-sans text-[17px] font-print-strong leading-[1.15] tracking-[0.02em]">{p.till}</span>
              {p.amount ? (
                <span className="whitespace-nowrap font-sans text-[15px] font-print-strong leading-[1.15] tabular-nums">
                  <span className="text-[9.5px] font-print">{currency} </span>
                  {p.amount}
                </span>
              ) : null}
            </span>
          </div>
        ))}
        {parts.length > 1 && total ? (
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-paper-ink pt-4 text-[11px] font-print-strong">
            <span className="uppercase tracking-[0.1em]">{paid ? (viaMpesa ? 'Paid in all' : 'Total') : 'Both tills'}</span>
            <span className="font-sans tabular-nums">
              {currency} {total}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ReceiptTenderRow({ kind, reference, amount, tendered, change }: { kind: string; reference?: string | null; amount: string; tendered?: string | null; change?: string | null }) {
  return (
    <div className="flex w-full break-inside-avoid flex-col py-2 text-[11.5px]">
      <div className="flex justify-between gap-6">
        <span className="font-print-strong">{kind}</span>
        <span className="font-sans font-print-strong tabular-nums">{amount}</span>
      </div>
      {reference ? (
        <div className="flex justify-between gap-6 text-[11px] font-print-body">
          <span>Reference</span>
          <span className="break-all text-right font-sans font-print">{reference}</span>
        </div>
      ) : null}
      {tendered && change ? (
        <div className="flex justify-between gap-6 font-sans text-[11px] font-print tabular-nums">
          <span>Given {tendered}</span>
          <span>Change {change}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-12 flex break-inside-avoid flex-col items-center gap-2 text-center text-[11px] font-print-body leading-[1.4]">{children}</footer>;
}

/** The thank-you at the foot of a bill, set so it prints, not as a faint aside. */
export function ReceiptThanks({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-print-strong italic">{children}</p>;
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
        <p className="py-6 text-[12.5px]">{body}</p>
        {retry ? <p className="text-[11.5px] font-print-strong">Trying again in a moment.</p> : null}
      </Receipt>
    </PrintPage>
  );
}
