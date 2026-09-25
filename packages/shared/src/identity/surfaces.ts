import type { RoleKey } from '../domain';

/**
 * Where staff sign in. docs/14-surfaces-counter-and-sync.md section 1.
 *
 * The Floor takes orders at tables; the Counter pours, settles and closes the drawer; the Console is
 * management and has its own sign-in. One table, read by both sign-in screens and enforced by the
 * server, so a device never offers a person it will then refuse.
 */
export type StaffSurface = 'floor' | 'counter' | 'console';

export const SURFACE_ROLES: Record<StaffSurface, readonly RoleKey[]> = {
  floor: ['waiter', 'supervisor'],
  counter: ['waiter', 'supervisor', 'cashier', 'manager', 'owner'],
  console: ['manager', 'owner', 'stock_controller'],
};

export const SURFACE_NAME: Record<StaffSurface, string> = { floor: 'Floor', counter: 'Counter', console: 'Console' };

export function isStaffSurface(kind: string): kind is StaffSurface {
  return kind === 'floor' || kind === 'counter' || kind === 'console';
}

export function canSignInOn(surface: StaffSurface, role: RoleKey | null | undefined): boolean {
  return role ? SURFACE_ROLES[surface].includes(role) : false;
}

/** The sentence for the wrong device: where to go instead, never only "denied". */
export function wrongSurfaceMessage(surface: StaffSurface, role: RoleKey | null | undefined): string {
  if (!role) return 'This role does not sign in here.';
  if (surface === 'console') {
    if (role === 'waiter') return 'Waiters sign in on a floor tablet or at the counter, not in the Console.';
    if (role === 'cashier') return 'Cashiers sign in at the counter, not in the Console.';
    if (role === 'supervisor') return 'Supervisors sign in on a floor tablet or at the counter, not in the Console.';
    return 'This role does not sign in here.';
  }
  if (role === 'stock_controller') return 'This role does not sign in on the floor or at the counter. Stock work happens in the Console.';
  if (role === 'manager' || role === 'owner') return 'Management works in the Console. Sign in there instead.';
  const other: StaffSurface = surface === 'floor' ? 'counter' : 'floor';
  if (canSignInOn(other, role)) return other === 'counter' ? 'This role signs in at the counter, not on a floor tablet.' : 'This role signs in on a floor tablet, not at the counter.';
  return 'This role does not sign in here.';
}
