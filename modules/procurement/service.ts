import 'server-only';

import { DomainError } from '../_data/errors';

import type { GoodsReceipt, PurchaseOrder, PurchaseOrderLine } from '@bliss/db/seed/types';
import type { GoodsReceivedNote } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, isNegative, multiplyByQty, percentChangeBps, sum } from '@bliss/shared/money';
import { zonedInstant } from '@bliss/shared/time';
import { type Actor, checkReason, requireReasoned } from '@bliss/shared/reason';
import { UPLOAD_PATH } from '../_data/uploads';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import { procurementTables } from './schema';

export function suppliers() {
  return procurementTables().suppliers;
}

export function supplierById(id: string | null) {
  return id ? (procurementTables().suppliers.find((s) => s.id === id) ?? null) : null;
}

export function purchaseOrders() {
  return [...procurementTables().purchaseOrders].sort((a, b) => b.raisedAt - a.raisedAt);
}

export function purchaseOrderLines(poId: string) {
  return procurementTables().purchaseOrderLines.filter((l) => l.purchaseOrderId === poId && !l.removed);
}

export function receipts() {
  return [...procurementTables().receipts].sort((a, b) => b.receivedAt - a.receivedAt);
}

export function receiptLines(receiptId: string) {
  return procurementTables().receiptLines.filter((l) => l.goodsReceiptId === receiptId);
}

export function receiptById(id: string) {
  return procurementTables().receipts.find((r) => r.id === id) ?? null;
}

export function goodsReceivedNotes() {
  return procurementTables().goodsReceivedNotes;
}

/**
 * The note that documents a receipt. Linked explicitly by goodsReceiptId; a note written before that
 * link existed is matched only when the supplier, the order and the moment all agree.
 */
export function noteForReceipt(receiptId: string): GoodsReceivedNote | null {
  const receipt = receiptById(receiptId);
  if (!receipt) return null;
  const notes = procurementTables().goodsReceivedNotes;
  const linked = notes.find((n) => n.goodsReceiptId === receipt.id);
  if (linked) return linked;
  return (
    notes.find(
      (n) =>
        !n.goodsReceiptId &&
        n.supplierId === receipt.supplierId &&
        (n.purchaseOrderId ?? null) === (receipt.purchaseOrderId ?? null) &&
        Math.abs(n.receivedAt - receipt.receivedAt) < 5_000,
    ) ?? null
  );
}

export function supplierProducts(supplierId?: string) {
  return procurementTables().supplierProducts.filter((sp) => !sp.removed && (!supplierId || sp.supplierId === supplierId));
}

/** Cost movement per supplier product: the alert when a case quietly went up six per cent. */
export function costChanges() {
  return supplierProducts()
    .map((sp) => {
      const history = [...sp.history].sort((a, b) => a.at - b.at);
      const last = history[history.length - 1];
      const previous = [...history].reverse().find((h) => last && h.costCents !== last.costCents);
      if (!last || !previous) return null;
      const changeBps = percentChangeBps(previous.costCents, last.costCents);
      return { supplierProduct: sp, from: previous.costCents, to: last.costCents, changeBps, at: last.at };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.changeBps !== 0);
}

export interface ReorderSuggestion {
  variantId: string;
  supplierId: string | null;
  onHand: number;
  reorderPoint: number;
  velocityPerDay: number;
  daysCover: number | null;
  leadTimeDays: number;
  suggestedQty: number;
  estimatedCost: Cents;
  onOrder: number;
}

/** Suggestions from real 28 day velocity against reorder point and lead time. N-15. */
export function reorderSuggestions(): ReorderSuggestion[] {
  const t = procurementTables();
  const open = new Set(t.purchaseOrders.filter((p) => p.status === 'sent' || p.status === 'partially_received' || p.status === 'draft').map((p) => p.id));
  const openLines = t.purchaseOrderLines.filter((l) => open.has(l.purchaseOrderId) && !l.removed);
  return catalogue
    .stockVariants()
    .map((v) => {
      const product = catalogue.productOfVariant(v.id)!;
      const onHand = inventory.onHand(v.id);
      const velocity = inventory.velocityPerDay(v.id);
      const onOrder = openLines.filter((l) => l.productVariantId === v.id).reduce((a, l) => a + l.qtyOrdered - l.qtyReceived, 0);
      const cover = velocity > 0 ? onHand / velocity : null;
      // What is already on its way counts towards cover, or every open order would be suggested again.
      const coverWithOrders = velocity > 0 ? (onHand + onOrder) / velocity : null;
      const needed = onHand + onOrder <= product.reorderPoint || (coverWithOrders !== null && coverWithOrders <= product.leadTimeDays + 2);
      const suggestedQty = needed ? Math.max(product.reorderQty, Math.ceil(velocity * (product.leadTimeDays + 7) - onHand - onOrder)) : 0;
      const cost = inventory.averageCost(v.id);
      return {
        variantId: v.id,
        supplierId: product.defaultSupplierId,
        onHand,
        reorderPoint: product.reorderPoint,
        velocityPerDay: velocity,
        daysCover: cover,
        leadTimeDays: product.leadTimeDays,
        suggestedQty,
        estimatedCost: suggestedQty > 0 ? multiplyByQty(cost, suggestedQty) : ZERO,
        onOrder,
      };
    })
    .filter((s) => s.suggestedQty > 0)
    .sort((a, b) => (a.daysCover ?? 0) - (b.daysCover ?? 0));
}

/* ------------------------------------------------------------------ writes */

const nextId = createUuidV7();

/**
 * Purchasing reads and writes costs, so it sits behind cost.read. Proposed amendment to
 * docs/04-data-model.md: a purchase.write permission, so a stock controller can be allowed to see
 * costs without raising orders.
 */
function assertPurchasing(actor: Actor, doing: string) {
  identity.assertCan(actor.staffId, 'cost.read', doing);
}

export interface RaiseOrderLine {
  variantId: string;
  qty: number;
  unitCostCents: Cents;
}

/** N-05: raise a purchase order. It goes out as sent; Bliss makes no outbound call, the manager sends it. */
export function raisePurchaseOrder(input: { supplierId: string; lines: RaiseOrderLine[]; expectedAt: number | null; notes: string | null; requestId?: string | null; actor: Actor }): PurchaseOrder {
  assertPurchasing(input.actor, 'raising purchase orders');
  const t = procurementTables();
  const requestId = checkRequestId(input.requestId);
  if (requestId) {
    const earlier = t.purchaseOrders.find((p) => p.requestId === requestId);
    if (earlier) return earlier;
  }
  if (input.notes && input.notes.length > 500) throw new DomainError('Order notes are at most 500 characters.');
  if (input.expectedAt !== null && (!Number.isFinite(input.expectedAt) || input.expectedAt < Date.now() - 86_400_000)) throw new DomainError('The expected date cannot be in the past.');
  const supplier = t.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) throw new DomainError('Choose a supplier for this order.');
  if (supplier.status !== 'active') throw new DomainError(`${supplier.name} is archived. Bring them back in Suppliers before ordering.`);
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new DomainError('Add at least one line with a quantity.');
  if (lines.length > 200) throw new DomainError('An order has at most 200 lines.');
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty > 100_000) throw new DomainError('Order whole units: cases are entered as the units they hold.');
    if (!catalogue.variantById(l.variantId)) throw new DomainError('One of the lines is not in the catalogue.');
    if (isNegative(l.unitCostCents)) throw new DomainError('A unit cost cannot be below zero.');
  }
  const now = Date.now();
  const id = nextId();
  const orderLines: PurchaseOrderLine[] = lines.map((l) => ({
    id: nextId(),
    purchaseOrderId: id,
    productVariantId: l.variantId,
    qtyOrdered: l.qty,
    qtyReceived: 0,
    unitCostCents: l.unitCostCents,
    lineTotalCents: multiplyByQty(l.unitCostCents, l.qty),
  }));
  const total = sum(orderLines.map((l) => l.lineTotalCents));
  const order: PurchaseOrder = {
    id,
    outletId: identity.outlet().id,
    supplierId: supplier.id,
    poNumber: t.purchaseOrders.reduce((max, p) => Math.max(max, p.poNumber), 0) + 1,
    status: 'sent',
    expectedAt: input.expectedAt,
    subtotalCents: total,
    totalCents: total,
    raisedBy: input.actor.staffId,
    raisedAt: now,
    approvedBy: input.actor.staffId,
    approvedAt: now,
    notes: input.notes?.trim() || null,
    requestId,
  };
  t.purchaseOrders.push(order);
  t.purchaseOrderLines.push(...orderLines);
  audit.record({
    outletId: order.outletId,
    actorStaffId: input.actor.staffId,
    action: 'purchase_order.raised',
    entityType: 'purchase_order',
    entityId: order.id,
    before: null,
    after: { poNumber: order.poNumber, supplier: supplier.name, lines: orderLines.length, totalCents: total.toString() },
    reason: null,
    severity: 'info',
  });
  return order;
}

/** A client-generated key: uuidv7 or any 8 to 64 character token. */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

function checkRequestId(requestId: string | null | undefined): string | null {
  if (requestId === null || requestId === undefined) return null;
  if (!REQUEST_ID.test(requestId)) throw new DomainError('This form was not in a shape the server accepts. Reload the page and try again.');
  return requestId;
}

/** Expiry dates arrive as YYYY-MM-DD and mean the end of that day at the outlet. */
function expiryInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('Enter expiry dates as a date, such as 2027-03-31.');
  const outlet = identity.outlet();
  const at = zonedInstant(value, 24 * 60 * 60_000 - 1, outlet.timezone);
  if (!Number.isFinite(at)) throw new DomainError('Enter expiry dates as a date, such as 2027-03-31.');
  return at;
}

/** Cancel what is still outstanding. Anything already received stays received. */
export function cancelPurchaseOrder(input: { purchaseOrderId: string; reason: string; actor: Actor }): PurchaseOrder {
  const { reason, actor } = requireReasoned(input);
  assertPurchasing(actor, 'cancelling purchase orders');
  const order = procurementTables().purchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!order) throw new DomainError('That purchase order does not exist.');
  if (order.status === 'received' || order.status === 'cancelled') throw new DomainError(`Order ${order.poNumber} is already ${order.status}.`);
  const before = order.status;
  order.status = 'cancelled';
  audit.record({ outletId: order.outletId, actorStaffId: actor.staffId, action: 'purchase_order.cancelled', entityType: 'purchase_order', entityId: order.id, before: { status: before }, after: { status: 'cancelled' }, reason, severity: 'notable' });
  return order;
}

/** A draft raised by a stock controller goes out once someone with purchasing rights approves it. */
export function approvePurchaseOrder(input: { purchaseOrderId: string; actor: Actor }): PurchaseOrder {
  assertPurchasing(input.actor, 'approving purchase orders');
  const order = procurementTables().purchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!order) throw new DomainError('That purchase order does not exist.');
  if (order.status !== 'draft') throw new DomainError(`Order ${order.poNumber} was already approved.`);
  order.status = 'sent';
  order.approvedBy = input.actor.staffId;
  order.approvedAt = Date.now();
  audit.record({ outletId: order.outletId, actorStaffId: input.actor.staffId, action: 'purchase_order.approved', entityType: 'purchase_order', entityId: order.id, before: { status: 'draft' }, after: { status: 'sent' }, reason: null, severity: 'info' });
  return order;
}

export interface IntakeLineInput {
  variantId: string;
  qtyReceived: number;
  /** Only for a delivery with no order: what the delivery note says arrived. Against an order, what is outstanding decides. */
  qtyExpected?: number | null;
  qtyRejected?: number;
  rejectionReason?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  /** Only for a delivery with no order. Against an order, the order's cost is the cost. */
  unitCostCents?: Cents | null;
  purchaseOrderLineId?: string | null;
}

export interface RecordGoodsReceiptInput {
  purchaseOrderId?: string | null;
  supplierId: string;
  deliveryNoteRef: string;
  invoiceNumber?: string | null;
  mediaUrls?: string[];
  lines: IntakeLineInput[];
  varianceNote?: string | null;
  requestId?: string | null;
  actor: Actor;
}

/**
 * Record a delivery: a goods receipt with its lines, the note that documents it, a stock lot per
 * accepted line, and one receipt movement per lot at the delivery's cost, which moves the average.
 *
 * Against an order, every line must belong to that order, nothing may exceed what is outstanding, and
 * the order's cost is the cost. Rejected units need a reason, and a short delivery needs a variance
 * note, so the difference is never silent. A repeated submission (same request id) returns the
 * receipt it already posted.
 */
export function recordGoodsReceipt(input: RecordGoodsReceiptInput): GoodsReceipt {
  assertPurchasing(input.actor, 'receiving deliveries');
  const t = procurementTables();
  const requestId = checkRequestId(input.requestId);
  if (requestId) {
    const earlier = t.receipts.find((r) => r.requestId === requestId);
    if (earlier) return earlier;
  }

  const supplier = t.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) throw new DomainError('Choose the supplier who delivered.');
  const deliveryNoteRef = input.deliveryNoteRef.trim();
  if (deliveryNoteRef.length === 0) throw new DomainError("Enter the supplier's delivery note number.");
  if (deliveryNoteRef.length > 60) throw new DomainError('A delivery note number is at most 60 characters.');
  const invoiceNumber = input.invoiceNumber?.trim() || null;
  if (invoiceNumber && invoiceNumber.length > 60) throw new DomainError('An invoice number is at most 60 characters.');
  const mediaUrls = input.mediaUrls ?? [];
  if (mediaUrls.length > 12) throw new DomainError('Attach at most 12 photos or scans to one delivery.');
  for (const url of mediaUrls) if (!UPLOAD_PATH.test(url)) throw new DomainError('Attach photos with the upload button.');
  if (!input.lines || input.lines.length === 0) throw new DomainError('Add at least one line to receive.');
  if (input.lines.length > 200) throw new DomainError('A delivery has at most 200 lines. Split it into two receipts.');

  let order: PurchaseOrder | null = null;
  if (input.purchaseOrderId) {
    order = t.purchaseOrders.find((p) => p.id === input.purchaseOrderId) ?? null;
    if (!order) throw new DomainError('That purchase order does not exist. Choose it again, or receive without an order.');
    if (order.status !== 'sent' && order.status !== 'partially_received') throw new DomainError(`Order ${order.poNumber} is ${order.status.replace('_', ' ')} and cannot be received against.`);
    if (order.supplierId !== supplier.id) throw new DomainError(`Order ${order.poNumber} is with ${supplierById(order.supplierId)?.name ?? 'another supplier'}, not ${supplier.name}.`);
  }
  const orderLines = order ? t.purchaseOrderLines.filter((l) => l.purchaseOrderId === order.id && !l.removed) : [];
  const claimed = new Map<string, number>();

  let short = false;
  const checked = input.lines.map((line) => {
    const variant = catalogue.variantById(line.variantId);
    if (!variant) throw new DomainError('One of the lines is not in the catalogue.');
    const name = variant.name;
    const qtyReceived = line.qtyReceived;
    const qtyRejected = line.qtyRejected ?? 0;
    if (!Number.isInteger(qtyReceived) || !Number.isInteger(qtyRejected) || qtyReceived < 0 || qtyRejected < 0 || qtyReceived > 100_000 || qtyRejected > 100_000) {
      throw new DomainError(`Enter whole units for ${name}.`);
    }
    if (qtyRejected > 0) {
      const check = checkReason(line.rejectionReason ?? '');
      if (!check.ok) throw new DomainError(`Say why ${qtyRejected} × ${name} were rejected. ${check.message}`);
    }
    const batchNumber = line.batchNumber?.trim() || null;
    if (batchNumber && batchNumber.length > 40) throw new DomainError(`The batch number for ${name} is at most 40 characters.`);
    const expiry = expiryInstant(line.expiryDate);

    let orderLine: PurchaseOrderLine | null = null;
    let qtyExpected: number;
    let unitCostCents: Cents;
    if (order) {
      // Match the named order line, or the first line for this item that still has room.
      orderLine = line.purchaseOrderLineId
        ? (orderLines.find((l) => l.id === line.purchaseOrderLineId) ?? null)
        : (orderLines.find((l) => l.productVariantId === line.variantId && l.qtyOrdered - l.qtyReceived - (claimed.get(l.id) ?? 0) > 0) ?? null);
      if (!orderLine || orderLine.productVariantId !== line.variantId) throw new DomainError(`${name} is not on order ${order.poNumber}. Receive it without an order, or remove the line.`);
      const outstanding = orderLine.qtyOrdered - orderLine.qtyReceived - (claimed.get(orderLine.id) ?? 0);
      if (qtyReceived + qtyRejected > outstanding) throw new DomainError(`${name} has ${outstanding} outstanding on order ${order.poNumber}. Enter no more than that.`);
      claimed.set(orderLine.id, (claimed.get(orderLine.id) ?? 0) + qtyReceived + qtyRejected);
      qtyExpected = outstanding;
      unitCostCents = orderLine.unitCostCents;
    } else {
      qtyExpected = line.qtyExpected ?? qtyReceived + qtyRejected;
      if (!Number.isInteger(qtyExpected) || qtyExpected < 0) throw new DomainError(`Enter whole units expected for ${name}.`);
      if (line.unitCostCents !== null && line.unitCostCents !== undefined) {
        if (isNegative(line.unitCostCents)) throw new DomainError(`The unit cost for ${name} cannot be below zero.`);
        unitCostCents = line.unitCostCents;
      } else {
        const known = t.supplierProducts.find((p) => p.supplierId === supplier.id && p.productVariantId === line.variantId);
        unitCostCents = known ? known.lastCostCents : inventory.averageCost(line.variantId);
      }
    }
    if (qtyReceived < qtyExpected) short = true;
    return { line, variant, orderLine, qtyExpected, qtyReceived, qtyRejected, unitCostCents, batchNumber, expiry };
  });

  if (checked.every((c) => c.qtyReceived === 0 && c.qtyRejected === 0)) throw new DomainError('Enter at least one received quantity.');
  const varianceNote = input.varianceNote?.trim() || null;
  if (short && !checkReason(varianceNote ?? '').ok) throw new DomainError('Part of this delivery is short. Add a variance note of at least 10 characters saying what happens to the rest.');

  const store = inventory.locations().find((l) => l.isDefaultReceipt) ?? inventory.locations()[0]!;
  const now = Date.now();
  const receipt: GoodsReceipt = {
    id: nextId(),
    outletId: identity.outlet().id,
    purchaseOrderId: order?.id ?? null,
    supplierId: supplier.id,
    grnNumber: t.receipts.reduce((max, r) => Math.max(max, r.grnNumber), 0) + 1,
    deliveryNoteRef,
    receivedAt: now,
    receivedBy: input.actor.staffId,
    stockLocationId: store.id,
    status: 'posted',
    varianceNote,
    requestId,
  };
  t.receipts.push(receipt);

  const note: GoodsReceivedNote = {
    id: nextId(),
    outletId: receipt.outletId,
    purchaseOrderId: receipt.purchaseOrderId,
    supplierId: supplier.id,
    goodsReceiptId: receipt.id,
    invoiceNumber,
    mediaUrls,
    status: short ? 'pending_variance_approval' : 'approved',
    receivedBy: input.actor.staffId,
    receivedAt: now,
    deviceTime: now,
    varianceApprovedBy: null,
    varianceApprovedAt: null,
  };
  t.goodsReceivedNotes.push(note);

  for (const c of checked) {
    if (c.qtyReceived === 0 && c.qtyRejected === 0) continue;
    t.receiptLines.push({
      id: nextId(),
      goodsReceiptId: receipt.id,
      purchaseOrderLineId: c.orderLine?.id ?? null,
      productVariantId: c.variant.id,
      qtyExpected: c.qtyExpected,
      qtyReceived: c.qtyReceived,
      qtyRejected: c.qtyRejected,
      rejectionReason: c.qtyRejected > 0 ? (c.line.rejectionReason?.trim() ?? null) : null,
      unitCostCents: c.unitCostCents,
    });
    // Only accepted units count as received. Units sent back stay outstanding, so a replacement can be
    // received against the same order, or the remainder cancelled with a reason.
    if (c.orderLine) c.orderLine.qtyReceived += c.qtyReceived;
    if (c.qtyReceived > 0) {
      const lot = inventory.createBatch({
        variantId: c.variant.id,
        locationId: store.id,
        qty: c.qtyReceived,
        unitCostCents: c.unitCostCents,
        batchNumber: c.batchNumber,
        expiryDate: c.expiry,
        actor: input.actor,
      });
      inventory.recordMovement({
        variantId: c.variant.id,
        locationId: store.id,
        stockBatchId: lot.id,
        qtyDelta: c.qtyReceived,
        type: 'receipt',
        sourceType: 'goods_receipt',
        sourceId: receipt.id,
        reason: null,
        actor: input.actor,
        unitCostCents: c.unitCostCents,
      });
    }
  }

  let orderStatus: { before: string; after: string } | null = null;
  if (order) {
    const before = order.status;
    order.status = orderLines.every((l) => l.qtyReceived >= l.qtyOrdered) ? 'received' : 'partially_received';
    orderStatus = { before, after: order.status };
  }
  audit.record({
    outletId: receipt.outletId,
    actorStaffId: input.actor.staffId,
    action: 'goods_receipt.posted',
    entityType: 'goods_receipt',
    entityId: receipt.id,
    before: orderStatus ? { orderStatus: orderStatus.before } : null,
    after: { grnNumber: receipt.grnNumber, deliveryNoteRef, supplier: supplier.name, ...(orderStatus ? { orderStatus: orderStatus.after } : null), short },
    reason: varianceNote,
    severity: short ? 'notable' : 'info',
  });
  return receipt;
}

/** Accept the difference on a short delivery, once someone has looked at it. */
export function approveReceiptVariance(input: { receiptId: string; note: string; actor: Actor }) {
  const { reason, actor } = requireReasoned({ reason: input.note, actor: input.actor });
  identity.assertCan(actor.staffId, 'stock.count.commit', 'approving delivery variances');
  const note = noteForReceipt(input.receiptId);
  if (!note) throw new DomainError('That delivery has no note to approve.');
  if (note.status !== 'pending_variance_approval') throw new DomainError('That delivery has no variance waiting for approval.');
  if (note.receivedBy === actor.staffId) throw new DomainError('Ask someone other than the person who received it to approve the variance.');
  note.status = 'approved';
  note.varianceApprovedBy = actor.staffId;
  note.varianceApprovedAt = Date.now();
  audit.record({ outletId: note.outletId, actorStaffId: actor.staffId, action: 'goods_receipt.variance_approved', entityType: 'goods_receipt', entityId: input.receiptId, before: { status: 'pending_variance_approval' }, after: { status: 'approved' }, reason, severity: 'notable' });
  return note;
}

/**
 * Reverse a posted delivery: the accepted units go back to the supplier, out of the lots this
 * delivery created, and the order lines it filled are open again. Refused when some of the stock has
 * already been sold or moved, because the ledger cannot give back what is not there.
 */
export function voidGoodsReceipt(input: { receiptId: string; reason: string; actor: Actor }) {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'stock.writeoff', 'reversing deliveries');
  const t = procurementTables();
  const receipt = t.receipts.find((r) => r.id === input.receiptId);
  if (!receipt) throw new DomainError('That delivery does not exist.');
  if (receipt.status === 'cancelled') throw new DomainError(`GRN ${receipt.grnNumber} was already reversed.`);

  const lines = t.receiptLines.filter((l) => l.goodsReceiptId === receipt.id && l.qtyReceived > 0);
  const receiptMovements = inventory.movements({ type: 'receipt' }).filter((m) => m.sourceType === 'goods_receipt' && m.sourceId === receipt.id);
  for (const line of lines) {
    const lot = receiptMovements.find((m) => m.productVariantId === line.productVariantId && m.qtyDelta === line.qtyReceived);
    const lotRow = lot?.stockBatchId ? inventory.batches().find((b) => b.id === lot.stockBatchId) : null;
    const name = catalogue.variantById(line.productVariantId)?.name ?? 'An item';
    if (lotRow && lotRow.remainingQty < line.qtyReceived) throw new DomainError(`${name} from this delivery has already been used. Record a write-off or count adjustment instead.`);
    if (inventory.onHand(line.productVariantId, receipt.stockLocationId) < line.qtyReceived) throw new DomainError(`${name} is no longer in ${inventory.locations().find((l) => l.id === receipt.stockLocationId)?.name ?? 'the store'} in that quantity. Record a write-off or count adjustment instead.`);
  }

  for (const line of lines) {
    const lot = receiptMovements.find((m) => m.productVariantId === line.productVariantId && m.qtyDelta === line.qtyReceived);
    if (lot?.stockBatchId) inventory.drawFromBatch(lot.stockBatchId, line.qtyReceived);
    inventory.recordMovement({
      variantId: line.productVariantId,
      locationId: receipt.stockLocationId,
      stockBatchId: lot?.stockBatchId ?? null,
      qtyDelta: -line.qtyReceived,
      type: 'return_to_supplier',
      sourceType: 'goods_receipt',
      sourceId: receipt.id,
      reason,
      actor,
    });
    const orderLine = line.purchaseOrderLineId ? t.purchaseOrderLines.find((l) => l.id === line.purchaseOrderLineId) : null;
    if (orderLine) orderLine.qtyReceived = Math.max(0, orderLine.qtyReceived - line.qtyReceived);
  }
  const order = receipt.purchaseOrderId ? t.purchaseOrders.find((p) => p.id === receipt.purchaseOrderId) : null;
  if (order && order.status !== 'cancelled') {
    const orderLines = t.purchaseOrderLines.filter((l) => l.purchaseOrderId === order.id);
    order.status = orderLines.every((l) => l.qtyReceived === 0) ? 'sent' : orderLines.every((l) => l.qtyReceived >= l.qtyOrdered) ? 'received' : 'partially_received';
  }

  const before = receipt.status;
  receipt.status = 'cancelled';
  receipt.cancelledBy = actor.staffId;
  receipt.cancelledAt = Date.now();
  receipt.cancelReason = reason;
  audit.record({
    outletId: receipt.outletId,
    actorStaffId: actor.staffId,
    action: 'goods_receipt.reversed',
    entityType: 'goods_receipt',
    entityId: receipt.id,
    before: { status: before, grnNumber: receipt.grnNumber },
    after: { status: 'cancelled' },
    reason,
    severity: 'sensitive',
  });
  return receipt;
}
