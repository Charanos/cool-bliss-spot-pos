import { variantIdFor } from '@bliss/db/seed/catalogue';
import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, cents, multiplyByQty, subtract, sum, toJSON } from '@bliss/shared/money';
import { amountDue } from '@bliss/shared/settlement';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { describe, expect, it } from 'vitest';
import { actorWithRole, ownerActor } from '../test/actors';
import { dataset } from './_data/source';
import * as catalogueManage from './catalogue/manage';
import * as catalogue from './catalogue/service';
import * as identity from './identity/service';
import * as venue from './identity/venue';
import * as inventoryManage from './inventory/manage';
import * as inventory from './inventory/service';
import * as pricingManage from './pricing/manage';
import * as pricing from './pricing/service';
import * as procurementManage from './procurement/manage';
import * as procurement from './procurement/service';
import * as corrections from './settlement/corrections';
import * as settlement from './settlement/service';
import { type IncomingEntry, applyEntry } from './sync/apply';
import * as tabs from './trade/console';
import * as trade from './trade/service';

/**
 * Managing the business from the Console: the menu, suppliers, corrections to bills and tabs, and
 * the venue's own settings. Each command is held to its rules, its audit entry, and what it does to
 * every figure downstream.
 */

const id = createUuidV7();
const counter = deviceByKey('counter-1').id;
const kevin = staffByKey('kevin').id;
let seq = 5_000_000;

function entry<K extends OutboxKind>(kind: K, deviceId: string, staffId: string, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId, staffId, kind, aggregateId, payload, clientAt: Date.now() };
}

const lastAudit = () => {
  const events = dataset().auditEvents;
  return events[events.length - 1]!;
};

/** A quick sale at the counter, settled in the tender given. */
function quickSale(kind: 'mpesa' | 'cash', qty = 2) {
  const variantId = variantIdFor('tusker', 'bottle');
  const unit = pricing.currentPrice(variantId, Date.now())!.unitPriceCents;
  const subtotal = multiplyByQty(unit, qty);
  const { due, rounding } = amountDue(subtotal);
  if (kind === 'cash' && !settlement.openDrawerFor(counter)) {
    expect(applyEntry(entry('drawer.open', counter, kevin, counter, { v: 1, sessionId: id(), floatCents: '500000', openedAt: Date.now() })).status).toBe('acked');
  }
  const billId = id();
  const result = applyEntry(
    entry('bill.settle', counter, kevin, billId, {
      v: 1,
      billId,
      scope: 'quick_sale',
      tabId: null,
      tabSeatId: null,
      lineIds: [],
      items: [{ productVariantId: variantId, qty, unitPriceCents: toJSON(unit) }],
      split: null,
      subtotalCents: toJSON(subtotal),
      roundingCents: toJSON(rounding),
      dueCents: toJSON(due),
      tenders: [{ tenderId: id(), kind, amountCents: toJSON(due), tenderedCents: kind === 'cash' ? toJSON(due) : null, changeCents: kind === 'cash' ? '0' : null, reference: kind === 'mpesa' ? 'QGH7K2LP9X' : null }],
      drawerSessionId: null,
      settledAt: Date.now(),
    }),
  );
  expect(result.status).toBe('acked');
  return { bill: settlement.billById(billId)!, variantId, due };
}

describe('the menu', () => {
  it('adds a category at the end of the floor tabs, refuses a duplicate, and archives only when empty', () => {
    const actor = ownerActor();
    const made = catalogueManage.saveCategory({ name: 'Shots', colourToken: 'rose', routingTarget: 'bar', trackStock: true, actor });
    expect(catalogue.categories().at(-1)?.id).toBe(made.id);
    expect(lastAudit().action).toBe('category.created');
    expect(() => catalogueManage.saveCategory({ name: 'shots', colourToken: 'jade', routingTarget: 'bar', trackStock: true, actor })).toThrow(/already a category/);
    const beer = catalogue.categories().find((c) => c.name === 'Beer')!;
    expect(() => catalogueManage.setCategoryStatus({ id: beer.id, status: 'archived', reason: 'Testing the empty rule', actor })).toThrow(/still has/);
    catalogueManage.setCategoryStatus({ id: made.id, status: 'archived', reason: 'Added by the test, not needed', actor });
    expect(catalogue.categoryById(made.id)?.status).toBe('archived');
  });

  it('adds a product with its first way of selling and its base price, sellable at once', () => {
    const actor = ownerActor();
    const spirits = catalogue.categories().find((c) => c.name === 'Spirits')!;
    const before = catalogue.version();
    const base = pricingManage.defaultList()!;
    const product = catalogueManage.createProduct(
      { categoryId: spirits.id, name: 'Test Gin', brand: 'Test', sku: 'SPR-TST-750', barcode: null, containerVolumeMl: 750, abv: 40, defaultSupplierId: null, imageKey: null, firstVariant: { name: '750ml', kind: 'sealed', serveVolumeMl: null, depletionFactor: 1 }, basePriceCents: cents(250_000), requestId: 'test-gin-once', actor },
      procurement.suppliers(),
      (variantId) => pricing.setPrice({ listId: base.id, variantId, priceCents: cents(250_000), reason: 'The first price for the test', actor }),
    );
    expect(catalogue.version()).toBeGreaterThan(before);
    const variant = catalogue.variants().find((v) => v.productId === product.id)!;
    expect(pricing.currentPrice(variant.id)?.unitPriceCents).toBe(cents(250_000));
    // The same request again adds nothing.
    const again = catalogueManage.createProduct(
      { categoryId: spirits.id, name: 'Test Gin', brand: 'Test', sku: 'SPR-TST-750', barcode: null, containerVolumeMl: 750, abv: 40, defaultSupplierId: null, imageKey: null, firstVariant: { name: '750ml', kind: 'sealed', serveVolumeMl: null, depletionFactor: 1 }, basePriceCents: cents(250_000), requestId: 'test-gin-once', actor },
      procurement.suppliers(),
      () => {
        throw new Error('priced twice');
      },
    );
    expect(again.id).toBe(product.id);
    // A tot of it pours a share of the bottle.
    const tot = catalogueManage.saveVariant({ productId: product.id, name: 'tot', kind: 'serve', serveVolumeMl: 25, depletionFactor: 0, barcode: null, isDefault: false, actor }, (variantId) =>
      pricing.setPrice({ listId: base.id, variantId, priceCents: cents(20_000), reason: 'The first price for the test', actor }),
    );
    expect(tot.depletionFactor).toBeCloseTo(25 / 750, 4);
    expect(catalogue.stockVariantFor(tot.id)?.stockVariantId).toBe(variant.id);
    // The sealed way cannot go while a serve pours from it.
    expect(() => catalogueManage.setVariantStatus({ id: variant.id, status: 'archived', reason: 'Testing the pour rule', actor })).toThrow(/pour from/);
    const beforeArchive = catalogue.version();
    catalogueManage.setProductStatus({ id: product.id, status: 'archived', reason: 'Added by the test, not needed', actor });
    expect(catalogue.productById(product.id)?.status).toBe('archived');
    // The tablets pull again, and the snapshot they get carries it as archived, so the floor drops it.
    expect(catalogue.version()).toBeGreaterThan(beforeArchive);
    expect(catalogue.snapshot().products.find((p) => p.id === product.id)?.status).toBe('archived');
  });

  it('refuses a menu change from someone without the menu permission', () => {
    const waiter = actorWithRole('waiter');
    expect(() => catalogueManage.saveCategory({ name: 'Nope', colourToken: 'rose', routingTarget: 'bar', trackStock: true, actor: waiter })).toThrow();
  });

  it('links a modifier group to items and unlinks it, never deleting the row', () => {
    const actor = ownerActor();
    const group = catalogueManage.saveModifierGroup({ name: 'Test ice', minSelect: 0, maxSelect: 1, options: [{ name: 'No ice', priceDeltaCents: ZERO, linkedVariantId: null }], actor });
    const tot = variantIdFor('smirnoff', 'tot');
    catalogueManage.setModifierGroupItems({ groupId: group.id, variantIds: [tot], actor });
    expect(catalogue.modifierGroupsFor(tot).some((g) => g.group.id === group.id)).toBe(true);
    const rows = dataset().variantModifierGroups.length;
    catalogueManage.setModifierGroupItems({ groupId: group.id, variantIds: [], actor });
    expect(catalogue.modifierGroupsFor(tot).some((g) => g.group.id === group.id)).toBe(false);
    expect(catalogue.snapshot().variantModifierGroups.some((x) => x.modifierGroupId === group.id)).toBe(false);
    expect(dataset().variantModifierGroups.length).toBe(rows);
  });
});

describe('prices and rules', () => {
  it('keeps the last base list, and a list a rule switches on', () => {
    const actor = ownerActor();
    const bases = pricing.priceLists().filter((l) => l.kind === 'base' && l.status === 'active');
    if (bases.length === 1) expect(() => pricingManage.setPriceListStatus({ id: bases[0]!.id, status: 'archived', reason: 'Testing the last list rule', actor })).toThrow(/only base list/);
    const ruled = pricing.rules().find((r) => r.status === 'active');
    if (ruled) expect(() => pricingManage.setPriceListStatus({ id: ruled.priceListId, status: 'archived', reason: 'Testing the rule guard', actor })).toThrow(/switch/);
  });

  it('copies prices onto a new overlay and prices from it inside a rule', () => {
    const actor = ownerActor();
    const base = pricingManage.defaultList()!;
    const overlay = pricingManage.savePriceList({ name: 'Test late night', kind: 'overlay', priority: 5, actor });
    const { copied } = pricingManage.copyPrices({ fromId: base.id, toId: overlay.id, onlyMissing: true, reason: 'Starting the test list from base', actor });
    expect(copied).toBe(pricing.itemsFor(base.id).length);
    const rule = pricingManage.saveRule({ name: 'Test late', priceListId: overlay.id, daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startTime: '23:00', endTime: '02:00', priority: 1, actor });
    expect(rule.crossesMidnight).toBe(true);
    expect(pricingManage.overlapping({ ...rule, id: 'other' }).some((r) => r.id === rule.id)).toBe(true);
    expect(() => pricingManage.saveRule({ name: 'Bad', priceListId: base.id, daysOfWeek: [1], startTime: '17:00', endTime: '19:00', priority: 1, actor })).toThrow(/base list/);
    pricingManage.setRuleStatus({ id: rule.id, status: 'archived', reason: 'Added by the test, not needed', actor });
  });
});

describe('suppliers and orders', () => {
  it('records a cost change in the item history, where the alerts read it', () => {
    const actor = ownerActor();
    const supplier = procurementManage.saveSupplier({ name: 'Test Traders', contactName: 'Wanjiru', phone: '0722 000 000', email: 'orders@test.co.ke', paymentTermsDays: 14, leadTimeDays: 2, minOrderCents: cents(500_000), deliveryDays: [2, 5], notes: null, actor });
    const tusker = variantIdFor('tusker', 'bottle');
    procurementManage.setSupplierItem({ supplierId: supplier.id, variantId: tusker, supplierSku: 'TK-500', packSize: 24, costCents: cents(20_000), actor });
    procurementManage.setSupplierItem({ supplierId: supplier.id, variantId: tusker, supplierSku: 'TK-500', packSize: 24, costCents: cents(21_000), actor });
    const change = procurement.costChanges().find((c) => c.supplierProduct.supplierId === supplier.id);
    expect(change?.to).toBe(cents(21_000));
    expect(change?.changeBps).toBe(500);
    procurementManage.removeSupplierItem({ supplierId: supplier.id, variantId: tusker, actor });
    expect(procurement.supplierProducts(supplier.id)).toHaveLength(0);
  });

  it('changes an order until goods arrive, and refuses to archive a supplier with it open', () => {
    const actor = ownerActor();
    const supplier = procurement.suppliers().find((s) => s.status === 'active')!;
    const tusker = variantIdFor('tusker', 'bottle');
    const coke = variantIdFor('coke', 'unit');
    const order = procurement.raisePurchaseOrder({ supplierId: supplier.id, lines: [{ variantId: tusker, qty: 24, unitCostCents: cents(20_000) }], expectedAt: null, notes: null, actor });
    procurementManage.updatePurchaseOrder({ id: order.id, lines: [{ variantId: coke, qty: 12, unitCostCents: cents(5_000) }], expectedAt: null, notes: 'Coke only', actor });
    const lines = procurement.purchaseOrderLines(order.id);
    expect(lines.map((l) => l.productVariantId)).toEqual([coke]);
    expect(order.totalCents).toBe(cents(60_000));
    expect(() => procurementManage.setSupplierStatus({ id: supplier.id, status: 'archived', reason: 'Testing the open order rule', actor })).toThrow(/open/);
    procurement.cancelPurchaseOrder({ purchaseOrderId: order.id, reason: 'Raised by the test only', actor });
  });
});

describe('bill corrections', () => {
  it('voids a quick sale: it leaves the takings, and its stock returns', () => {
    const actor = ownerActor();
    const { bill, variantId, due } = quickSale('mpesa');
    const date = bill.businessDate;
    const takings = settlement.netSales(date);
    const stock = inventory.onHand(variantId);
    corrections.voidBill({ billId: bill.id, reason: 'Rang up on the wrong screen', actor });
    expect(settlement.billById(bill.id)?.status).toBe('voided');
    expect(settlement.netSales(date)).toBe(subtract(takings, due));
    expect(inventory.onHand(variantId)).toBeCloseTo(stock + 2, 6);
    expect(lastAudit()).toMatchObject({ action: 'bill.voided', severity: 'sensitive' });
  });

  it('refunds a line: the takings drop by it, the drawer pays it out, and it cannot be refunded twice', () => {
    const actor = ownerActor();
    const { bill } = quickSale('cash', 3);
    const date = bill.businessDate;
    const takings = settlement.netSales(date);
    const session = settlement.openDrawerFor(counter)!;
    const line = settlement.billLines(bill.id)[0]!;
    const { refundedCents } = corrections.refundBill({ billId: bill.id, billLineIds: [line.id], method: 'cash', drawerSessionId: session.id, reference: null, restock: false, reason: 'Guest was charged for a round not served', actor });
    expect(refundedCents).toBe(line.lineTotalCents);
    expect(settlement.billById(bill.id)?.status).toBe('refunded');
    expect(settlement.netSales(date)).toBe(subtract(takings, refundedCents));
    const paidOut = dataset().cashMovements.filter((m) => m.drawerSessionId === session.id && m.kind === 'payout').map((m) => m.amountCents);
    expect(sum(paidOut as Cents[])).toBeGreaterThanOrEqual(refundedCents);
    expect(() => corrections.refundBill({ billId: bill.id, billLineIds: [line.id], method: 'cash', drawerSessionId: session.id, reference: null, restock: false, reason: 'Trying the same refund again', actor })).toThrow();
  });

  it('takes a voided cash bill out of what the drawer expects, while it is still open', () => {
    const actor = ownerActor();
    const { bill, due } = quickSale('cash');
    const session = settlement.openDrawerFor(counter)!;
    const takenBefore = sum(settlement.cashTakenIn(session.id));
    corrections.voidBill({ billId: bill.id, reason: 'Settled on the wrong screen', actor });
    expect(sum(settlement.cashTakenIn(session.id))).toBe(subtract(takenBefore, due));
    expect(settlement.billsInDrawer(session.id).find((b) => b.id === bill.id)?.status).toBe('voided');
    expect(settlement.drawerForBill(bill)?.id).toBe(session.id);
  });

  it('shows a drawer review once, and only on a counted drawer', () => {
    const actor = ownerActor();
    const open = settlement.openDrawerFor(counter)!;
    expect(() => corrections.acknowledgeDrawer({ sessionId: open.id, note: 'Looked at it before the count', actor })).toThrow(/counted and closed/);
    const closed = settlement.drawerSessions().find((d) => d.status === 'closed' && !d.reviewedAt)!;
    corrections.acknowledgeDrawer({ sessionId: closed.id, note: 'Checked with the cashier, change given wrongly', actor });
    expect(settlement.drawerView(closed.id)).toMatchObject({ stage: 'closed', reviewedBy: actor.staffId });
    expect(() => corrections.acknowledgeDrawer({ sessionId: closed.id, note: 'Reviewing the same drawer again', actor })).toThrow(/already/);
  });

  it('refuses both without the refund permission', () => {
    const waiter = actorWithRole('waiter');
    const { bill } = quickSale('mpesa');
    expect(() => corrections.voidBill({ billId: bill.id, reason: 'A waiter trying to void', actor: waiter })).toThrow();
  });
});

describe('tabs from the Console', () => {
  it('force closes an open tab, voiding what is not on a bill and freeing its table', () => {
    const actor = ownerActor();
    const open = trade.openTabs()[0];
    if (!open) return;
    const { voided } = tabs.forceCloseTab({ tabId: open.tab.id, reason: 'Guests left without paying at close', actor });
    expect(voided).toBeGreaterThanOrEqual(0);
    const after = trade.tabById(open.tab.id)!;
    expect(['settled', 'voided']).toContain(after.status);
    expect(trade.openTabs().some((s) => s.tab.id === open.tab.id)).toBe(false);
  });
});

describe('the venue', () => {
  it('lets only an owner change VAT', () => {
    const manager = actorWithRole('manager');
    const outlet = identity.outlet();
    const same = { name: outlet.name, legalName: outlet.legalName, address: outlet.address, businessDayCutover: outlet.businessDayCutover, taxRateBps: outlet.taxRateBps, pricesTaxInclusive: outlet.pricesTaxInclusive, lowStockDefault: outlet.lowStockDefault, drawerVarianceThresholdCents: outlet.drawerVarianceThresholdCents };
    expect(() => venue.updateOutlet({ ...same, taxRateBps: 1500, reason: 'A manager trying to change VAT', actor: manager })).toThrow(/owner/);
    venue.updateOutlet({ ...same, lowStockDefault: outlet.lowStockDefault + 1, reason: 'Warn a little earlier on the floor', actor: manager });
    expect(identity.outlet().lowStockDefault).toBe(same.lowStockDefault + 1);
  });

  it('adds a role from a base role, and deletes it only when nobody holds it', () => {
    const actor = ownerActor();
    const waiter = identity.roles().find((r) => r.key === 'waiter')!;
    const role = venue.createRole({ name: 'Head waiter', basedOnRoleId: waiter.id, actor });
    expect(role.key).toBe('waiter');
    expect(() => venue.deleteRole({ roleId: waiter.id, reason: 'Trying a system role', actor })).toThrow(/stays/);
    venue.deleteRole({ roleId: role.id, reason: 'Made by the test, not needed', actor });
    expect(identity.roles().some((r) => r.id === role.id)).toBe(false);
  });

  it('registers a device that will not sign in until it is paired, and pairs once', () => {
    const actor = ownerActor();
    const { device, pairingCode } = venue.registerDevice({ label: 'Floor 9', kind: 'floor', actor });
    expect(venue.pairingRequired(device.id)).toBe(true);
    expect(identity.devices().find((d) => d.id === device.id)).not.toHaveProperty('pairingHash');
    const wrong = pairingCode === '000000' ? '000001' : '000000';
    expect(venue.pairDevice(device.id, wrong)).toBe('wrong');
    expect(venue.pairDevice(device.id, pairingCode)).toBe('paired');
    expect(venue.pairingRequired(device.id)).toBe(false);
  });

  it('keeps a location that holds stock', () => {
    const actor = ownerActor();
    const busy = inventory.locations().find((l) => !l.isDefaultReceipt && !l.isDefaultSale && catalogue.stockVariants().some((v) => inventory.onHand(v.id, l.id) > 0));
    if (busy) expect(() => inventoryManage.setLocationStatus({ id: busy.id, status: 'archived', reason: 'Testing the stock rule', actor })).toThrow(/still holds/);
    const spare = inventoryManage.saveLocation({ name: 'Test cellar', kind: 'store', actor });
    inventoryManage.setLocationStatus({ id: spare.id, status: 'archived', reason: 'Made by the test, not needed', actor });
  });

  it('takes a write-off back the same day, once', () => {
    const actor = ownerActor();
    // Any item with a unit on a shelf: the seed's stock moves with the calendar.
    const held = catalogue
      .stockVariants()
      .flatMap((v) => inventory.locations().map((l) => ({ v: v.id, l })))
      .find((x) => inventory.onHand(x.v, x.l.id) >= 1)!;
    const tusker = held.v;
    const location = held.l;
    const before = inventory.onHand(tusker);
    inventory.writeOff({ variantId: tusker, locationId: location.id, qty: 1, category: 'write_off_breakage', reason: 'Dropped a crate by the fridge', actor });
    const group = dataset().movements.at(-1)!.sourceId!;
    inventory.reverseWriteOff({ groupId: group, reason: 'It was the wrong item', actor });
    expect(inventory.onHand(tusker)).toBeCloseTo(before, 6);
    expect(() => inventory.reverseWriteOff({ groupId: group, reason: 'Trying the same again', actor })).toThrow(/already/);
  });
});
