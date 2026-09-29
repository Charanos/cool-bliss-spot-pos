import type { Staff } from '@bliss/shared/domain';
import { PRICE_LISTS } from './catalogue';
import { buildMenu } from './menu';
import { tradingClock } from './history';
import { seedId } from './ids';
import { LOCATIONS, OUTLET, ROLES, roleByKey, staffByKey } from './organisation';
import type { Dataset } from './types';

/**
 * The outlet as it is handed over: ready to take its real menu, people, devices and floor, with
 * nothing made up in it. docs/17 section 3.
 *
 * Kept, because the product needs them before anything else can be entered: the outlet and its
 * settings, the roles, the stock locations (Store, Bar shelf, Counter) and the Standard price list.
 * The real menu from the stock sheet (./menu), priced, with one of each on the Bar shelf until the
 * stock take. One zone, Main floor, so a walk up opens on the first night. One person: Dan, the owner, who signs in to the Console with the PIN given and adds
 * everyone and everything else there. No suppliers, tables, devices, trade or audit history.
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
  const menu = buildMenu({ now, businessDate: clock.current, ownerId: owner.id });
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
    // One zone so a walk up opens on the first night; tables and more zones are the manager's to add.
    zones: [{ id: seedId('zone:main-floor'), outletId: OUTLET.id, name: 'Main floor', sortOrder: 1, defaultPriceListId: null, status: 'active' }],
    tables: [],
    locations: LOCATIONS.map((l) => ({ ...l })),
    suppliers: [],
    catalogueVersion: 1,
    categories: menu.categories,
    products: menu.products,
    variants: menu.variants,
    modifierGroups: menu.modifierGroups,
    modifiers: menu.modifiers,
    variantModifierGroups: menu.variantModifierGroups,
    priceLists: PRICE_LISTS.filter((l) => l.kind === 'base').map((l) => ({ ...l })),
    priceListItems: menu.priceListItems,
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
    movements: menu.movements,
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
    notifications: [],
    changeSeq: 0,
    changes: [],
    applied: new Set<string>(),
  };
}
