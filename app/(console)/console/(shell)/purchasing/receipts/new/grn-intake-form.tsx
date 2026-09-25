'use client';

import { useState, useTransition, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { 
  IconAlertTriangle, 
  IconCamera, 
  IconCheck, 
  IconChevronDown, 
  IconEye, 
  IconPhotoPlus, 
  IconPlus, 
  IconRefresh, 
  IconTrash, 
  IconUpload, 
  IconX 
} from '@tabler/icons-react';
import { Button } from '@bliss/ui/components/button';
import { TextField, FieldFrame } from '@bliss/ui/components/fields';
import { cx } from '@bliss/ui/lib/cx';
import type { Cents } from '@bliss/shared/money';
import { recordGoodsReceipt } from '../../../_actions';

const selectUnderline = "relative flex min-w-0 items-center gap-8 border-b border-ink-subtle/60 transition-[border-color] duration-[160ms] focus-within:border-accent after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:origin-left after:scale-x-0 after:bg-accent after:content-[''] after:transition-transform after:duration-[160ms] focus-within:after:scale-x-100";

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  id
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(options.length * 44 + 8, 280);
    const below = rect.bottom + 4 + dropdownHeight <= window.innerHeight;
    const top = below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - dropdownHeight);
    setPosition({ top, left: rect.left, width: rect.width });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="flex min-w-0 flex-col w-full">
      <FieldFrame label={label} htmlFor={id || 'custom-select'}>
        <div 
          ref={buttonRef}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
          className={cx(
            selectUnderline,
            "h-control-md w-full bg-transparent cursor-pointer outline-none select-none",
            open ? "border-accent after:scale-x-100" : "hover:border-ink-muted",
            disabled ? "opacity-60 cursor-not-allowed hover:border-ink-subtle/60" : ""
          )}
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <span className={cx("flex-1 min-w-0 truncate text-body", selectedOption ? "text-ink" : "text-ink-subtle")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <IconChevronDown size={16} stroke={2} className={cx("shrink-0 text-ink-subtle transition-transform duration-200", open && "rotate-180")} />
        </div>
      </FieldFrame>
      
      {open && typeof document !== 'undefined' && position
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-lenis-prevent=""
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 9999,
                backgroundColor: 'var(--bliss-overlay, #F4F7F9)',
              }}
              className="rounded-md border border-hairline bg-overlay py-4 shadow-lift max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            >
              {options.length === 0 ? (
                <div className="px-16 py-12 text-body-sm text-ink-subtle">No options available</div>
              ) : (
                options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    className={cx(
                      "flex min-h-row w-full items-center px-16 text-left text-body-sm transition-colors cursor-pointer",
                      value === o.value ? "bg-accent-wash text-accent font-medium" : "text-ink hover:bg-control-hover"
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export interface IntakeFormLine {
  id: string;
  purchaseOrderLineId?: string | null;
  variantId: string;
  qtyExpected?: number;
  qtyReceived: number;
  qtyRejected: number;
  rejectionReason: string;
  batchNumber: string;
  expiryDate: string;
  unitCostCents?: Cents | number;
}

export function GrnIntakeForm({ 
  actorId,
  stores,
  suppliers,
  variants,
  prefillOrder
}: { 
  actorId: string;
  stores: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  variants: { id: string; name: string; supplierIds: string[]; unitCostCents: Cents | number }[];
  prefillOrder?: {
    id: string;
    poNumber: number;
    supplierId: string;
    lines: {
      id: string;
      purchaseOrderLineId?: string;
      variantId: string;
      qtyExpected: number;
      qtyReceived: number;
      unitCostCents: Cents | number;
    }[];
  } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form Origin & References
  const [supplierId, setSupplierId] = useState(prefillOrder?.supplierId || '');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [etimsInvoiceRef, setEtimsInvoiceRef] = useState('');
  const [varianceNote, setVarianceNote] = useState('');

  // Real Photo Uploads
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Line items state (Full CRUD)
  const [lines, setLines] = useState<IntakeFormLine[]>(() => {
    if (prefillOrder?.lines) {
      return prefillOrder.lines.map((l) => ({
        id: l.id,
        purchaseOrderLineId: l.purchaseOrderLineId || l.id,
        variantId: l.variantId,
        qtyExpected: l.qtyExpected,
        qtyReceived: l.qtyReceived,
        qtyRejected: 0,
        rejectionReason: '',
        batchNumber: '',
        expiryDate: '',
        unitCostCents: l.unitCostCents,
      }));
    }
    return [];
  });

  // Create Line Item
  const addLine = () => {
    const firstAvailableVariant = variants.find(v => !supplierId || v.supplierIds.includes(supplierId)) || variants[0];
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variantId: firstAvailableVariant?.id || '',
        qtyExpected: 0,
        qtyReceived: 1,
        qtyRejected: 0,
        rejectionReason: '',
        batchNumber: '',
        expiryDate: '',
        unitCostCents: firstAvailableVariant?.unitCostCents || 0,
      }
    ]);
  };

  // Update Line Item
  const updateLine = (index: number, field: keyof IntakeFormLine, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      const current = { ...updated[index]!, [field]: value };

      // When variant changes, update default cost
      if (field === 'variantId') {
        const selected = variants.find(v => v.id === value);
        if (selected) {
          current.unitCostCents = selected.unitCostCents;
        }
      }
      updated[index] = current;
      return updated;
    });
  };

  // Delete Line Item
  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Real File Upload Handler
  const uploadFiles = async (files: File[]) => {
    setUploadError(null);
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      setUploadError('Only valid image files (JPG, PNG, WebP) are supported.');
      return;
    }
    const oversized = validImages.find(f => f.size > 15 * 1024 * 1024);
    if (oversized) {
      setUploadError(`File "${oversized.name}" exceeds the 15MB size limit.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of validImages) {
        formData.append('files', file);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to upload photo.');
      }

      if (Array.isArray(data.urls) && data.urls.length > 0) {
        setMediaUrls((prev) => [...prev, ...data.urls]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void uploadFiles(Array.from(e.target.files));
    }
  };

  const removePhoto = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submission with Real Database Persistence
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }
    if (!deliveryNoteRef.trim()) {
      setError("Please enter the supplier's Delivery Note Reference.");
      return;
    }
    if (lines.length === 0) {
      setError('Please add at least one line item to record intake.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.variantId) {
        setError(`Line #${i + 1} has no product variant selected.`);
        return;
      }
      if (line.qtyReceived < 0) {
        setError(`Line #${i + 1} quantity received cannot be negative.`);
        return;
      }
      if (line.qtyRejected > 0 && !line.rejectionReason.trim()) {
        setError(`Line #${i + 1} has ${line.qtyRejected} rejected units. Please enter a rejection reason.`);
        return;
      }
    }

    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qtyReceived) || 0) + (Number(l.qtyRejected) || 0), 0);
    if (totalQty === 0) {
      setError('At least one line item must have a quantity received or rejected greater than zero.');
      return;
    }

    setError(null);
    start(async () => {
      try {
        const result = await recordGoodsReceipt({
          purchaseOrderId: prefillOrder?.id || null,
          supplierId,
          deliveryNoteRef: deliveryNoteRef.trim(),
          invoiceNumber: invoiceNumber.trim() || null,
          etimsInvoiceRef: etimsInvoiceRef.trim() || null,
          varianceNote: varianceNote.trim() || null,
          mediaUrls,
          lines: lines.map((l) => ({
            variantId: l.variantId,
            purchaseOrderLineId: l.purchaseOrderLineId || null,
            qtyReceived: Math.max(0, Math.floor(Number(l.qtyReceived) || 0)),
            qtyExpected: l.qtyExpected !== undefined ? Number(l.qtyExpected) : undefined,
            qtyRejected: Math.max(0, Math.floor(Number(l.qtyRejected) || 0)),
            rejectionReason: l.rejectionReason.trim() || null,
            batchNumber: l.batchNumber.trim() || null,
            expiryDate: l.expiryDate || null,
            unitCostCents: l.unitCostCents || undefined,
          })),
        });

        if (!result.ok) {
          setError(result.message);
          return;
        }

        router.push('/console/purchasing/receipts');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record goods receipt.');
      }
    });
  };

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  // Filter variants by chosen supplier if available, else show all
  const filteredVariantOptions = variants
    .filter((v) => !supplierId || v.supplierIds.includes(supplierId))
    .map((v) => ({ value: v.id, label: v.name }));

  const fallbackVariantOptions = variants.map((v) => ({ value: v.id, label: v.name }));
  const variantOptions = filteredVariantOptions.length > 0 ? filteredVariantOptions : fallbackVariantOptions;

  const totalAcceptedUnits = lines.reduce((sum, l) => sum + (Number(l.qtyReceived) || 0), 0);
  const totalRejectedUnits = lines.reduce((sum, l) => sum + (Number(l.qtyRejected) || 0), 0);

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full flex justify-center pb-96 animate-in fade-in duration-300">
        <div className="w-full max-w-[760px] flex flex-col gap-32 tablet:gap-40">
          
          {/* Origin & Delivery Section */}
          <section>
            <div className="mb-12">
              <h2 className="text-body font-medium text-ink">Delivery & Origin</h2>
              <p className="text-body-sm text-ink-subtle mt-4">Ensure supplier and references match the physical delivery note.</p>
            </div>
            <div className="rounded-lg border border-hairline bg-raised p-24 tablet:p-32 flex flex-col gap-24 shadow-raised">
              <CustomSelect 
                id="supplierId"
                label="Supplier"
                value={supplierId}
                onChange={(val: string) => setSupplierId(val)}
                disabled={!!prefillOrder}
                options={supplierOptions}
                placeholder="Select supplier..."
              />
              <TextField 
                id="deliveryNoteRef"
                label="Delivery Note Reference *"
                size="md"
                value={deliveryNoteRef}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryNoteRef(e.target.value)}
                required
                placeholder="e.g. DN-2026-1042"
              />
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-24">
                <TextField 
                  id="invoiceNumber"
                  label="Supplier Invoice Number (Optional)"
                  size="md"
                  value={invoiceNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-0092"
                />
                <TextField 
                  id="etimsInvoiceRef"
                  label="eTIMS KRA Ref"
                  size="md"
                  value={etimsInvoiceRef}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEtimsInvoiceRef(e.target.value)}
                  placeholder="e.g. KRA-2026-VAT-901"
                />
              </div>
              <TextField 
                id="varianceNote"
                label="Delivery & Inspection Remarks (Optional)"
                size="md"
                value={varianceNote}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVarianceNote(e.target.value)}
                placeholder="e.g. Truck seal verified intact, chilled crates delivered at 4°C."
              />
            </div>
          </section>

          {/* Verification Documents & Photos Section */}
          <section>
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-body font-medium text-ink">Verification Documents & Photos</h2>
                <p className="text-body-sm text-ink-subtle mt-4">Upload or photograph delivery notes, stamped invoices, and crates.</p>
              </div>
              <div className="flex items-center gap-8">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={IconCamera}
                  onClick={() => cameraInputRef.current?.click()}
                  title="Take photo using camera"
                >
                  Camera
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={IconUpload}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload from device"
                >
                  Upload
                </Button>
              </div>
            </div>

            {/* Hidden inputs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              multiple 
              onChange={handleFileInputChange} 
              className="hidden" 
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileInputChange} 
              className="hidden" 
            />

            <div 
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  void uploadFiles(Array.from(e.dataTransfer.files));
                }
              }}
              className={cx(
                "rounded-lg border bg-raised p-20 tablet:p-24 shadow-raised transition-all duration-200",
                isDragging ? "border-accent bg-accent-wash/30 scale-[1.005]" : "border-hairline"
              )}
            >
              {mediaUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-16">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="group relative aspect-square rounded-md overflow-hidden bg-sunken border border-hairline shadow-sm">
                      <img 
                        src={url} 
                        alt={`Document ${i + 1}`} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                        onClick={() => setPreviewImage(url)}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                      
                      {/* Photo Badge */}
                      <span className="absolute top-8 left-8 bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono px-6 py-2 rounded-sm pointer-events-none">
                        #{i + 1}
                      </span>

                      {/* Action buttons */}
                      <div className="absolute top-8 right-8 flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(url)}
                          className="size-control-sm bg-black/70 hover:bg-black text-white rounded-sm flex items-center justify-center shadow-raised transition-colors"
                          title="View Full Size"
                        >
                          <IconEye size={15} stroke={2} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => removePhoto(i)}
                          className="size-control-sm bg-stop hover:bg-stop/90 text-white rounded-sm flex items-center justify-center shadow-raised transition-colors"
                          title="Remove photo"
                        >
                          <IconTrash size={15} stroke={2} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {uploading && (
                    <div className="aspect-square rounded-md border border-hairline bg-sunken/60 flex flex-col items-center justify-center gap-8 animate-pulse">
                      <IconRefresh size={22} className="animate-spin text-accent" />
                      <span className="text-body-xs text-ink-subtle font-medium">Uploading...</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative aspect-square rounded-md border border-dashed border-hairline hover:border-accent bg-sunken/40 hover:bg-control flex flex-col items-center justify-center transition-colors cursor-pointer"
                  >
                    <div className="size-control-sm rounded-full bg-raised group-hover:bg-accent-wash flex items-center justify-center mb-6 shadow-raised transition-colors">
                      <IconPlus size={16} stroke={2} className="text-ink-subtle group-hover:text-accent" />
                    </div>
                    <span className="text-body-sm font-medium text-ink-subtle group-hover:text-accent">Add Photo</span>
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-hairline bg-sunken/40 py-32 px-16 text-center hover:border-accent hover:bg-control transition-colors cursor-pointer"
                >
                  <div className="mb-12 flex size-control-lg items-center justify-center rounded-full bg-raised text-ink-subtle group-hover:text-accent shadow-raised transition-colors">
                    {uploading ? (
                      <IconRefresh size={24} className="animate-spin text-accent" />
                    ) : (
                      <IconPhotoPlus size={24} stroke={1.5} />
                    )}
                  </div>
                  <h3 className="text-body font-medium text-ink group-hover:text-accent transition-colors">
                    {uploading ? "Uploading images..." : "Photograph or Upload Documents"}
                  </h3>
                  <p className="text-body-sm text-ink-subtle mt-4 max-w-[420px]">
                    Drag & drop stamped supplier invoices, crate seals, or delivery notes here, or tap to choose files from device
                  </p>
                </div>
              )}

              {uploadError && (
                <div className="mt-12 p-12 bg-stop-wash text-stop rounded-md flex items-center gap-8 text-body-sm">
                  <IconAlertTriangle size={16} stroke={2} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </section>

          {/* Line Items Section (Full CRUD) */}
          <section>
            <div className="mb-12 flex items-center justify-between">
              <div>
                <h2 className="text-body font-medium text-ink">Line Items Intake</h2>
                <p className="text-body-sm text-ink-subtle mt-4">Inspect quantities, log damaged rejections, and record FEFO batch expiry dates.</p>
              </div>
              <div className="flex items-center gap-8">
                {lines.length > 0 && !prefillOrder && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLines([])}
                    title="Clear all line items"
                  >
                    Clear All
                  </Button>
                )}
                {!prefillOrder && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    icon={IconPlus} 
                    onClick={addLine} 
                    size="sm"
                  >
                    Add Item
                  </Button>
                )}
              </div>
            </div>
            
            <div className="rounded-lg border border-hairline bg-raised shadow-raised overflow-hidden">
              {lines.length === 0 ? (
                <div className="py-40 text-center px-16">
                  <div className="size-control-lg rounded-full bg-sunken mx-auto flex items-center justify-center mb-12 text-ink-muted">
                    <IconAlertTriangle size={24} stroke={1.5} />
                  </div>
                  <p className="text-body font-medium text-ink">No items added to this intake receipt</p>
                  <p className="text-body-sm text-ink-subtle mt-4">Add products manually to accept stock, or intake against a Purchase Order.</p>
                  <div className="mt-16">
                    <Button type="button" variant="primary" icon={IconPlus} size="sm" onClick={addLine}>
                      Add First Line Item
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {lines.map((line, idx) => {
                    const selectedVariant = variants.find(v => v.id === line.variantId);
                    return (
                      <div key={line.id} className="p-20 tablet:p-24 hover:bg-control/20 transition-colors relative group">
                        {/* Remove item button */}
                        {!prefillOrder && (
                          <button 
                            type="button" 
                            onClick={() => removeLine(idx)} 
                            className="absolute top-16 right-16 size-control-sm text-ink-subtle hover:text-stop hover:bg-stop-wash rounded-sm transition-colors flex items-center justify-center"
                            title="Remove line item"
                          >
                            <IconX size={16} stroke={2} />
                          </button>
                        )}

                        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-24 pr-16" style={{ gap: '24px' }}>
                          {/* Product Variant Choice */}
                          <div className="tablet:col-span-2">
                            {prefillOrder ? (
                              <div className="flex flex-col">
                                <span className="text-label text-ink-subtle">Product Variant</span>
                                <span className="text-body font-medium text-ink mt-4">
                                  {selectedVariant?.name || 'Unknown Variant'}
                                </span>
                              </div>
                            ) : (
                              <CustomSelect 
                                id={`variant-${idx}`}
                                label={`Line #${idx + 1} Product Variant`}
                                value={line.variantId}
                                onChange={(val: string) => updateLine(idx, 'variantId', val)}
                                placeholder="Select sealed product variant..."
                                options={variantOptions}
                              />
                            )}
                          </div>
                          
                          {/* Quantity Accepted */}
                          <div>
                            <TextField 
                              id={`qty-received-${idx}`}
                              label={prefillOrder ? `Units Accepted (Ordered: ${line.qtyExpected})` : "Units Accepted"}
                              type="number"
                              min="0"
                              size="md"
                              value={line.qtyReceived || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(idx, 'qtyReceived', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>

                          {/* Quantity Rejected (Damaged / Shortfall) */}
                          <div>
                            <TextField 
                              id={`qty-rejected-${idx}`}
                              label="Units Rejected / Returned"
                              type="number"
                              min="0"
                              size="md"
                              value={line.qtyRejected || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(idx, 'qtyRejected', parseInt(e.target.value) || 0)}
                              placeholder="0 (e.g. broken or expired)"
                            />
                          </div>

                          {/* Rejection Reason (shown if any units were rejected) */}
                          {line.qtyRejected > 0 && (
                            <div className="tablet:col-span-2 p-16 rounded-md bg-stop-wash/30 border border-stop/20 flex flex-col gap-8">
                              <TextField 
                                id={`rejection-reason-${idx}`}
                                label={`Reason for Rejecting ${line.qtyRejected} Unit(s) *`}
                                size="md"
                                value={line.rejectionReason}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(idx, 'rejectionReason', e.target.value)}
                                placeholder="e.g. Broken seal, damaged crate, or expired on arrival"
                                required
                              />
                              <div className="flex flex-wrap items-center gap-6 mt-4">
                                <span className="text-body-xs text-ink-subtle">Quick reasons:</span>
                                {["Damaged in transit", "Expired / Short shelf-life", "Broken seal / Leakage", "Wrong item delivered"].map((reason) => (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => updateLine(idx, 'rejectionReason', reason)}
                                    className="px-8 py-2 text-[12px] rounded-full bg-raised hover:bg-control text-ink border border-hairline transition-colors cursor-pointer"
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Batch / Lot Number */}
                          <div>
                            <TextField 
                              id={`batch-${idx}`}
                              label="Lot / Batch Number (FEFO)"
                              size="md"
                              value={line.batchNumber}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(idx, 'batchNumber', e.target.value)}
                              placeholder="e.g. B-9021A (Optional)"
                            />
                          </div>
                          
                          {/* Expiry Date */}
                          <div>
                            <TextField 
                              id={`expiry-${idx}`}
                              label="Expiration Date (FEFO)"
                              type="date"
                              size="md"
                              value={line.expiryDate}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLine(idx, 'expiryDate', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          
          {/* Form Error Banner */}
          {error && (
            <div className="p-16 bg-stop-wash text-stop rounded-md flex items-start gap-12 border border-stop/30 animate-in fade-in">
              <IconAlertTriangle size={20} stroke={2} className="shrink-0 mt-2" />
              <p className="text-body-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Sticky Bottom Bar */}
        <div 
          className="fixed bottom-0 inset-x-0 ml-rail-console border-t border-hairline bg-raised/95 backdrop-blur-md z-30 shadow-raised"
          style={{ paddingTop: '16px', paddingBottom: '16px', paddingLeft: '24px', paddingRight: '24px' }}
        >
          <div className="max-w-[760px] mx-auto flex items-center justify-between" style={{ gap: '20px' }}>
            <div className="flex items-center" style={{ gap: '12px' }}>
              <span 
                className={cx("rounded-full shrink-0 transition-colors", lines.length > 0 ? "bg-accent" : "bg-ink-disabled")} 
                style={{ width: '8px', height: '8px' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--bliss-text-subtle)', fontWeight: 500 }}>
                {lines.length === 0 ? (
                  "No line items added"
                ) : (
                  `${lines.length} ${lines.length === 1 ? 'item' : 'items'} · ${totalAcceptedUnits} accepted${totalRejectedUnits > 0 ? ` · ${totalRejectedUnits} rejected` : ''}`
                )}
              </span>
            </div>

            <div className="flex items-center" style={{ gap: '12px' }}>
              <Button 
                variant="secondary" 
                onClick={() => router.push('/console/purchasing/receipts')} 
                size="sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                loading={pending} 
                icon={IconCheck} 
                size="sm"
                disabled={lines.length === 0 || pending}
                style={{ paddingLeft: '16px', paddingRight: '16px', fontWeight: 500, height: '38px' }}
              >
                Commit Intake
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Lightbox Image Preview Modal */}
      {previewImage && typeof document !== 'undefined' && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-24 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-40 right-0 size-control-md rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close image"
            >
              <IconX size={20} stroke={2} />
            </button>
            <img 
              src={previewImage} 
              alt="Document Verification Full Size" 
              className="max-w-[90vw] max-h-[80vh] rounded-md object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
