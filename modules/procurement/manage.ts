import 'server-only';

import type { PurchaseOrder, PurchaseOrderLine, SupplierProduct } from '@bliss/db/seed/types';
import type { Supplier } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, isNegative, multiplyByQty, sum } from '@bliss/shared/money';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { DomainError } from '../_data/errors';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import { procurementTables } from './schema';

/**
 * Managing suppliers, what each supplies, and orders before they arrive. docs/19, plan C2.
 * Purchasing reads and writes costs, so every command needs `cost.read`, as the rest of it does.
 */

const createId = createUuidV7();

function assertPurchasing(actor: Actor, doing: string) {
  identity.assertCan(actor.staffId, 'cost.read', doing);
}

function record(actor: Actor, action: string, entityType: string, entityId: string, before: object | null, after: object | null, reason: string | null = null) {
  audit.record({ outletId: identity.outlet().id, actorStaffId: actor.staffId, action, entityType, entityId, before, after, reason, severity: reason ? 'notable' : 'info' });
}

function text(value: string | null | undefined, max: number, what: string): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!clean) return null;
  if (clean.length > max) throw new DomainError(`${what} is at most ${max} characters.`);
  return clean;
}

/* ------------------------------------------------------------------- suppliers */

export interface SupplierInput {
  id?: string | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  minOrderCents: Cents;
  deliveryDays: readonly number[];
  notes: string | null;
  actor: Actor;
}

/** Add a supplier, or change one: who to call, their terms, how long they take, when they deliver. */
export function saveSupplier(input: SupplierInput): Supplier {
  assertPurchasing(input.actor, 'changing suppliers');
  const t = procurementTables();
  const name = text(input.name, 60, 'A supplier name');
  if (!name || name.length < 2) throw new DomainError('A supplier name needs at least two characters.');
  const clash = t.suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== input.id);
  if (clash) throw new DomainError(`There is already a supplier called ${clash.name}.`);
  const phone = text(input.phone, 20, 'A phone number');
  if (phone && !/^\+?[0-9 ]{7,20}$/.test(phone)) throw new DomainError('A phone number is digits, spaces and an optional plus, such as 0722 000 000.');
  const email = text(input.email, 80, 'An email address');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('That email address is not complete.');
  const whole = (n: number, what: string, max: number) => {
    if (!Number.isInteger(n) || n < 0 || n > max) throw new DomainError(`${what} is a whole number from 0 to ${max}.`);
    return n;
  };
  if (isNegative(input.minOrderCents)) throw new DomainError('A minimum order cannot be below zero.');
  const days = [...new Set(input.deliveryDays)].sort();
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new DomainError('Choose delivery days from Monday to Sunday.');
  const fields = {
    name,
    contactName: text(input.contactName, 60, 'A contact name') ?? '',
    phone,
    email,
    paymentTermsDays: whole(input.paymentTermsDays, 'Payment terms in days', 120),
    leadTimeDays: whole(input.leadTimeDays, 'Lead time in days', 90),
    minOrderCents: input.minOrderCents,
    deliveryDays: days,
    notes: text(input.notes, 500, 'Notes'),
  };

  if (!input.id) {
    const supplier: Supplier = { id: createId(), outletId: identity.outlet().id, ...fields, status: 'active' };
    t.suppliers.push(supplier);
    record(input.actor, 'supplier.created', 'supplier', supplier.id, null, { ...fields, minOrderCents: fields.minOrderCents.toString() });
    return supplier;
  }
  const supplier = t.suppliers.find((s) => s.id === input.id);
  if (!supplier) throw new DomainError('That supplier is no longer here.');
  const snapshot = (s: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.keys(fields).map((k) => [k, typeof s[k] === 'bigint' ? String(s[k]) : (s[k] ?? null)])));
  const before = JSON.parse(snapshot(supplier as unknown as Record<string, unknown>));
  if (snapshot(supplier as unknown as Record<string, unknown>) === snapshot(fields as unknown as Record<string, unknown>)) return supplier;
  Object.assign(supplier, fields);
  record(input.actor, 'supplier.updated', 'supplier', supplier.id, before, { ...fields, minOrderCents: fields.minOrderCents.toString() });
  return supplier;
}

/** Stop ordering from a supplier, or start again. Not while an order with them is still open. */
export function setSupplierStatus(input: { id: string; status: 'active' | 'archived'; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  assertPurchasing(actor, 'changing suppliers');
  const t = procurementTables();
  const supplier = t.suppliers.find((s) => s.id === input.id);
  if (!supplier) throw new DomainError('That supplier is no longer here.');
  if (supplier.status === input.status) return;
  if (input.status === 'archived') {
    const open = t.purchaseOrders.filter((p) => p.supplierId === supplier.id && (p.status === 'draft' || p.status === 'sent' || p.status === 'partially_received'));
    if (open.length > 0) throw new DomainError(`${supplier.name} has ${open.length} open ${open.length === 1 ? 'order' : 'orders'}. Receive or cancel ${open.length === 1 ? 'it' : 'them'} first.`);
  }
  const before = { status: supplier.status };
  supplier.status = input.status;
  record(actor, input.status === 'archived' ? 'supplier.archived' : 'supplier.restored', 'supplier', supplier.id, before, { status: supplier.status }, reason);
}

/**
 * Say a supplier carries an item, at what cost, in what pack. A changed cost is added to the item's
 * history, which is what the cost change alerts read.
 */
export function setSupplierItem(input: { supplierId: string; variantId: string; supplierSku: string | null; packSize: number; costCents: Cents; actor: Actor }): SupplierProduct {
  assertPurchasing(input.actor, 'changing what a supplier carries');
  const t = procurementTables();
  const supplier = t.suppliers.find((s) => s.id === input.supplierId && s.status === 'active');
  if (!supplier) throw new DomainError('Choose an active supplier.');
  const variant = catalogue.variantById(input.variantId);
  const stock = variant ? catalogue.stockVariantFor(variant.id) : null;
  if (!variant || !stock || stock.stockVariantId !== variant.id) throw new DomainError('A supplier carries stocked items, such as a bottle or a can.');
  if (!Number.isInteger(input.packSize) || input.packSize < 1 || input.packSize > 1000) throw new DomainError('A pack is a whole number of units from 1 to 1,000.');
  if (isNegative(input.costCents)) throw new DomainError('A cost cannot be below zero.');
  const sku = text(input.supplierSku, 32, "The supplier's code") ?? '';
  const now = Date.now();
  const existing = t.supplierProducts.find((sp) => sp.supplierId === supplier.id && sp.productVariantId === variant.id);
  if (existing) {
    const before = { supplierSku: existing.supplierSku, packSize: existing.packSize, costCents: existing.lastCostCents.toString(), removed: Boolean(existing.removed) };
    const costChanged = existing.lastCostCents !== input.costCents;
    if (!costChanged && existing.supplierSku === sku && existing.packSize === input.packSize && !existing.removed) return existing;
    existing.supplierSku = sku;
    existing.packSize = input.packSize;
    existing.removed = false;
    if (costChanged) {
      existing.lastCostCents = input.costCents;
      existing.history.push({ at: now, costCents: input.costCents });
    }
    record(input.actor, 'supplier_item.updated', 'supplier', supplier.id, before, { item: variant.name, supplierSku: sku, packSize: input.packSize, costCents: input.costCents.toString() });
    return existing;
  }
  const item: SupplierProduct = { id: createId(), supplierId: supplier.id, productVariantId: variant.id, supplierSku: sku, packSize: input.packSize, lastCostCents: input.costCents, lastPurchasedAt: 0, history: [{ at: now, costCents: input.costCents }] };
  t.supplierProducts.push(item);
  record(input.actor, 'supplier_item.added', 'supplier', supplier.id, null, { item: variant.name, supplierSku: sku, packSize: input.packSize, costCents: input.costCents.toString() });
  return item;
}

/** Stop buying an item from a supplier. Its cost history stays readable. */
export function removeSupplierItem(input: { supplierId: string; variantId: string; actor: Actor }): void {
  assertPurchasing(input.actor, 'changing what a supplier carries');
  const item = procurementTables().supplierProducts.find((sp) => sp.supplierId === input.supplierId && sp.productVariantId === input.variantId && !sp.removed);
  if (!item) throw new DomainError('That supplier no longer carries it.');
  item.removed = true;
  record(input.actor, 'supplier_item.removed', 'supplier', input.supplierId, { item: catalogue.variantById(input.variantId)?.name ?? input.variantId }, null);
}

/* -------------------------------------------------------------- purchase orders */

export interface OrderLineInput {
  variantId: string;
  qty: number;
  unitCostCents: Cents;
}

/**
 * Change an order before anything has arrived against it: its lines, quantities, costs, expected
 * date and note. Once goods have been received the order is a record of them, and only cancelling
 * what is still outstanding is left.
 */
export function updatePurchaseOrder(input: { id: string; lines: readonly OrderLineInput[]; expectedAt: number | null; notes: string | null; actor: Actor }): PurchaseOrder {
  assertPurchasing(input.actor, 'changing purchase orders');
  const t = procurementTables();
  const order = t.purchaseOrders.find((p) => p.id === input.id);
  if (!order) throw new DomainError('That purchase order does not exist.');
  if (order.status !== 'draft' && order.status !== 'sent') throw new DomainError(`Order ${order.poNumber} is ${order.status.replace('_', ' ')}. Only an order with nothing received yet can be changed.`);
  const current = t.purchaseOrderLines.filter((l) => l.purchaseOrderId === order.id && !l.removed);
  if (current.some((l) => l.qtyReceived > 0)) throw new DomainError(`Goods have already arrived against order ${order.poNumber}. Cancel what is outstanding instead.`);
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new DomainError('An order needs at least one line with a quantity. Cancel the order instead.');
  if (lines.length > 200) throw new DomainError('An order has at most 200 lines.');
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.variantId)) throw new DomainError(`${catalogue.variantById(l.variantId)?.name ?? 'An item'} is on the order twice. Put it on one line.`);
    seen.add(l.variantId);
    if (!Number.isInteger(l.qty) || l.qty > 100_000) throw new DomainError('Order whole units: cases are entered as the units they hold.');
    if (!catalogue.variantById(l.variantId)) throw new DomainError('One of the lines is not in the catalogue.');
    if (isNegative(l.unitCostCents)) throw new DomainError('A unit cost cannot be below zero.');
  }
  if (input.notes && input.notes.length > 500) throw new DomainError('Order notes are at most 500 characters.');
  if (input.expectedAt !== null && (!Number.isFinite(input.expectedAt) || input.expectedAt < Date.now() - 86_400_000)) throw new DomainError('The expected date cannot be in the past.');

  const before = { lines: current.map((l) => ({ item: l.productVariantId, qty: l.qtyOrdered, cost: l.unitCostCents.toString() })), expectedAt: order.expectedAt, notes: order.notes, totalCents: order.totalCents.toString() };
  const byVariant = new Map(current.map((l) => [l.productVariantId, l]));
  for (const l of current) if (!seen.has(l.productVariantId)) l.removed = true;
  const kept: PurchaseOrderLine[] = [];
  for (const l of lines) {
    const existing = byVariant.get(l.variantId);
    const total = multiplyByQty(l.unitCostCents, l.qty);
    if (existing) {
      if (existing.qtyOrdered !== l.qty) existing.qtyOrdered = l.qty;
      if (existing.unitCostCents !== l.unitCostCents) existing.unitCostCents = l.unitCostCents;
      if (existing.lineTotalCents !== total) existing.lineTotalCents = total;
      kept.push(existing);
    } else {
      const line: PurchaseOrderLine = { id: createId(), purchaseOrderId: order.id, productVariantId: l.variantId, qtyOrdered: l.qty, qtyReceived: 0, unitCostCents: l.unitCostCents, lineTotalCents: total };
      t.purchaseOrderLines.push(line);
      kept.push(line);
    }
  }
  const total = kept.length ? sum(kept.map((l) => l.lineTotalCents)) : ZERO;
  order.subtotalCents = total;
  order.totalCents = total;
  order.expectedAt = input.expectedAt;
  order.notes = input.notes?.trim() || null;
  record(input.actor, 'purchase_order.updated', 'purchase_order', order.id, before, { lines: kept.map((l) => ({ item: l.productVariantId, qty: l.qtyOrdered, cost: l.unitCostCents.toString() })), expectedAt: order.expectedAt, notes: order.notes, totalCents: total.toString() });
  return order;
}
