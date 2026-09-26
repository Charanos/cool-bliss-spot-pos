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
        'w-[300px] bg-paper text-paper-ink font-mono text-[12px] p-4',
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
      <h1 className="text-[18px] font-medium uppercase mb-2">{venueName}</h1>
      {title ? <div className="text-[14px] font-medium uppercase">{title}</div> : null}
      {subtitle ? <div className="text-[12px] mt-2">{subtitle}</div> : null}
    </div>
  );
}

export function ReceiptRule() {
  return <div className="w-full border-b border-dashed border-paper-ink my-4" aria-hidden="true" />;
}

export function ReceiptMeta({ items }: { items: { label: string; value: string | ReactNode }[] }) {
  return (
    <div className="flex flex-col w-full text-[12px] mb-4">
      {items.map((item, i) => (
        <div key={i} className="flex justify-between w-full">
          <span>{item.label}:</span>
          <span className="font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReceiptItemsHeader() {
  return (
    <div className="flex justify-between w-full font-medium border-b border-paper-ink pb-2 mb-2">
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
      <span className="w-[15%] font-medium">{qty}</span>
      <span className="w-[55%] pr-2 break-words">{description}</span>
      <span className="w-[30%] text-right font-medium">{total}</span>
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
        bold && 'font-medium',
        large ? 'text-[16px] mt-2 mb-2' : 'text-[12px] mb-2'
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
    <div className="flex flex-col w-full text-[11px] mb-2 text-paper-ink">
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
      <div className="flex justify-between w-full font-medium">
        <span className="uppercase">{kind} PAID:</span>
        <span>{amount}</span>
      </div>
      {reference ? (
        <div className="flex justify-between w-full text-[11px] text-paper-ink">
          <span>Ref / Auth:</span>
          <span className="font-mono font-medium">{reference}</span>
        </div>
      ) : null}
      {tendered && change ? (
        <div className="flex justify-between w-full text-[11px] text-paper-ink">
          <span>Cash Tendered: {tendered}</span>
          <span>Change: {change}</span>
        </div>
      ) : null}
    </div>
  );
}
