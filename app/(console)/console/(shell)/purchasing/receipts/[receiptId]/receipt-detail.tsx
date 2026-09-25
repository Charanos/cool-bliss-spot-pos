'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertTriangle, IconCheck, IconEye, IconFileText, IconPhoto, IconX } from '@tabler/icons-react';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import type { Cents } from '@bliss/shared/money';

export interface ReceiptDetailLine {
  id: string;
  variantId: string;
  name: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyRejected: number;
  rejectionReason: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  unitCostCents: Cents;
  lineTotalCents: Cents;
}

export function ReceiptDetailView({
  lines,
  mediaUrls,
  varianceNote,
  totalValue,
}: {
  lines: ReceiptDetailLine[];
  mediaUrls: string[];
  varianceNote: string | null;
  totalValue: Cents;
}) {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const totalAccepted = lines.reduce((sum, l) => sum + l.qtyReceived, 0);
  const totalRejected = lines.reduce((sum, l) => sum + l.qtyRejected, 0);

  return (
    <div className="flex flex-col gap-32">
      {/* Verification Documents & Photos */}
      {mediaUrls.length > 0 && (
        <section className="rounded-lg border border-hairline bg-raised p-20 tablet:p-24 shadow-raised">
          <div className="mb-16 flex items-center justify-between">
            <div>
              <h3 className="text-body font-medium text-ink flex items-center gap-8">
                <IconPhoto size={18} stroke={1.5} className="text-accent" />
                Intake Verification Photos ({mediaUrls.length})
              </h3>
              <p className="text-body-sm text-ink-subtle mt-2">Stamped delivery notes, crates, and seal photographs</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-16">
            {mediaUrls.map((url, i) => (
              <div
                key={i}
                onClick={() => setActivePhoto(url)}
                className="group relative aspect-square rounded-md overflow-hidden bg-sunken border border-hairline cursor-pointer shadow-sm"
              >
                <img
                  src={url}
                  alt={`Verification Photo ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <span className="size-control-sm rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center">
                    <IconEye size={16} stroke={2} />
                  </span>
                </div>
                <span className="absolute top-8 left-8 bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono px-6 py-2 rounded-sm">
                  #{i + 1}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Line Items Table */}
      <section className="rounded-lg border border-hairline bg-raised shadow-raised overflow-hidden">
        <div className="p-20 tablet:p-24 border-b border-hairline flex flex-wrap items-center justify-between gap-16">
          <div>
            <h3 className="text-body font-medium text-ink flex items-center gap-8">
              <IconFileText size={18} stroke={1.5} className="text-accent" />
              Received Line Items ({lines.length})
            </h3>
            <p className="text-body-sm text-ink-subtle mt-2">Detailed breakdown of accepted stock units and FEFO lots</p>
          </div>
          <div className="flex items-center gap-16 text-body-sm">
            <span className="text-ink-subtle">
              Total Units: <strong className="text-ink font-medium">{totalAccepted}</strong>
            </span>
            {totalRejected > 0 && (
              <span className="text-stop font-medium">
                Rejected: {totalRejected}
              </span>
            )}
            <span className="text-ink-subtle">
              Total Value: <strong className="text-ink font-medium"><Money value={totalValue} /></strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-sunken/40 text-ink-subtle border-b border-hairline">
              <tr>
                <th className="py-12 px-20 font-medium">Product Variant</th>
                <th className="py-12 px-16 font-medium text-right">Accepted</th>
                <th className="py-12 px-16 font-medium text-right">Rejected</th>
                <th className="py-12 px-16 font-medium">Lot / Batch (FEFO)</th>
                <th className="py-12 px-16 font-medium">Expiry Date</th>
                <th className="py-12 px-16 font-medium text-right">Unit Cost</th>
                <th className="py-12 px-20 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-control/30 transition-colors">
                  <td className="py-16 px-20">
                    <span className="font-medium text-ink block">{l.name}</span>
                    {l.qtyExpected > 0 && l.qtyExpected !== l.qtyReceived && (
                      <span className="text-body-xs text-ink-subtle">
                        Ordered: {l.qtyExpected} units
                      </span>
                    )}
                  </td>
                  <td className="py-16 px-16 text-right font-mono tabular font-medium text-ink">
                    {l.qtyReceived}
                  </td>
                  <td className="py-16 px-16 text-right">
                    {l.qtyRejected > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-stop font-mono font-medium">{l.qtyRejected}</span>
                        {l.rejectionReason && (
                          <span className="text-[11px] text-stop/80 max-w-[140px] truncate" title={l.rejectionReason}>
                            {l.rejectionReason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-16 px-16 font-mono text-ink">
                    {l.batchNumber ? (
                      <span className="px-6 py-2 rounded bg-sunken text-[12px] border border-hairline">
                        {l.batchNumber}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-16 px-16 text-ink">
                    {l.expiryDate ? (
                      <span className="font-mono text-[13px]">{l.expiryDate}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-16 px-16 text-right font-mono tabular text-ink">
                    <Money value={l.unitCostCents} />
                  </td>
                  <td className="py-16 px-20 text-right font-mono tabular font-medium text-ink">
                    <Money value={l.lineTotalCents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Variance Note */}
      {varianceNote && (
        <section className="rounded-lg border border-hairline bg-raised p-20 tablet:p-24 shadow-raised">
          <h3 className="text-body font-medium text-ink mb-4">Inspection & Delivery Remarks</h3>
          <p className="text-body-sm text-ink-subtle">{varianceNote}</p>
        </section>
      )}

      {/* Lightbox Image Preview Modal */}
      {activePhoto && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActivePhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-24 animate-in fade-in duration-200"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="absolute -top-40 right-0 size-control-md rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close image"
            >
              <IconX size={20} stroke={2} />
            </button>
            <img
              src={activePhoto}
              alt="Verification Document Full Size"
              className="max-w-[90vw] max-h-[80vh] rounded-md object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
