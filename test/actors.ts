import type { RoleKey } from '@bliss/shared/domain';
import type { Actor } from '@bliss/shared/reason';
import * as identity from '@/modules/identity/service';

/**
 * An explicit actor for module tests. The Console session never falls back to anyone, so a test says
 * who it acts as: the first active person holding the role.
 */
export function actorWithRole(role: RoleKey): Actor {
  const person = identity.staffList().find((s) => s.employmentStatus === 'active' && identity.roleFor(s.id)?.key === role);
  if (!person) throw new Error(`The test dataset has no active ${role}.`);
  return { staffId: person.id, deviceId: null };
}

export const ownerActor = () => actorWithRole('owner');
