import { describe, expect, it } from 'vitest';
import { actorWithRole, ownerActor } from '../test/actors';
import * as identity from './identity/service';

describe('starting the team again', () => {
  it('is for an owner, and asks for a reason', () => {
    const waiter = actorWithRole('waiter');
    expect(() => identity.leaveAllExceptMe({ reason: 'Clearing the trial team before the real one is added', actor: waiter })).toThrow();
    expect(() => identity.leaveAllExceptMe({ reason: 'x', actor: ownerActor() })).toThrow();
  });

  it('keeps the owner, ends everyone else, and leaves their records and sign-ins ended', () => {
    const owner = ownerActor();
    const before = identity.staffList().length;
    const pinVersions = new Map(identity.staffList().map((s) => [s.id, s.pinVersion ?? 0]));
    const left = identity.leaveAllExceptMe({ reason: 'Clearing the trial team before the real one is added', actor: owner });
    expect(left).toBeGreaterThan(0);
    // Nobody is deleted: bills and the audit trail still name them.
    expect(identity.staffList()).toHaveLength(before);
    const active = identity.staffList().filter((s) => s.employmentStatus === 'active');
    expect(active.map((s) => s.id)).toEqual([owner.staffId]);
    for (const s of identity.staffList()) {
      if (s.id !== owner.staffId) expect(s.pinVersion ?? 0).toBeGreaterThan(pinVersions.get(s.id) ?? 0);
    }
    // Run again: nobody is left to go.
    expect(identity.leaveAllExceptMe({ reason: 'Clearing the trial team before the real one is added', actor: owner })).toBe(0);
  });
});
