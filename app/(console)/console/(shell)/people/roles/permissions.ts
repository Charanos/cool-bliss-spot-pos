import type { PermissionKey, Role, Staff } from '@bliss/shared/domain';
import { SURFACE_NAME, SURFACE_ROLES, type StaffSurface } from '@bliss/shared/identity';

/** Plain words for each permission, in the order a manager thinks about them. docs/08. */
export const PERMISSIONS: { key: PermissionKey; label: string; detail: string }[] = [
  { key: 'void.approve', label: 'Approve voids', detail: 'Takes a fired line off a bill' },
  { key: 'discount.approve', label: 'Approve discounts', detail: 'On a line or a whole bill' },
  { key: 'refund.approve', label: 'Approve refunds', detail: 'On a settled bill' },
  { key: 'drawer.close', label: 'Close a drawer', detail: 'Blind count at the end of the day' },
  { key: 'hold.set', label: 'Put items on hold', detail: 'Stops the floor selling them' },
  { key: 'stock.writeoff', label: 'Write off stock', detail: 'Breakage, spillage, expiry, comps' },
  { key: 'stock.count.commit', label: 'Commit stock counts', detail: 'Writes adjustments to the ledger' },
  { key: 'cost.read', label: 'See costs', detail: 'Cost prices, purchasing and stock value' },
  { key: 'report.margin', label: 'See margin reports', detail: 'Gross margin and pour variance at cost' },
  { key: 'price.write', label: 'Change prices', detail: 'Price lists, time rules and catalogue settings' },
  { key: 'export.run', label: 'Export to CSV', detail: 'Sales, purchases and movements' },
  { key: 'staff.manage', label: 'Manage people', detail: 'Roles, permissions and access' },
  { key: 'device.manage', label: 'Manage devices', detail: 'Register and withdraw tablets' },
];

/** Where a role signs in, in words: "Floor and Counter". */
export function surfacesOf(key: Role['key']): string {
  const on = (Object.keys(SURFACE_ROLES) as StaffSurface[]).filter((s) => SURFACE_ROLES[s].includes(key)).map((s) => SURFACE_NAME[s]);
  return on.length === 0 ? 'Nowhere' : on.length === 1 ? on[0]! : `${on.slice(0, -1).join(', ')} and ${on.at(-1)}`;
}

export interface RoleView {
  id: string;
  key: Role['key'];
  name: string;
  isSystem: boolean;
  permissions: PermissionKey[];
  people: number;
  members: { id: string; name: string; avatarUrl: string | null; colourIndex: number }[];
  surfaces: string;
  locked: boolean;
  lockedReason: string | null;
}

/** A role as the list, the matrix and the record show it. */
export function roleView(r: Role, staff: readonly Staff[], actorRoleId: string): RoleView {
  const members = staff.filter((s) => s.roleId === r.id && s.employmentStatus === 'active');
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: r.isSystem,
    permissions: r.permissions,
    people: members.length,
    members: members.map((m) => ({ id: m.id, name: m.fullName, avatarUrl: m.avatarUrl, colourIndex: m.colourIndex })),
    surfaces: surfacesOf(r.key),
    locked: r.key === 'owner' || r.id === actorRoleId,
    lockedReason: r.key === 'owner' ? 'The owner role always holds every permission' : r.id === actorRoleId ? 'Another manager changes the role you hold' : null,
  };
}
