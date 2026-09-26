import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Production-grade Thermal Receipt primitives.
 * Designed strictly for 80mm thermal printers (approx 48 chars wide).
 * Uses pure black and white to avoid dithering on thermal heads.
 * Typography is strictly monospaced for flawless alignment.
 */

export function Receipt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'w-[300px] bg-white text-black font-mono text-[12px] leading-tight p-4',
        'flex flex-col mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ReceiptHeader({
  venueName,
  title,
  subtitle,
  logoUrl,
}: {
  venueName: string;
  title?: string;
  subtitle?: string;
  logoUrl?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt={venueName} 
          className="w-[120px] object-contain mb-4 filter grayscale contrast-125"
        />
      ) : null}
      <h1 className="text-[18px] font-bold uppercase tracking-wider mb-2">{venueName}</h1>
      {title ? <div className="text-[14px] font-semibold uppercase">{title}</div> : null}
      {subtitle ? <div className="text-[12px] mt-1">{subtitle}</div> : null}
    </div>
  );
}

export function ReceiptRule() {
  return <div className="w-full border-b border-dashed border-black my-4" aria-hidden="true" />;
}

export function ReceiptMeta({ items }: { items: { label: string; value: string | ReactNode }[] }) {
  return (
    <div className="flex flex-col w-full text-[12px] mb-4">
      {items.map((item, i) => (
        <div key={i} className="flex justify-between w-full">
          <span>{item.label}:</span>
          <span className="font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReceiptItemsHeader() {
  return (
    <div className="flex justify-between w-full font-bold border-b border-black pb-2 mb-2">
      <span className="w-[15%]">QTY</span>
      <span className="w-[55%]">ITEM</span>
      <span className="w-[30%] text-right">TOTAL</span>
    </div>
  );
}

export function ReceiptItemRow({
  qty,
  description,
  total,
}: {
  qty: number | string;
  description: string;
  total: string;
}) {
  return (
    <div className="flex justify-between w-full items-start mb-2">
      <span className="w-[15%] font-semibold">{qty}</span>
      <span className="w-[55%] pr-2 break-words leading-snug">{description}</span>
      <span className="w-[30%] text-right font-semibold">{total}</span>
    </div>
  );
}

export function ReceiptTotalRow({
  label,
  value,
  bold = false,
  large = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex justify-between w-full',
        bold && 'font-bold',
        large ? 'text-[16px] mt-2 mb-2' : 'text-[12px] mb-1'
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ReceiptFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center mt-6 mb-2 gap-2">
      {children}
    </div>
  );
}

export function ReceiptTaxBreakdown({
  taxableAmount,
  taxAmount,
  rateLabel = '16% VAT',
}: {
  taxableAmount: string;
  taxAmount: string;
  rateLabel?: string;
}) {
  return (
    <div className="flex flex-col w-full text-[11px] mb-2 text-black/85">
      <div className="flex justify-between w-full">
        <span>Tax Base (Excl. VAT):</span>
        <span>{taxableAmount}</span>
      </div>
      <div className="flex justify-between w-full">
        <span>{rateLabel}:</span>
        <span>{taxAmount}</span>
      </div>
    </div>
  );
}

export function ReceiptTenderRow({
  kind,
  reference,
  amount,
  tendered,
  change,
}: {
  kind: string;
  reference?: string | null;
  amount: string;
  tendered?: string | null;
  change?: string | null;
}) {
  return (
    <div className="flex flex-col w-full text-[12px] mb-2">
      <div className="flex justify-between w-full font-semibold">
        <span className="uppercase">{kind} PAID:</span>
        <span>{amount}</span>
      </div>
      {reference ? (
        <div className="flex justify-between w-full text-[11px] text-black/80">
          <span>Ref / Auth:</span>
          <span className="font-mono font-medium">{reference}</span>
        </div>
      ) : null}
      {tendered && change ? (
        <div className="flex justify-between w-full text-[11px] text-black/80">
          <span>Cash Tendered: {tendered}</span>
          <span>Change: {change}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptFiscalFooter({
  kraPin,
  cuNumber,
  invoiceNumber,
  controlCode,
  notice = 'OFFICIAL KRA eTIMS FISCAL RECEIPT',
}: {
  kraPin: string;
  cuNumber: string;
  invoiceNumber: string;
  controlCode: string;
  notice?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center mt-4 w-full border-t border-dashed border-black pt-3 text-[11px]">
      <div className="font-bold uppercase tracking-wider mb-2">{notice}</div>
      <div className="flex justify-between w-full">
        <span>KRA PIN:</span>
        <span className="font-mono font-bold">{kraPin}</span>
      </div>
      <div className="flex justify-between w-full">
        <span>CU SERIAL NO:</span>
        <span className="font-mono">{cuNumber}</span>
      </div>
      <div className="flex justify-between w-full">
        <span>CU INVOICE NO:</span>
        <span className="font-mono font-bold">{invoiceNumber}</span>
      </div>
      <div className="flex justify-between w-full mt-1">
        <span>CONTROL CODE:</span>
        <span className="font-mono text-[10px] break-all">{controlCode}</span>
      </div>
    </div>
  );
}
