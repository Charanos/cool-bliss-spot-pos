'use server';

import { zonedInstant } from '@bliss/shared/time';
import { z } from 'zod';
import * as identity from '@/modules/identity/service';
import * as supplying from '@/modules/procurement/manage';
import * as procurement from '@/modules/procurement/service';
import { type ActionResult, id, isoDay, kes, optionalText, reason, requestId, runAction, wholeNumber } from '../_lib/action';

/** Purchasing actions: orders, deliveries and their variances. */

const PURCHASING = ['/console/purchasing', '/console/inventory'];

export async function raisePurchaseOrder(raw: { supplierId: string; lines: { variantId: string; qty: number; unitCost: string }[]; expectedAt: string | null; notes: string | null; requestId?: string | null }): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    supplierId: id('supplier'),
    lines: z.array(z.object({ variantId: id('item'), qty: wholeNumber('The quantity'), unitCost: kes('each unit cost') })).min(1, 'Add at least one line.').max(200, 'An order has at most 200 lines.'),
    expectedAt: isoDay.nullable(),
    notes: optionalText(500, 'Order notes'),
    requestId,
  });
  return runAction(schema, raw, (input, actor) => {
    const outlet = identity.outlet();
    const order = procurement.raisePurchaseOrder({
      supplierId: input.supplierId,
      lines: input.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitCostCents: l.unitCost })),
      // Expected around midday at the outlet, whatever the server's own time zone is.
      expectedAt: input.expectedAt ? zonedInstant(input.expectedAt, 12 * 60 * 60_000, outlet.timezone) : null,
      notes: input.notes,
      requestId: input.requestId ?? null,
      actor,
    });
    return { id: order.id };
  }, { revalidate: PURCHASING });
}

export async function cancelPurchaseOrder(raw: { purchaseOrderId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ purchaseOrderId: id('order'), reason }), raw, (input, actor) => {
    procurement.cancelPurchaseOrder({ ...input, actor });
  }, { revalidate: PURCHASING });
}

export async function approvePurchaseOrder(raw: { purchaseOrderId: string }): Promise<ActionResult> {
  return runAction(z.object({ purchaseOrderId: id('order') }), raw, (input, actor) => {
    procurement.approvePurchaseOrder({ ...input, actor });
  }, { revalidate: PURCHASING });
}

const intakeLine = z.object({
  variantId: id('item'),
  purchaseOrderLineId: z.string().max(64).nullable().optional(),
  qtyReceived: wholeNumber('The quantity received'),
  qtyExpected: wholeNumber('The quantity expected').nullable().optional(),
  qtyRejected: wholeNumber('The quantity rejected').optional(),
  rejectionReason: optionalText(500, 'A rejection reason'),
  batchNumber: optionalText(40, 'A batch number'),
  expiryDate: isoDay.nullable().optional(),
  /** Only for a delivery with no order, in shillings. */
  unitCost: kes('the unit cost').nullable().optional(),
});

export type IntakeLineForm = z.input<typeof intakeLine>;

export interface GoodsReceiptForm {
  purchaseOrderId?: string | null;
  supplierId: string;
  deliveryNoteRef: string;
  invoiceNumber?: string | null;
  mediaUrls?: string[];
  lines: IntakeLineForm[];
  varianceNote?: string | null;
  requestId?: string | null;
}

export async function recordGoodsReceipt(raw: GoodsReceiptForm): Promise<ActionResult<{ id: string; grnNumber: number }>> {
  const schema = z.object({
    purchaseOrderId: z.string().max(64).nullable().optional(),
    supplierId: id('supplier'),
    deliveryNoteRef: z.string({ error: "Enter the supplier's delivery note number." }).max(60, 'A delivery note number is at most 60 characters.'),
    invoiceNumber: optionalText(60, 'An invoice number'),
    mediaUrls: z.array(z.string().max(200)).max(12, 'Attach at most 12 photos or scans.').optional(),
    lines: z.array(intakeLine).min(1, 'Add at least one line to receive.').max(200, 'A delivery has at most 200 lines.'),
    varianceNote: optionalText(500, 'The variance note'),
    requestId,
  });
  return runAction(schema, raw, (input, actor) => {
    const receipt = procurement.recordGoodsReceipt({
      ...input,
      purchaseOrderId: input.purchaseOrderId || null,
      requestId: input.requestId ?? null,
      lines: input.lines.map(({ unitCost, ...line }) => ({ ...line, unitCostCents: unitCost ?? null })),
      actor,
    });
    return { id: receipt.id, grnNumber: receipt.grnNumber };
  }, { revalidate: PURCHASING });
}

export async function approveReceiptVariance(raw: { receiptId: string; note: string }): Promise<ActionResult> {
  return runAction(z.object({ receiptId: id('delivery'), note: reason }), raw, (input, actor) => {
    procurement.approveReceiptVariance({ ...input, actor });
  }, { revalidate: PURCHASING });
}

export async function reverseGoodsReceipt(raw: { receiptId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ receiptId: id('delivery'), reason }), raw, (input, actor) => {
    procurement.voidGoodsReceipt({ ...input, actor });
  }, { revalidate: PURCHASING });
}

/* ------------------------------------------------------------ suppliers and orders */

export async function saveSupplier(raw: {
  id?: string | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  minOrder: string;
  deliveryDays: number[];
  notes: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    id: id('supplier').nullable().optional(),
    name: z.string({ error: 'Enter a name.' }).max(60, 'A supplier name is at most 60 characters.'),
    contactName: optionalText(60, 'A contact name'),
    phone: optionalText(20, 'A phone number'),
    email: optionalText(80, 'An email address'),
    paymentTermsDays: wholeNumber('Payment terms', 120),
    leadTimeDays: wholeNumber('Lead time', 90),
    minOrder: kes('the minimum order'),
    deliveryDays: z.array(z.number().int().min(1).max(7)).max(7),
    notes: optionalText(500, 'Notes'),
  });
  return runAction(schema, raw, (input, actor) => ({ id: supplying.saveSupplier({ ...input, minOrderCents: input.minOrder, actor }).id }), { revalidate: PURCHASING });
}

export async function setSupplierStatus(raw: { id: string; status: 'active' | 'archived'; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('supplier'), status: z.enum(['active', 'archived']), reason }), raw, (input, actor) => supplying.setSupplierStatus({ ...input, actor }), { revalidate: PURCHASING });
}

export async function setSupplierItem(raw: { supplierId: string; variantId: string; supplierSku: string | null; packSize: number; cost: string }): Promise<ActionResult> {
  const schema = z.object({ supplierId: id('supplier'), variantId: id('item'), supplierSku: optionalText(32, "The supplier's code"), packSize: wholeNumber('The pack size', 1000), cost: kes('the cost') });
  return runAction(schema, raw, (input, actor) => void supplying.setSupplierItem({ ...input, costCents: input.cost, actor }), { revalidate: PURCHASING });
}

export async function removeSupplierItem(raw: { supplierId: string; variantId: string }): Promise<ActionResult> {
  return runAction(z.object({ supplierId: id('supplier'), variantId: id('item') }), raw, (input, actor) => supplying.removeSupplierItem({ ...input, actor }), { revalidate: PURCHASING });
}

export async function updatePurchaseOrder(raw: { id: string; lines: { variantId: string; qty: number; unitCost: string }[]; expectedAt: string | null; notes: string | null }): Promise<ActionResult> {
  const schema = z.object({
    id: id('order'),
    lines: z.array(z.object({ variantId: id('item'), qty: wholeNumber('The quantity'), unitCost: kes('each unit cost') })).min(1, 'Add at least one line.').max(200, 'An order has at most 200 lines.'),
    expectedAt: isoDay.nullable(),
    notes: optionalText(500, 'Order notes'),
  });
  return runAction(
    schema,
    raw,
    (input, actor) => {
      const outlet = identity.outlet();
      supplying.updatePurchaseOrder({
        id: input.id,
        lines: input.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitCostCents: l.unitCost })),
        expectedAt: input.expectedAt ? zonedInstant(input.expectedAt, 12 * 60 * 60_000, outlet.timezone) : null,
        notes: input.notes,
        actor,
      });
    },
    { revalidate: PURCHASING },
  );
}
