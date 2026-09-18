import 'server-only';

import type { GoodsReceipt, PurchaseOrder, PurchaseOrderLine } from '@bliss/db/seed/types';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, isNegative, multiplyByQty, percentChangeBps, sum } from '@bliss/shared/money';
import { type Actor, checkReason, requireReasoned } from '@bliss/shared/reason';
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
  return procurementTables().purchaseOrderLines.filter((l) => l.purchaseOrderId === poId);
}

export function receipts() {
  return [...procurementTables().receipts].sort((a, b) => b.receivedAt - a.receivedAt);
}

export function receiptLines(receiptId: string) {
  return procurementTables().receiptLines.filter((l) => l.goodsReceiptId === receiptId);
}

export function supplierProducts(supplierId?: string) {
  return procurementTables().supplierProducts.filter((sp) => !supplierId || sp.supplierId === supplierId);
}

/** Cost movement per supplier product: the alert when a case quietly went up six per cent. */
export function costChanges() {
  return procurementTables()
    .supplierProducts.map((sp) => {
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
  const openLines = t.purchaseOrderLines.filter((l) => open.has(l.purchaseOrderId));
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
export function raisePurchaseOrder(input: { supplierId: string; lines: RaiseOrderLine[]; expectedAt: number | null; notes: string | null; actor: Actor }): PurchaseOrder {
  assertPurchasing(input.actor, 'raising purchase orders');
  const t = procurementTables();
  const supplier = t.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) throw new Error('Choose a supplier for this order.');
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new Error('Add at least one line with a quantity.');
  for (const l of lines) {
    if (!Number.isInteger(l.qty)) throw new Error('Order whole units: cases are entered as the units they hold.');
    if (!catalogue.variantById(l.variantId)) throw new Error('One of the lines is not in the catalogue.');
    if (isNegative(l.unitCostCents)) throw new Error('A unit cost cannot be below zero.');
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

export interface ReceiveLine {
  purchaseOrderLineId: string;
  qtyReceived: number;
  qtyRejected: number;
  rejectionReason: string | null;
}

/**
 * N-05: receive against a purchase order. Accepted units post receipt movements into the store at the
 * order's cost, which moves the average; rejected units need a reason. A short delivery leaves the
 * order partially received and needs a variance note, so the difference is never silent.
 */
export function receiveAgainstOrder(input: { purchaseOrderId: string; deliveryNoteRef: string; lines: ReceiveLine[]; varianceNote: string | null; actor: Actor }): GoodsReceipt {
  assertPurchasing(input.actor, 'receiving deliveries');
  const t = procurementTables();
  const order = t.purchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!order) throw new Error('That purchase order does not exist.');
  if (order.status !== 'sent' && order.status !== 'partially_received') throw new Error(`Order ${order.poNumber} is ${order.status.replace('_', ' ')} and cannot be received against.`);
  const deliveryNoteRef = input.deliveryNoteRef.trim();
  if (deliveryNoteRef.length === 0) throw new Error("Enter the supplier's delivery note number.");
  const store = inventory.locations().find((l) => l.isDefaultReceipt) ?? inventory.locations()[0]!;
  const orderLines = t.purchaseOrderLines.filter((l) => l.purchaseOrderId === order.id);

  let short = false;
  const checked = input.lines.map((line) => {
    const orderLine = orderLines.find((l) => l.id === line.purchaseOrderLineId);
    if (!orderLine) throw new Error('A received line does not belong to this order.');
    const outstanding = orderLine.qtyOrdered - orderLine.qtyReceived;
    const name = catalogue.variantById(orderLine.productVariantId)?.name ?? 'an item';
    if (!Number.isInteger(line.qtyReceived) || !Number.isInteger(line.qtyRejected) || line.qtyReceived < 0 || line.qtyRejected < 0) throw new Error(`Enter whole units for ${name}.`);
    if (line.qtyReceived + line.qtyRejected > outstanding) throw new Error(`${name} has ${outstanding} outstanding. Enter no more than that.`);
    if (line.qtyRejected > 0) {
      const check = checkReason(line.rejectionReason ?? '');
      if (!check.ok) throw new Error(`Say why ${line.qtyRejected} × ${name} were rejected. ${check.message}`);
    }
    if (line.qtyReceived < outstanding) short = true;
    return { line, orderLine, outstanding };
  });
  if (checked.every((c) => c.line.qtyReceived === 0 && c.line.qtyRejected === 0)) throw new Error('Enter at least one received quantity.');
  if (short && !checkReason(input.varianceNote ?? '').ok) throw new Error('Part of this order did not arrive. Add a note of at least 10 characters saying what happens to the rest.');

  const receipt: GoodsReceipt = {
    id: nextId(),
    outletId: order.outletId,
    purchaseOrderId: order.id,
    supplierId: order.supplierId,
    grnNumber: t.receipts.reduce((max, r) => Math.max(max, r.grnNumber), 0) + 1,
    deliveryNoteRef,
    receivedAt: Date.now(),
    receivedBy: input.actor.staffId,
    stockLocationId: store.id,
    status: 'posted',
    varianceNote: input.varianceNote?.trim() || null,
  };
  t.receipts.push(receipt);
  for (const { line, orderLine } of checked) {
    if (line.qtyReceived === 0 && line.qtyRejected === 0) continue;
    t.receiptLines.push({
      id: nextId(),
      goodsReceiptId: receipt.id,
      purchaseOrderLineId: orderLine.id,
      productVariantId: orderLine.productVariantId,
      qtyExpected: orderLine.qtyOrdered - orderLine.qtyReceived,
      qtyReceived: line.qtyReceived,
      qtyRejected: line.qtyRejected,
      rejectionReason: line.qtyRejected > 0 ? (line.rejectionReason?.trim() ?? null) : null,
      unitCostCents: orderLine.unitCostCents,
    });
    // Only accepted units count as received. Units sent back stay outstanding, so a replacement can be
    // received against the same order, or the remainder cancelled with a reason.
    orderLine.qtyReceived += line.qtyReceived;
    if (line.qtyReceived > 0) {
      inventory.recordMovement({
        variantId: orderLine.productVariantId,
        locationId: store.id,
        qtyDelta: line.qtyReceived,
        type: 'receipt',
        sourceType: 'goods_receipt',
        sourceId: receipt.id,
        reason: null,
        actor: input.actor,
        unitCostCents: orderLine.unitCostCents,
      });
    }
  }
  const before = order.status;
  order.status = orderLines.every((l) => l.qtyReceived >= l.qtyOrdered) ? 'received' : 'partially_received';
  audit.record({
    outletId: order.outletId,
    actorStaffId: input.actor.staffId,
    action: 'goods_receipt.posted',
    entityType: 'goods_receipt',
    entityId: receipt.id,
    before: { orderStatus: before },
    after: { orderStatus: order.status, grnNumber: receipt.grnNumber, deliveryNoteRef },
    reason: receipt.varianceNote,
    severity: 'info',
  });
  return receipt;
}

/** Cancel what is still outstanding. Anything already received stays received. */
export function cancelPurchaseOrder(input: { purchaseOrderId: string; reason: string; actor: Actor }): PurchaseOrder {
  const { reason, actor } = requireReasoned(input);
  assertPurchasing(actor, 'cancelling purchase orders');
  const order = procurementTables().purchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!order) throw new Error('That purchase order does not exist.');
  if (order.status === 'received' || order.status === 'cancelled') throw new Error(`Order ${order.poNumber} is already ${order.status}.`);
  const before = order.status;
  order.status = 'cancelled';
  audit.record({ outletId: order.outletId, actorStaffId: actor.staffId, action: 'purchase_order.cancelled', entityType: 'purchase_order', entityId: order.id, before: { status: before }, after: { status: 'cancelled' }, reason, severity: 'notable' });
  return order;
}

/** A draft raised by a stock controller goes out once someone with purchasing rights approves it. */
export function approvePurchaseOrder(input: { purchaseOrderId: string; actor: Actor }): PurchaseOrder {
  assertPurchasing(input.actor, 'approving purchase orders');
  const order = procurementTables().purchaseOrders.find((p) => p.id === input.purchaseOrderId);
  if (!order) throw new Error('That purchase order does not exist.');
  if (order.status !== 'draft') throw new Error(`Order ${order.poNumber} was already approved.`);
  order.status = 'sent';
  order.approvedBy = input.actor.staffId;
  order.approvedAt = Date.now();
  audit.record({ outletId: order.outletId, actorStaffId: input.actor.staffId, action: 'purchase_order.approved', entityType: 'purchase_order', entityId: order.id, before: { status: 'draft' }, after: { status: 'sent' }, reason: null, severity: 'info' });
  return order;
}
