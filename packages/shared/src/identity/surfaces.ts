import type { RoleKey } from '../domain';

/**
 * Where staff sign in. docs/14-surfaces-counter-and-sync.md section 1.
 *
 * The Floor takes orders at tables; the Counter pours, settles and closes the drawer; the Console is
 * management and has its own sign-in. One table, read by both sign-in screens and enforced by the
 * server, so a device never offers a person it will then refuse.
 */
export type StaffSurface = 'floor' | 'counter';

export const SURFACE_ROLES: Record<StaffSurface, readonly RoleKey[]> = {
  floor: ['waiter', 'supervisor'],
  counter: ['waiter', 'supervisor', 'cashier', 'manager', 'owner'],
};

export const SURFACE_NAME: Record<StaffSurface, string> = { floor: 'Floor', counter: 'Counter' };

export function isStaffSurface(kind: string): kind is StaffSurface {
  return kind === 'floor' || kind === 'counter';
}

export function canSignInOn(surface: StaffSurface, role: RoleKey | null | undefined): boolean {
  return role ? SURFACE_ROLES[surface].includes(role) : false;
}

/** The sentence for the wrong device: where to go instead, never only "denied". */
export function wrongSurfaceMessage(surface: StaffSurface, role: RoleKey | null | undefined): string {
  if (!role || role === 'stock_controller') return 'This role does not sign in on the floor or at the counter. Stock work happens in the Console.';
  const other: StaffSurface = surface === 'floor' ? 'counter' : 'floor';
  if (canSignInOn(other, role)) return other === 'counter' ? 'This role signs in at the counter, not on a floor tablet.' : 'This role signs in on a floor tablet, not at the counter.';
  return 'This role does not sign in here. Management works in the Console.';
}
