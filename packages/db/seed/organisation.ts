import type { Device, Outlet, PermissionKey, Role, RoleKey, ServiceTable, Staff, StockLocation, Zone } from '@bliss/shared/domain';
import { type Cents, shillings } from '@bliss/shared/money';
import { seedId } from './ids';

/**
 * Organisation seed, per the Phase 1 prompt: one outlet on Africa/Nairobi with a 05:00 cutover,
 * six roles with the permission matrix, eight staff, four devices, three zones and twelve tables.
 */

export const OUTLET: Outlet = {
  id: seedId('outlet:cool-bliss-spot'),
  name: 'Cool Bliss Spot',
  legalName: 'Cool Bliss Spot Limited',
  timezone: 'Africa/Nairobi',
  businessDayCutover: '05:00',
  address: 'Nairobi',
  currency: 'KES',
  taxRateBps: 1600,
  pricesTaxInclusive: true,
  lowStockDefault: 6,
  drawerVarianceThresholdCents: shillings(500),
  status: 'active',
};

const ALL: PermissionKey[] = [
  'cost.read',
  'price.write',
  'void.approve',
  'discount.approve',
  'hold.set',
  'stock.count.commit',
  'stock.writeoff',
  'drawer.close',
  'refund.approve',
  'staff.manage',
  'device.manage',
  'report.margin',
  'export.run',
];

const MATRIX: Record<RoleKey, { name: string; permissions: PermissionKey[] }> = {
  owner: { name: 'Owner', permissions: ALL },
  manager: { name: 'Manager', permissions: ALL },
  supervisor: {
    name: 'Supervisor',
    permissions: ['void.approve', 'discount.approve', 'hold.set', 'drawer.close', 'refund.approve', 'export.run'],
  },
  cashier: { name: 'Cashier', permissions: ['drawer.close'] },
  waiter: { name: 'Waiter', permissions: [] },
  stock_controller: {
    name: 'Stock controller',
    permissions: ['cost.read', 'hold.set', 'stock.count.commit', 'stock.writeoff', 'export.run'],
  },
};

export const ROLES: Role[] = (Object.keys(MATRIX) as RoleKey[]).map((key) => ({
  id: seedId(`role:${key}`),
  key,
  name: MATRIX[key].name,
  isSystem: true,
  permissions: MATRIX[key].permissions,
}));

export const roleByKey = (key: RoleKey): Role => ROLES.find((r) => r.key === key)!;

const person = (key: string, fullName: string, displayName: string, role: RoleKey, colourIndex: number): Staff => ({
  id: seedId(`staff:${key}`),
  outletId: OUTLET.id,
  fullName,
  displayName,
  roleId: roleByKey(role).id,
  employmentStatus: 'active',
  colourIndex,
  pinHash: null,
  avatarUrl: null,
  contactNumber: null,
  pinLockedUntil: null,
});

export const STAFF: Staff[] = [
  person('sam', 'Sam Kamau', 'Sam', 'owner', 0),
  person('dan', 'Dan Ochieng', 'Dan', 'manager', 1),
  person('kevin', 'Kevin Mwangi', 'Kevin', 'supervisor', 2),
  person('grace', 'Grace Achieng', 'Grace', 'cashier', 3),
  person('amina', 'Amina Hassan', 'Amina', 'waiter', 4),
  person('peter', 'Peter Njoroge', 'Peter', 'waiter', 6),
];

export const staffByKey = (key: string): Staff => STAFF.find((s) => s.id === seedId(`staff:${key}`))!;

export const WAITERS = ['amina', 'peter'].map(staffByKey);

/**
 * Development sign-in PINs for the seeded staff. Development only: production PINs are chosen by
 * the person, hashed with Argon2id and never leave the identity module.
 */
export const DEV_PINS: Record<string, string> = {
  [staffByKey('amina').id]: '111111',
  [staffByKey('peter').id]: '222222',
  [staffByKey('kevin').id]: '333333',
  [staffByKey('grace').id]: '444444',
  [staffByKey('dan').id]: '555555',
  [staffByKey('sam').id]: '666666',
};

const enrolledAt = Date.UTC(2026, 7, 28, 9, 0, 0);

const device = (key: string, label: string, kind: Device['kind']): Device => ({
  id: seedId(`device:${key}`),
  outletId: OUTLET.id,
  label,
  kind,
  enrolledAt,
  enrolledBy: staffByKey('dan').id,
  lastSeenAt: null,
  lastEventSeq: 0,
  appVersion: '1.0.0',
  status: 'active',
  revokedAt: null,
  revokedReason: null,
});

export const DEVICES: Device[] = [
  device('floor-1', 'Floor 1', 'floor'),
  device('floor-2', 'Floor 2', 'floor'),
  device('floor-3', 'Floor 3', 'floor'),
  device('counter-1', 'Counter 1', 'counter'),
];

export const deviceByKey = (key: string): Device => DEVICES.find((d) => d.id === seedId(`device:${key}`))!;

export const LOCATIONS: StockLocation[] = [
  { id: seedId('location:store'), outletId: OUTLET.id, name: 'Store', kind: 'store', isDefaultReceipt: true, isDefaultSale: false, status: 'active' },
  { id: seedId('location:bar'), outletId: OUTLET.id, name: 'Bar shelf', kind: 'service', isDefaultReceipt: false, isDefaultSale: true, status: 'active' },
  { id: seedId('location:counter'), outletId: OUTLET.id, name: 'Counter', kind: 'retail', isDefaultReceipt: false, isDefaultSale: false, status: 'active' },
];

export const ZONES: Zone[] = [
  { id: seedId('zone:terrace'), outletId: OUTLET.id, name: 'Terrace', sortOrder: 1, defaultPriceListId: null, status: 'active' },
  { id: seedId('zone:main-bar'), outletId: OUTLET.id, name: 'Main bar', sortOrder: 2, defaultPriceListId: null, status: 'active' },
  // Places at the bar are stools. The Counter is the staff station, never a place a guest sits. docs/14 section 2.
  { id: seedId('zone:stools'), outletId: OUTLET.id, name: 'Bar stools', sortOrder: 3, defaultPriceListId: null, status: 'active' },
];

const table = (label: string, zone: string, seats: number, x: number, y: number): ServiceTable => ({
  id: seedId(`table:${label}`),
  outletId: OUTLET.id,
  zoneId: seedId(`zone:${zone}`),
  label,
  seats,
  positionX: x,
  positionY: y,
  status: 'available',
});

export const TABLES: ServiceTable[] = [
  table('T1', 'terrace', 4, 0, 0),
  table('T2', 'terrace', 2, 1, 0),
  table('T3', 'terrace', 6, 2, 0),
  table('T4', 'terrace', 4, 0, 1),
  table('T5', 'terrace', 4, 1, 1),
  table('T6', 'main-bar', 4, 0, 0),
  table('T7', 'main-bar', 4, 1, 0),
  table('T8', 'main-bar', 2, 2, 0),
  table('T9', 'main-bar', 2, 0, 1),
  table('T10', 'main-bar', 6, 1, 1),
  table('S1', 'stools', 1, 0, 0),
  table('S2', 'stools', 1, 1, 0),
];

export const tableByLabel = (label: string): ServiceTable => TABLES.find((t) => t.label === label)!;

export interface Supplier {
  id: string;
  outletId: string;
  name: string;
  contactName: string;
  paymentTermsDays: number;
  leadTimeDays: number;
  minOrderCents: Cents;
  status: 'active' | 'archived';
  phone?: string | null;
  email?: string | null;
  /** ISO weekdays the supplier delivers on, 1 Monday to 7 Sunday. */
  deliveryDays?: number[];
  notes?: string | null;
}

export const SUPPLIERS: Supplier[] = [
  { id: seedId('supplier:rift'), outletId: OUTLET.id, name: 'Rift Valley Beverages', contactName: 'Daniel Rotich', paymentTermsDays: 14, leadTimeDays: 2, minOrderCents: shillings(20000), status: 'active' },
  { id: seedId('supplier:kariuki'), outletId: OUTLET.id, name: 'Kariuki Wines and Spirits', contactName: 'Lucy Kariuki', paymentTermsDays: 30, leadTimeDays: 3, minOrderCents: shillings(30000), status: 'active' },
  { id: seedId('supplier:coast'), outletId: OUTLET.id, name: 'Coast Soft Drinks', contactName: 'Hassan Omar', paymentTermsDays: 7, leadTimeDays: 1, minOrderCents: shillings(5000), status: 'active' },
];

export const supplierByKey = (key: string): Supplier => SUPPLIERS.find((s) => s.id === seedId(`supplier:${key}`))!;
