import { deviceByKey, staffByKey, tableByLabel } from '@bliss/db/seed/organisation';
import { shillings } from '@bliss/shared/money';
import { describe, expect, it } from 'vitest';
import { actorWithRole, ownerActor } from '../test/actors';
import { dataset } from './_data/source';
import * as audit from './audit/service';
import * as catalogue from './catalogue/service';
import * as identity from './identity/service';
import * as inventory from './inventory/service';
import * as procurement from './procurement/service';
import * as trade from './trade/service';

/**
 * The integrity rules the Console relies on, at the module boundary: who may do what to whom, what a
 * session proves, what a delivery may claim, and that every change a tablet needs reaches it.
 */

describe('console session', () => {
  it('proves a person, and ends when their access ends', () => {
    const dan = staffByKey('dan');
    const token = identity.issueConsoleSession(dan.id);
    expect(identity.checkConsoleSession(token)).toMatchObject({ ok: true });
    expect(identity.checkConsoleSession(dan.id)).toEqual({ ok: false, reason: 'invalid' });
    expect(identity.checkConsoleSession(undefined)).toEqual({ ok: false, reason: 'missing' });
    dan.employmentStatus = 'suspended';
    expect(identity.checkConsoleSession(token)).toEqual({ ok: false, reason: 'inactive' });
    dan.employmentStatus = 'active';
  });

  it('refuses a person whose role does not belong in the Console', () => {
    const amina = staffByKey('amina');
    expect(identity.checkConsoleSession(identity.issueConsoleSession(amina.id))).toEqual({ ok: false, reason: 'wrong_surface' });
  });
});

describe('station tokens', () => {
  it('binds a sign-in to its device', () => {
    const amina = staffByKey('amina').id;
    const floor = deviceByKey('floor-1').id;
    const token = identity.issueStationToken(amina, floor);
    expect(identity.checkStationToken(token, floor)).toMatchObject({ ok: true });
    expect(identity.checkStationToken(token, deviceByKey('floor-2').id)).toMatchObject({ ok: false, status: 403 });
    expect(identity.checkStationToken('made-up', floor)).toMatchObject({ ok: false, status: 401 });
  });

  it('accepts only a genuine approval from someone who can give it', () => {
    const kevin = staffByKey('kevin').id;
    const amina = staffByKey('amina').id;
    expect(identity.approverFromToken(identity.issueApprovalToken(kevin, 'void.approve'), 'void.approve')?.id).toBe(kevin);
    expect(identity.approverFromToken(identity.issueApprovalToken(kevin, 'void.approve'), 'discount.approve')).toBeNull();
    expect(identity.approverFromToken(identity.issueApprovalToken(amina, 'void.approve'), 'void.approve')).toBeNull();
    expect(identity.approverFromToken('any-string', 'void.approve')).toBeNull();
  });

  it('finds an approver by PIN without revealing whose PIN failed', () => {
    expect(identity.approverByPin('333333', 'void.approve')?.displayName).toBe('Kevin');
    expect(identity.approverByPin('111111', 'void.approve')).toBeNull();
    expect(identity.approverByPin('000000', 'void.approve')).toBeNull();
  });
});

describe('people', () => {
  const role = (key: string) => identity.roles().find((r) => r.key === key)!.id;

  it('never lets a manager hand out owner, or manage an owner', () => {
    const manager = actorWithRole('manager');
    expect(() => identity.createStaff({ fullName: 'Mallory Otieno', displayName: 'Mallory', roleId: role('owner'), pin: null, avatarUrl: null, contactNumber: null, actor: manager })).toThrow(/Only an owner/);
    const sam = staffByKey('sam');
    expect(() => identity.updateStaff({ staffId: sam.id, fullName: sam.fullName, displayName: sam.displayName, roleId: sam.roleId, pin: '482915', avatarUrl: null, contactNumber: null, actor: manager })).toThrow(/Only an owner/);
  });

  it('hashes a new PIN and never stores the digits', () => {
    const owner = ownerActor();
    const person = identity.createStaff({ fullName: 'Wanjiru Kamau', displayName: 'Wanjiru', roleId: role('waiter'), pin: '482915', avatarUrl: null, contactNumber: '+254 712 345 678', actor: owner });
    expect(person.pinHash).not.toContain('482915');
    expect(identity.verifyStaffPin(person.id, '482915')).toBe(true);
    expect(identity.pinState(person)).toBe('set');
  });

  it('keeps the PIN when the field is left empty', () => {
    const owner = ownerActor();
    const person = identity.staffList().find((s) => s.displayName === 'Wanjiru')!;
    const before = person.pinHash;
    identity.updateStaff({ staffId: person.id, fullName: 'Wanjiru Kamau', displayName: 'Wanjiru', roleId: person.roleId, pin: null, avatarUrl: null, contactNumber: null, actor: owner });
    expect(person.pinHash).toBe(before);
  });

  it('refuses easy PINs, clashing names and links posing as photos', () => {
    const owner = ownerActor();
    const base = { roleId: role('waiter'), avatarUrl: null, contactNumber: null, actor: owner };
    expect(() => identity.createStaff({ ...base, fullName: 'Test Person', displayName: 'Tester', pin: '111111' })).toThrow(/too easy/);
    expect(() => identity.createStaff({ ...base, fullName: 'Another Sam', displayName: 'sam', pin: null })).toThrow(/already goes by/);
    expect(() => identity.createStaff({ ...base, fullName: 'Test Person', displayName: 'Tester', pin: null, avatarUrl: 'https://evil.example/x.png' })).toThrow(/upload button/);
  });

  it('sends every change to the tablets', () => {
    const before = catalogue.version();
    identity.createStaff({ fullName: 'Otieno Baraka', displayName: 'Baraka', roleId: role('waiter'), pin: null, avatarUrl: null, contactNumber: null, actor: ownerActor() });
    expect(catalogue.version()).toBeGreaterThan(before);
  });
});

describe('zoning', () => {
  it('validates tables and keeps a table with a guest in service', () => {
    const owner = ownerActor();
    const zone = trade.zones()[0]!;
    expect(() => trade.createServiceTable({ zoneId: zone.id, label: 'T99', seats: 0, positionX: 0, positionY: 0, actor: owner })).toThrow(/seats 1 to 40/);
    expect(() => trade.createServiceTable({ zoneId: 'nope', label: 'T99', seats: 2, positionX: 0, positionY: 0, actor: owner })).toThrow(/active zone/);
    const before = catalogue.version();
    trade.createServiceTable({ zoneId: zone.id, label: 'T99', seats: 2, positionX: 0, positionY: 0, actor: owner });
    expect(catalogue.version()).toBeGreaterThan(before);

    const busy = trade.openTabs().find((t) => t.tab.serviceTableId)?.tab;
    if (busy) {
      const table = trade.tableById(busy.serviceTableId)!;
      expect(() => trade.updateServiceTable({ tableId: table.id, zoneId: table.zoneId, label: table.label, seats: table.seats, positionX: table.positionX, positionY: table.positionY, status: 'out_of_service', actor: owner })).toThrow(/open tab/);
    }
    expect(tableByLabel('T2')).toBeTruthy();
  });
});

describe('goods receipts', () => {
  const owner = ownerActor;
  const openOrder = () => procurement.purchaseOrders().find((p) => (p.status === 'sent' || p.status === 'partially_received') && procurement.purchaseOrderLines(p.id).some((l) => l.qtyOrdered > l.qtyReceived))!;

  it('refuses more than is outstanding, and lines from another order', () => {
    const order = openOrder();
    const line = procurement.purchaseOrderLines(order.id).find((l) => l.qtyOrdered > l.qtyReceived)!;
    const outstanding = line.qtyOrdered - line.qtyReceived;
    const base = { purchaseOrderId: order.id, supplierId: order.supplierId, deliveryNoteRef: 'DN-TEST-1', varianceNote: 'Rest follows on Friday with the next truck', actor: owner() };
    expect(() => procurement.recordGoodsReceipt({ ...base, lines: [{ variantId: line.productVariantId, purchaseOrderLineId: line.id, qtyReceived: outstanding + 1 }] })).toThrow(/outstanding/);
    const other = catalogue.stockVariants().find((v) => !procurement.purchaseOrderLines(order.id).some((l) => l.productVariantId === v.id))!;
    expect(() => procurement.recordGoodsReceipt({ ...base, lines: [{ variantId: other.id, qtyReceived: 1 }] })).toThrow(/not on order/);
  });

  it('refuses a supplier that is not the order’s', () => {
    const order = openOrder();
    const line = procurement.purchaseOrderLines(order.id).find((l) => l.qtyOrdered > l.qtyReceived)!;
    const wrong = procurement.suppliers().find((s) => s.id !== order.supplierId)!;
    expect(() => procurement.recordGoodsReceipt({ purchaseOrderId: order.id, supplierId: wrong.id, deliveryNoteRef: 'DN-TEST-2', lines: [{ variantId: line.productVariantId, qtyReceived: 1 }], varianceNote: 'Rest follows on Friday with the next truck', actor: owner() })).toThrow(/is with/);
  });

  it('posts once for a repeated submission, with a lot and a linked note', () => {
    const supplier = procurement.suppliers()[0]!;
    const variant = catalogue.stockVariants()[0]!;
    const before = inventory.onHand(variant.id);
    const input = { supplierId: supplier.id, deliveryNoteRef: 'DN-TEST-3', requestId: 'req-test-00000001', lines: [{ variantId: variant.id, qtyReceived: 6, unitCostCents: shillings(150), expiryDate: '2027-03-31' }], actor: owner() };
    const first = procurement.recordGoodsReceipt(input);
    const again = procurement.recordGoodsReceipt(input);
    expect(again.id).toBe(first.id);
    expect(inventory.onHand(variant.id)).toBe(before + 6);
    expect(procurement.noteForReceipt(first.id)?.goodsReceiptId).toBe(first.id);
    const lot = inventory.batchesForVariant(variant.id).find((b) => b.initialQty === 6 && b.expiryDate !== null);
    expect(lot?.remainingQty).toBe(6);
  });

  it('needs a variance note for a short delivery, and a reason for rejected units', () => {
    const supplier = procurement.suppliers()[0]!;
    const variant = catalogue.stockVariants()[1]!;
    expect(() => procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-TEST-4', lines: [{ variantId: variant.id, qtyReceived: 4, qtyExpected: 6 }], actor: owner() })).toThrow(/variance note/);
    expect(() => procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-TEST-4', lines: [{ variantId: variant.id, qtyReceived: 4, qtyRejected: 2, rejectionReason: 'bad' }], actor: owner() })).toThrow(/rejected/);
    expect(() => procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-TEST-4', mediaUrls: ['https://example.com/x.jpg'], lines: [{ variantId: variant.id, qtyReceived: 4 }], actor: owner() })).toThrow(/upload button/);
  });

  it('reverses a delivery out of its own lot', () => {
    const supplier = procurement.suppliers()[0]!;
    const variant = catalogue.stockVariants()[2]!;
    const before = inventory.onHand(variant.id);
    const receipt = procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-TEST-5', lines: [{ variantId: variant.id, qtyReceived: 3 }], actor: owner() });
    expect(inventory.onHand(variant.id)).toBe(before + 3);
    procurement.voidGoodsReceipt({ receiptId: receipt.id, reason: 'Delivered to the wrong outlet, collected back', actor: owner() });
    expect(inventory.onHand(variant.id)).toBe(before);
    expect(procurement.receiptById(receipt.id)?.status).toBe('cancelled');
    expect(() => procurement.voidGoodsReceipt({ receiptId: receipt.id, reason: 'Delivered to the wrong outlet, collected back', actor: owner() })).toThrow(/already reversed/);
  });
});

describe('stock lots', () => {
  it('draw first expiry first, whatever location the sale happens at', () => {
    const owner = ownerActor();
    const supplier = procurement.suppliers()[0]!;
    const variant = catalogue.stockVariants()[3]!;
    procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-LOT-LATE', lines: [{ variantId: variant.id, qtyReceived: 5, expiryDate: '2028-01-01' }], actor: owner });
    procurement.recordGoodsReceipt({ supplierId: supplier.id, deliveryNoteRef: 'DN-LOT-EARLY', lines: [{ variantId: variant.id, qtyReceived: 5, expiryDate: '2027-01-01' }], actor: owner });
    const lots = () => inventory.batchesForVariant(variant.id).filter((b) => b.expiryDate !== null && b.initialQty === 5);
    const [early, late] = [...lots()].sort((a, b) => a.expiryDate! - b.expiryDate!);
    // Any older lots with no expiry are drawn after dated ones; the earliest dated lot goes first.
    inventory.recordSale({ lineId: 'test-line-lots', productVariantId: variant.id, qty: 2, modifiers: [], actor: owner });
    expect(early!.remainingQty).toBeLessThan(5);
    expect(late!.remainingQty).toBe(5);
    inventory.reverseSale({ lineId: 'test-line-lots', actor: owner });
    expect(early!.remainingQty).toBe(5);
  });
});

describe('audit log', () => {
  it('appends, and reads newest first', () => {
    const owner = ownerActor();
    const events = dataset().auditEvents;
    const length = events.length;
    const first = audit.record({ outletId: identity.outlet().id, actorStaffId: owner.staffId, action: 'test.first', entityType: 'test', entityId: 'a', before: null, after: null, reason: null, severity: 'info' });
    const second = audit.record({ outletId: identity.outlet().id, actorStaffId: owner.staffId, action: 'test.second', entityType: 'test', entityId: 'b', before: null, after: null, reason: null, severity: 'info' });
    expect(events.length).toBe(length + 2);
    expect(events[length]).toBe(first);
    const listed = audit.list({ action: 'test.' });
    expect(listed[0]!.id).toBe(second.id);
    expect(listed[1]!.id).toBe(first.id);
  });
});
