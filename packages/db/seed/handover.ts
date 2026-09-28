import type { Staff } from '@bliss/shared/domain';
import { PRICE_LISTS } from './catalogue';
import { tradingClock } from './history';
import { LOCATIONS, OUTLET, ROLES, roleByKey, staffByKey } from './organisation';
import type { Dataset } from './types';

/**
 * The outlet as it is handed over: ready to take its real menu, people, devices and floor, with
 * nothing made up in it. docs/17 section 3.
 *
 * Kept, because the product needs them before anything else can be entered: the outlet and its
 * settings, the roles, the stock locations (Store, Bar shelf, Counter) and the Standard price list,
 * with no prices on it. One person: Dan, the owner, who signs in to the Console with the PIN given
 * and adds everyone and everything else there. No products, categories, suppliers, zones, tables,
 * devices, trade, stock or audit history.
 *
 * The PIN arrives already hashed, so this file never holds it and never needs the hashing code.
 */
export function buildHandoverDataset(input: { now?: number; ownerPinHash: string; ownerPinLength?: number }): Dataset {
  const now = input.now ?? Date.now();
  const clock = tradingClock(now);
  const dan = staffByKey('dan');
  const owner: Staff = {
    ...dan,
    roleId: roleByKey('owner').id,
    employmentStatus: 'active',
    pinHash: input.ownerPinHash,
    pinLength: input.ownerPinLength ?? 6,
    pinSetAt: now,
    pinExpiresAt: null,
    pinMustChange: false,
    pinHistory: [],
    pinVersion: 0,
    pinClearedAt: null,
    pinLockedUntil: null,
    avatarUrl: null,
    contactNumber: null,
  };
  return {
    generatedAt: now,
    now,
    currentBusinessDate: clock.current,
    lastNight: clock.lastNight,
    tradingInProgress: clock.inProgress,
    firstBusinessDate: clock.current,
    outlet: { ...OUTLET },
    roles: ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })),
    staff: [owner],
    devices: [],
    zones: [],
    tables: [],
    locations: LOCATIONS.map((l) => ({ ...l })),
    suppliers: [],
    catalogueVersion: 1,
    categories: [],
    products: [],
    variants: [],
    modifierGroups: [],
    modifiers: [],
    variantModifierGroups: [],
    priceLists: PRICE_LISTS.filter((l) => l.kind === 'base').map((l) => ({ ...l })),
    priceListItems: [],
    priceRules: [],
    recipes: [],
    pourSpecs: [],
    tabs: [],
    seats: [],
    orders: [],
    lines: [],
    lineModifiers: [],
    bills: [],
    billLines: [],
    tenders: [],
    shifts: [],
    drawerSessions: [],
    movements: [],
    holds: [],
    counts: [],
    countLines: [],
    stockBatches: [],
    goodsReceivedNotes: [],
    purchaseOrders: [],
    purchaseOrderLines: [],
    receipts: [],
    receiptLines: [],
    supplierProducts: [],
    auditEvents: [],
    deadLetters: [],
    presence: [],
    availabilityVersion: 1,
    epoch: `handover:${clock.current}:${now.toString(36)}`,
    cashMovements: [],
    changeSeq: 0,
    changes: [],
    applied: new Set<string>(),
  };
}
