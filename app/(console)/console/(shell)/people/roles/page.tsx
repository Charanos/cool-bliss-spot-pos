import type { PermissionKey } from '@bliss/shared/domain';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import { TabIntro } from '../../_components/workspace';
import { RolesMatrix } from './roles-matrix';

export const metadata: Metadata = { title: 'Roles and permissions' };

/** Plain words for each permission, in the order a manager thinks about them. docs/08. */
const PERMISSIONS: { key: PermissionKey; label: string; detail: string }[] = [
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

export default async function RolesPage() {
  const actor = await identity.currentConsoleActor();
  const staff = identity.staffList();
  const roles = identity.roles().map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    permissions: r.permissions,
    people: staff.filter((s) => s.roleId === r.id && s.employmentStatus === 'active').length,
    locked: r.key === 'owner' || r.id === actor.role.id,
    lockedReason: r.key === 'owner' ? 'The owner role always holds every permission' : r.id === actor.role.id ? 'Another manager changes the role you hold' : null,
  }));
  return (
    <>
      <TabIntro>What each role can do. A change applies from that person&rsquo;s next action, on every device, and is recorded with its reason.</TabIntro>
      <RolesMatrix roles={roles} permissions={PERMISSIONS} canManage={identity.can(actor.staffId, 'staff.manage')} />
    </>
  );
}
