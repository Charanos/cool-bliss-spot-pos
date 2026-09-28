import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { ZERO } from '@bliss/shared/money';
import type { OrderLine } from '@bliss/shared/domain';
import { describe, expect, it } from 'vitest';
import * as availability from './availability/service';
import { catalogueTables } from './catalogue/schema';
import { type IncomingEntry, applyEntry } from './sync/apply';
import { tradeTables } from './trade/schema';

/**
 * Something served and handed back, like a shisha pot, is counted by how many are out on tables,
 * not by stock: with four pots, four can be out at once, the fifth cannot be sold, and a pot is
 * free again the moment its table is cleared.
 */

const id = createUuidV7();
const floor = deviceByKey('floor-1').id;
const peter = staffByKey('peter').id;
let seq = 9_000_000;

function addPot(units: number) {
  const t = catalogueTables();
  const base = t.products[0]!;
  const productId = id();
  const variantId = id();
  t.products.push({ ...base, id: productId, name: 'Shisha pot (test)', sku: `SHI-TEST-${productId.slice(-6)}`, unitsInHouse: units, imageKey: null, status: 'active' });
  t.variants.push({ ...t.variants.find((v) => v.productId === base.id)!, id: variantId, productId, name: 'Shisha pot (test)', kind: 'sealed', isDefault: true, status: 'active' });
  return { productId, variantId };
}

function openTab() {
  const tabId = id();
  const zoneId = tradeTables().zones[0]!.id;
  seq += 1;
  const entry: IncomingEntry = { id: id(), seq, deviceId: floor, staffId: peter, kind: 'tab.open', aggregateId: tabId, payload: { v: 1, tabId, serviceTableId: null, zoneId, name: null, guestCount: 1, seats: [{ seatId: id(), seatNo: 1 }], openedAt: Date.now() }, clientAt: Date.now() };
  expect(applyEntry(entry).status).toBe('acked');
  return tabId;
}

function servePot(tabId: string, variantId: string, qty = 1, status: OrderLine['status'] = 'pending') {
  tradeTables().lines.push({
    id: id(),
    outletId: tradeTables().tabs.find((t) => t.id === tabId)!.outletId,
    orderId: id(),
    tabId,
    tabSeatId: null,
    productVariantId: variantId,
    qty,
    unitPriceCents: ZERO,
    lineTotalCents: ZERO,
    priceDerivation: [],
    note: 'Double apple',
    status,
    stockConflict: false,
    servedAt: null,
    servedBy: null,
    voidedBy: null,
    voidedAt: null,
    voidReason: null,
    createdBy: peter,
    deviceId: floor,
    clientCreatedAt: Date.now(),
  });
}

describe('units in the house', () => {
  it('sells while pots are free, stops when all four are out, and frees one when its table clears', () => {
    const { productId, variantId } = addPot(4);
    expect(availability.evaluate(variantId)).toMatchObject({ state: 'available', qtyAvailable: 4 });

    const first = openTab();
    servePot(first, variantId, 2);
    const second = openTab();
    servePot(second, variantId, 1);
    expect(availability.inUse(productId)).toBe(3);
    expect(availability.evaluate(variantId)).toMatchObject({ qtyAvailable: 1 });
    expect(availability.evaluate(variantId).state).not.toBe('available');

    servePot(second, variantId, 1, 'served');
    expect(availability.evaluate(variantId)).toMatchObject({ state: 'finished', qtyAvailable: 0 });

    // The first table leaves: its two pots are back on the shelf.
    tradeTables().tabs.find((t) => t.id === first)!.clearedAt = Date.now();
    expect(availability.inUse(productId)).toBe(2);
    expect(availability.evaluate(variantId)).toMatchObject({ qtyAvailable: 2 });
  });

  it('never counts a voided pot as out', () => {
    const { productId, variantId } = addPot(4);
    const tab = openTab();
    servePot(tab, variantId, 1, 'voided');
    expect(availability.inUse(productId)).toBe(0);
    expect(availability.evaluate(variantId)).toMatchObject({ qtyAvailable: 4 });
  });
});
