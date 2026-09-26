import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { pinWeakness } from '@bliss/shared/pin';
import { describe, expect, it } from 'vitest';
import { actorWithRole, ownerActor } from '../test/actors';
import * as audit from './audit/service';
import * as credentials from './identity/credentials';
import * as pins from './identity/pins';
import * as identity from './identity/service';

/**
 * PINs as a manager runs them: the rules a PIN must pass, who may set whose, what a reset does to
 * sessions already signed in, expiry forcing a new PIN, and the outlet's policy. docs/08, PINs.
 */

const REASON = 'Forgot their PIN on the night shift';

describe('the rules a PIN passes', () => {
  it('turns away runs, repeats, common PINs and mirrored halves', () => {
    expect(pinWeakness('1111')).toMatch(/repeated/);
    expect(pinWeakness('45678901')).toMatch(/run/);
    expect(pinWeakness('9876')).toMatch(/run/);
    expect(pinWeakness('2580')).toMatch(/first PINs/);
    expect(pinWeakness('47194719')).toMatch(/halves/);
    expect(pinWeakness('4719')).toBeNull();
  });

  it('holds the length it is set to, four to eight', () => {
    expect(() => pins.checkPin('4719', 6)).toThrow(/needs 6 digits/);
    expect(() => pins.checkPin('471', 3)).toThrow(/four to eight/);
    expect(() => pins.checkPin('47a9', 4)).toThrow(/digits only/);
    expect(() => pins.checkPin('4719', 4)).not.toThrow();
  });

  it('makes random PINs that pass, at any length', () => {
    for (const length of [4, 5, 6, 7, 8]) {
      const pin = pins.generatePin(length);
      expect(pin).toMatch(new RegExp(`^\\d{${length}}$`));
      expect(pinWeakness(pin)).toBeNull();
    }
  });
});

describe('setting a PIN', () => {
  it('sets a typed PIN of any allowed length, with an expiry, and records it as sensitive', () => {
    const peter = staffByKey('peter');
    const result = pins.setPin({ staffId: peter.id, mode: 'typed', pin: '4719', length: 4, expiresInDays: 30, mustChange: false, reason: REASON, actor: actorWithRole('manager') });
    expect(result.pin).toBeNull();
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(identity.verifyStaffPin(peter.id, '4719')).toBe(true);
    expect(peter.pinLength).toBe(4);
    expect(pins.pinStatus(peter)).toBe('set');
    const entry = audit.list().find((e) => e.entityId === peter.id && (e.action === 'staff.pin_set' || e.action === 'staff.pin_reset'));
    expect(entry).toMatchObject({ severity: 'sensitive', reason: REASON });
    expect(JSON.stringify(entry)).not.toContain('4719');
  });

  it('hands back a generated PIN once, and keeps only its hash', () => {
    const peter = staffByKey('peter');
    const result = pins.setPin({ staffId: peter.id, mode: 'generated', pin: null, length: 8, expiresInDays: null, mustChange: true, reason: REASON, actor: actorWithRole('manager') });
    expect(result.pin).toMatch(/^\d{8}$/);
    expect(peter.pinHash).not.toContain(result.pin!);
    expect(identity.verifyStaffPin(peter.id, result.pin!)).toBe(true);
    expect(pins.pinStatus(peter)).toBe('must_change');
  });

  it('refuses a PIN the person had before', () => {
    const peter = staffByKey('peter');
    expect(() => pins.setPin({ staffId: peter.id, mode: 'typed', pin: '4719', length: 4, mustChange: false, reason: REASON, actor: actorWithRole('manager') })).toThrow(/used before/);
  });

  it('lets a manager set PINs only below them, an owner anyone else, and nobody their own', () => {
    const manager = actorWithRole('manager');
    const input = { mode: 'typed' as const, pin: '5820', length: 4, mustChange: false, reason: REASON };
    expect(() => pins.setPin({ ...input, staffId: staffByKey('sam').id, actor: manager })).toThrow(/Only an owner/);
    expect(() => pins.setPin({ ...input, staffId: manager.staffId, actor: manager })).toThrow(/account menu/);
    expect(() => pins.setPin({ ...input, staffId: staffByKey('amina').id, actor: actorWithRole('waiter') })).toThrow();
    expect(() => pins.setPin({ ...input, staffId: staffByKey('dan').id, actor: ownerActor() })).not.toThrow();
    expect(pins.maySetPin(manager.staffId, staffByKey('sam'))).toBe(false);
    expect(pins.maySetPin(manager.staffId, staffByKey('amina'))).toBe(true);
  });

  it('needs a reason', () => {
    expect(() => pins.setPin({ staffId: staffByKey('amina').id, mode: 'generated', length: 6, mustChange: false, reason: '', actor: actorWithRole('manager') })).toThrow();
  });
});

describe('what a change ends', () => {
  it('ends the sessions signed with the old PIN, on the Console and on stations', () => {
    const grace = staffByKey('grace');
    const station = identity.issueStationToken(grace.id, deviceByKey('counter-1').id);
    expect(identity.checkStationToken(station)).toMatchObject({ ok: true });
    pins.setPin({ staffId: grace.id, mode: 'generated', length: 6, mustChange: false, reason: REASON, actor: actorWithRole('manager') });
    expect(identity.checkStationToken(station)).toMatchObject({ ok: false, status: 401 });

    const dan = staffByKey('dan');
    const console = identity.issueConsoleSession(dan.id);
    pins.endSessions({ staffId: dan.id, reason: 'Left the office laptop signed in', actor: ownerActor() });
    expect(identity.checkConsoleSession(console)).toEqual({ ok: false, reason: 'pin_changed' });
  });

  it('takes a PIN away so nobody signs in as them', () => {
    const grace = staffByKey('grace');
    pins.clearPin({ staffId: grace.id, reason: 'PIN was shared at the counter', actor: actorWithRole('manager') });
    expect(grace.pinHash).toBeNull();
    expect(pins.pinStatus(grace)).toBe('none');
  });
});

describe('choosing your own', () => {
  it('asks for a new PIN after a reset or an expiry, and the pass works once', () => {
    const peter = staffByKey('peter');
    const given = pins.setPin({ staffId: peter.id, mode: 'generated', length: 6, mustChange: true, reason: REASON, actor: actorWithRole('manager') }).pin!;
    expect(pins.mustChangeAtSignIn(peter)).toBe(true);
    const pass = identity.issuePinChangeToken(peter.id);
    expect(identity.staffFromPinChangeToken(pass)?.id).toBe(peter.id);
    expect(() => pins.chooseOwnPin({ staffId: peter.id, next: given, viaSignIn: true })).toThrow(/used before/);
    pins.chooseOwnPin({ staffId: peter.id, next: '730418', viaSignIn: true });
    expect(pins.mustChangeAtSignIn(peter)).toBe(false);
    expect(identity.verifyStaffPin(peter.id, '730418')).toBe(true);
    // The pass named the old PIN; once it changed, the pass is spent.
    expect(identity.staffFromPinChangeToken(pass)).toBeNull();

    peter.pinExpiresAt = Date.now() - 1;
    expect(pins.pinStatus(peter)).toBe('expired');
    expect(pins.mustChangeAtSignIn(peter)).toBe(true);
  });

  it('needs the current PIN when changed from the account menu', () => {
    const peter = staffByKey('peter');
    expect(() => pins.chooseOwnPin({ staffId: peter.id, current: '000000', next: '615093' })).toThrow(/current PIN/);
    pins.chooseOwnPin({ staffId: peter.id, current: '730418', next: '615093' });
    expect(identity.verifyStaffPin(peter.id, '615093')).toBe(true);
  });
});

describe('the outlet policy', () => {
  it('sets the length of new PINs, the lockout and the history, within bounds', () => {
    const actor = ownerActor();
    const base = { length: 5, expiryDays: 90, lockAttempts: 3, history: 2, ownPinAfterReset: true };
    expect(() => pins.updatePolicy({ policy: { ...base, length: 9 }, reason: 'Longer PINs for everyone', actor })).toThrow(/four to eight/);
    expect(() => pins.updatePolicy({ policy: { ...base, lockAttempts: 1 }, reason: 'Longer PINs for everyone', actor })).toThrow(/3 to 10/);
    pins.updatePolicy({ policy: base, reason: 'Longer PINs for everyone', actor });
    expect(pins.policy()).toMatchObject(base);
    expect(pins.lockAttempts()).toBe(3);

    const key = `pin:test-${Date.now()}`;
    credentials.recordFailure(key, Date.now(), pins.lockAttempts());
    credentials.recordFailure(key, Date.now(), pins.lockAttempts());
    expect(credentials.recordFailure(key, Date.now(), pins.lockAttempts())).toMatchObject({ locked: true });
    pins.updatePolicy({ policy: pins.DEFAULT_POLICY, reason: 'Back to the usual rules', actor });
  });

  it('flags PINs running out within the week', () => {
    const amina = staffByKey('amina');
    amina.pinExpiresAt = Date.now() + 2 * 86_400_000;
    expect(pins.expiringSoon(identity.staffList()).map((s) => s.id)).toContain(amina.id);
    expect(pins.pinStatus(amina)).toBe('expiring');
    amina.pinExpiresAt = null;
  });
});
