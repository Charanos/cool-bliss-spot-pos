import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Printed tickets for an 80mm thermal printer: bills, requested bills and order tickets.
 *
 * Quiet by design: hairlines rather than bars, small letterspaced capitals for what each part is,
 * names in the sans at a readable size and every figure in the mono so totals line up. Weight is
 * saved for the two things read from across a table: the total and the till number. The ink is
 * black, never grey, since a thermal head dithers grey into dots. Names wrap rather than truncate;
 * a cut-off drink on a bill is a dispute. 72mm of printable width is about 42 characters at 12px.
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
        'mx-auto flex w-[80mm] flex-col bg-paper px-[5mm] pb-[10mm] pt-[6mm] font-sans text-[11.5px] leading-[1.4] text-paper-ink shadow-raised print:shadow-none',
        // A second copy starts on its own length of paper.
        'print:break-after-page',
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Small capitals with air between the letters: what a part of the ticket is. */
const caps = 'text-[9px] uppercase tracking-[0.22em]';

/** Who the ticket is from: the mark, the name, and how to find and call the place. */
export function ReceiptBrand({ name, tagline, lines, logoUrl }: { name: string; tagline?: string | null; lines?: readonly (string | null | undefined)[]; logoUrl?: string | null }) {
  return (
    <header className="flex flex-col items-center gap-4 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- printed as is, no optimiser in the way of the print dialog
        <img src={logoUrl} alt={name} className="mb-4 h-[26mm] w-auto object-contain" />
      ) : null}
      {/* The logo already spells the name, so under it the house line takes its place; alone, the name is the title. */}
      {logoUrl && tagline ? (
        <p className="text-[11px] italic leading-none tracking-[0.06em]">{tagline}</p>
      ) : (
        <>
          <h1 className={logoUrl ? 'text-[9.5px] uppercase leading-none tracking-[0.3em]' : 'text-[15px] font-medium uppercase leading-none tracking-[0.18em]'}>{name}</h1>
          {tagline ? <p className="text-[11px] italic leading-none tracking-[0.06em]">{tagline}</p> : null}
        </>
      )}
      <div className="mt-4 flex flex-col text-[10px] leading-[1.45]">
        {lines?.filter(Boolean).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </header>
  );
}

/** What the ticket is, set between two hairlines, with its number under it. */
export function ReceiptBand({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div className="my-12 flex flex-col items-center gap-4">
      <div className="flex w-full items-center gap-8">
        <span aria-hidden="true" className="h-px flex-1 bg-paper-ink" />
        <span className="text-[11px] font-medium uppercase tracking-[0.3em]">{title}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-paper-ink" />
      </div>
      {detail ? <span className="font-mono text-[10.5px] tracking-[0.08em]">{detail}</span> : null}
    </div>
  );
}

export function ReceiptRule({ strong = false }: { strong?: boolean }) {
  return <div aria-hidden="true" className={cx('my-8 w-full border-b border-paper-ink', strong ? 'border-solid' : 'border-dotted')} />;
}

/** Facts about the ticket, label on the left and value on the right, one per line. */
export function ReceiptFacts({ items }: { items: readonly ({ label: string; value: ReactNode } | null | false)[] }) {
  return (
    <dl className="grid w-full grid-cols-[auto_1fr] gap-x-12 gap-y-2 text-[10.5px]">
      {items.filter(Boolean).map((item) => {
        const { label, value } = item as { label: string; value: ReactNode };
        return (
          <div key={label} className="contents">
            <dt className={cx(caps, 'self-center')}>{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A heading inside the ticket, followed by a hairline: "ITEMS", "PAID", "MAKE". */
export function ReceiptSection({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 mt-12 flex items-center gap-8">
      <span className={cx(caps, 'font-medium')}>{title}</span>
      <span aria-hidden="true" className="h-0 flex-1 border-b border-dotted border-paper-ink" />
      {aside ? <span className="font-mono text-[10px]">{aside}</span> : null}
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
        <span className="min-w-0 break-words font-medium">{name}</span>
        {total && !unit ? <span className="shrink-0 font-mono tabular-nums">{total}</span> : null}
      </div>
      {unit ? (
        <div className="flex justify-between gap-8 font-mono text-[10.5px] tabular-nums">
          <span>
            {qty} × {unit}
          </span>
          {total ? <span className="text-[11.5px]">{total}</span> : null}
        </div>
      ) : null}
      {notes?.filter(Boolean).map((n) => (
        <div key={n} className="pl-12 text-[10px] italic">
          {n}
        </div>
      ))}
    </div>
  );
}

/** One line of an order ticket: a big count, the name, and where it goes. Read at a glance, at arm's length. */
export function TicketLine({ qty, name, where, notes }: { qty: string; name: string; where?: string | null; notes?: readonly (string | null | undefined)[] }) {
  return (
    <div className="flex w-full gap-8 border-b border-dotted border-paper-ink py-6 last:border-b-0">
      <span className="w-[8mm] shrink-0 font-mono text-[16px] font-print leading-none tabular-nums">{qty}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-8">
          <span className="min-w-0 break-words text-[13px] font-medium leading-[1.2]">{name}</span>
          {where ? <span className="shrink-0 rounded-[3px] border border-paper-ink px-4 text-[9px] uppercase tracking-[0.12em]">{where}</span> : null}
        </div>
        {notes?.filter(Boolean).map((n) => (
          <span key={n} className="text-[11px] font-medium uppercase tracking-[0.04em]">
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
      <div className="my-8 flex w-full items-baseline justify-between">
        <span className={cx(caps, 'font-medium')}>{label}</span>
        <span className="font-mono text-[19px] font-print tabular-nums tracking-[0.02em]">{value}</span>
      </div>
    );
  }
  return (
    <div className={cx('flex w-full items-baseline justify-between py-[1px] text-[10.5px]', bold && 'font-medium')}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

/**
 * How to pay by M-Pesa: the till for each part of the bill, in a fine rounded frame so it is found
 * at once. With one part, one till; with drinks and food, each till with what is paid to it.
 */
/**
 * Where to pay by M-Pesa: each till with what goes to it, side by side, so a guest paying drinks and
 * food separately reads both at a glance. `paid` marks a receipt already settled.
 */
export function ReceiptPay({ parts, currency = 'KES', paid = false }: { parts: readonly { label: string; till: string; amount?: string | null }[]; currency?: string; paid?: boolean }) {
  if (parts.length === 0) return null;
  return (
    <section className="mt-12 rounded-[6px] border border-paper-ink px-12 py-8">
      <p className={cx(caps, 'text-center')}>M-Pesa · Buy Goods</p>
      <div className="mt-6 flex flex-col">
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col border-t border-dotted border-paper-ink py-6 first:border-t-0 first:pt-0 last:pb-0">
            <span className="text-[9.5px]">{p.label}</span>
            <span className="flex items-baseline justify-between gap-8">
              <span className="font-mono text-[17px] font-print leading-[1.2] tracking-[0.12em]">{p.till}</span>
              {paid ? (
                <span className="text-[10px] uppercase tracking-[0.2em]">Paid</span>
              ) : p.amount ? (
                <span className="font-mono text-[15px] font-print leading-[1.2] tabular-nums">
                  <span className="text-[10px] font-regular">{currency} </span>
                  {p.amount}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReceiptTenderRow({ kind, reference, amount, tendered, change }: { kind: string; reference?: string | null; amount: string; tendered?: string | null; change?: string | null }) {
  return (
    <div className="flex w-full flex-col py-2 text-[10.5px]">
      <div className="flex justify-between">
        <span className="font-medium">{kind}</span>
        <span className="font-mono tabular-nums">{amount}</span>
      </div>
      {reference ? (
        <div className="flex justify-between text-[10px]">
          <span>Reference</span>
          <span className="font-mono tracking-[0.06em]">{reference}</span>
        </div>
      ) : null}
      {tendered && change ? (
        <div className="flex justify-between font-mono text-[10px] tabular-nums">
          <span>Given {tendered}</span>
          <span>Change {change}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-16 flex flex-col items-center gap-2 text-center text-[10px] leading-[1.5]">{children}</footer>;
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
        {retry ? <p className="text-[10.5px] font-medium">Trying again in a moment.</p> : null}
      </Receipt>
    </PrintPage>
  );
}
