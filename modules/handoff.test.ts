import { staffByKey } from '@bliss/db/seed/organisation';
import { describe, expect, it } from 'vitest';
import * as credentials from './identity/credentials';
import * as identity from './identity/service';

/**
 * Switching surfaces carries the person who switched, and no one else. A ticket names them and the
 * surface it opens, works once, lasts a minute, and is checked again when it is spent: their role
 * must belong there and their PIN must not have changed since.
 */

const dan = staffByKey('dan').id;
const peter = staffByKey('peter').id;
const grace = staffByKey('grace').id;

describe('handoff tickets', () => {
  it('signs in exactly the person it names, once', () => {
    const ticket = identity.issueHandoff(dan, 'console', 'floor');
    const first = identity.redeemHandoff(ticket, 'floor');
    expect(first.ok && first.staff.id).toBe(dan);
    expect(first.ok && first.from).toBe('console');
    expect(identity.redeemHandoff(ticket, 'floor').ok).toBe(false);
  });

  it('opens only the surface it was made for', () => {
    const ticket = identity.issueHandoff(dan, 'console', 'floor');
    expect(identity.redeemHandoff(ticket, 'counter').ok).toBe(false);
    expect(identity.redeemHandoff(ticket, 'console').ok).toBe(false);
  });

  it('refuses a role that does not belong where it is going', () => {
    expect(identity.redeemHandoff(identity.issueHandoff(peter, 'floor', 'console'), 'console').ok).toBe(false);
    expect(identity.redeemHandoff(identity.issueHandoff(grace, 'counter', 'floor'), 'floor').ok).toBe(false);
  });

  it('runs out after a minute, and is refused if forged or altered', () => {
    const old = credentials.signToken({ k: 'handoff', sid: dan, pv: 0, from: 'console', to: 'counter', n: 'old-one', ttlMs: identity.HANDOFF_MS }, Date.now() - identity.HANDOFF_MS - 1);
    expect(identity.redeemHandoff(old, 'counter').ok).toBe(false);
    const ticket = identity.issueHandoff(dan, 'console', 'counter');
    expect(identity.redeemHandoff(`${ticket}x`, 'counter').ok).toBe(false);
    // Another kind of token is never a ticket.
    expect(identity.redeemHandoff(identity.issueConsoleSession(dan), 'counter').ok).toBe(false);
    expect(identity.redeemHandoff(null, 'counter').ok).toBe(false);
  });

  it('ends with a PIN change', () => {
    const ticket = identity.issueHandoff(dan, 'console', 'counter');
    const staff = identity.staffById(dan)!;
    const before = staff.pinVersion;
    staff.pinVersion = (staff.pinVersion ?? 0) + 1;
    try {
      expect(identity.redeemHandoff(ticket, 'counter').ok).toBe(false);
    } finally {
      staff.pinVersion = before;
    }
  });
});
