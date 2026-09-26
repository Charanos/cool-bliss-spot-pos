import 'server-only';

import type { PinPolicy, Staff } from '@bliss/shared/domain';
import { PIN_MAX, PIN_MIN, pinWeakness } from '@bliss/shared/pin';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { randomInt } from 'node:crypto';
import { DomainError } from '../_data/errors';
import { bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as credentials from './credentials';
import { assertCan, outlet, pinLocked, pinState, rankOf, roleFor, staffById } from './service';

/**
 * PINs, managed by an owner or manager. docs/08, PINs. A PIN is four to eight digits; the outlet's
 * policy says how many a new one has, how long it lasts, how many wrong tries lock it, and how many
 * old PINs cannot come back. A manager sets someone's PIN (typed, or made at random and shown once);
 * the person can be asked to choose their own at the next sign-in. Every change ends the sessions
 * signed with the old one, and each is kept in the audit trail as sensitive.
 */

export const DEFAULT_POLICY: PinPolicy = { length: 6, expiryDays: null, lockAttempts: 5, history: 3, ownPinAfterReset: true };
const DAY = 24 * 60 * 60_000;
/** A PIN within this many days of its expiry is flagged as expiring soon. */
export const EXPIRING_SOON_DAYS = 7;

export function policy(): PinPolicy {
  return { ...DEFAULT_POLICY, ...(outlet().pinPolicy ?? {}) };
}

/** The length a person's PIN has: theirs if set, else the outlet's. */
export function lengthFor(staff: Pick<Staff, 'pinLength'> | null | undefined): number {
  return staff?.pinLength ?? (staff ? 6 : policy().length);
}

/** The wrong tries a PIN is allowed before it locks, from the outlet's policy. */
export function lockAttempts(): number {
  return policy().lockAttempts;
}

/** Why a PIN is too easy, or null when it is fine. */
export const weakness = pinWeakness;

/** Check a PIN against the rules, and against this person's earlier PINs. Throws in plain words. */
export function checkPin(pin: string, length: number, staff?: Staff | null): void {
  if (!/^\d+$/.test(pin)) throw new DomainError('A PIN is digits only.');
  if (length < PIN_MIN || length > PIN_MAX) throw new DomainError('A PIN is four to eight digits.');
  if (pin.length !== length) throw new DomainError(`This PIN needs ${length} digits.`);
  const weak = weakness(pin);
  if (weak) throw new DomainError(`That PIN is too easy to guess. ${weak}`);
  if (staff) {
    const previous = [staff.pinHash, ...(staff.pinHistory ?? [])].filter((h): h is string => Boolean(h) && credentials.isHashedPin(h)).slice(0, policy().history + 1);
    if (previous.some((h) => credentials.verifyPin(pin, h))) throw new DomainError('That PIN was used before. Choose one they have not had.');
  }
}

/** A random PIN of this length that passes every rule. Shown once, never stored in the clear. */
export function generatePin(length: number, staff?: Staff | null): string {
  for (let i = 0; i < 200; i += 1) {
    const pin = Array.from({ length }, () => String(randomInt(0, 10))).join('');
    try {
      checkPin(pin, length, staff);
      return pin;
    } catch {
      // Try again: a random PIN is rarely weak.
    }
  }
  throw new DomainError('A PIN could not be made. Try again.');
}

export type PinStatus = 'none' | 'set' | 'expiring' | 'expired' | 'must_change' | 'locked';

/** Where a person's PIN stands, most urgent first. */
export function pinStatus(staff: Staff, now = Date.now()): PinStatus {
  if (pinLocked(staff.id)) return 'locked';
  if (pinState(staff) === 'none') return 'none';
  if (staff.pinMustChange) return 'must_change';
  if (staff.pinExpiresAt && staff.pinExpiresAt <= now) return 'expired';
  if (staff.pinExpiresAt && staff.pinExpiresAt - now <= EXPIRING_SOON_DAYS * DAY) return 'expiring';
  return 'set';
}

/** Whether a correct PIN still has to be replaced before its person can work. */
export function mustChangeAtSignIn(staff: Staff, now = Date.now()): boolean {
  return Boolean(staff.pinMustChange) || Boolean(staff.pinExpiresAt && staff.pinExpiresAt <= now);
}

/** Managers set PINs for people below them; only an owner sets a manager's or an owner's. */
function assertMaySetPin(actor: Actor, person: Staff) {
  assertCan(actor.staffId, 'staff.manage', 'setting PINs');
  if (person.id === actor.staffId) throw new DomainError('Change your own PIN from the account menu, with your current PIN.');
  const mine = roleFor(actor.staffId);
  const theirs = roleFor(person.id);
  if (mine?.key !== 'owner' && rankOf(theirs) >= rankOf(mine)) throw new DomainError(`Only an owner can set ${person.displayName}'s PIN.`);
  if (person.employmentStatus === 'left') throw new DomainError(`${person.displayName} has left, so they have no PIN to set.`);
}

/** Store a new PIN on a person: hash, history, dates and version, and lift any lock. */
export function applyPin(person: Staff, pin: string, length: number, expiresInDays: number | null, mustChange: boolean, now = Date.now()) {
  const history = [person.pinHash, ...(person.pinHistory ?? [])].filter((h): h is string => Boolean(h) && credentials.isHashedPin(h)).slice(0, Math.max(0, policy().history));
  person.pinHash = credentials.hashPin(pin);
  person.pinHistory = history;
  person.pinLength = length;
  person.pinSetAt = now;
  person.pinExpiresAt = expiresInDays ? now + expiresInDays * DAY : null;
  person.pinMustChange = mustChange;
  person.pinVersion = (person.pinVersion ?? 0) + 1;
  person.pinLockedUntil = null;
  person.pinClearedAt = null;
  credentials.unlock(`pin:${person.id}`);
}

/** Whether this actor may set, reset or clear this person's PIN, for showing the controls. */
export function maySetPin(actorStaffId: string, person: Staff): boolean {
  try {
    assertMaySetPin({ staffId: actorStaffId, deviceId: null }, person);
    return true;
  } catch {
    return false;
  }
}

export interface SetPinInput {
  staffId: string;
  mode: 'typed' | 'generated';
  /** For `typed`: the digits, confirmed on the client. */
  pin?: string | null;
  length: number;
  /** Days it lasts; null for never. Absent: the outlet's policy. */
  expiresInDays?: number | null;
  mustChange: boolean;
  reason: string;
  actor: Actor;
}

/**
 * Set or reset someone's PIN. A generated PIN is returned once, for the manager to hand over; a
 * typed one is not returned. Either way the old PIN stops working and their sessions end.
 */
export function setPin(input: SetPinInput): { pin: string | null; expiresAt: number | null } {
  const { reason, actor } = requireReasoned(input);
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  assertMaySetPin(actor, person);
  // A generated PIN is usually made in the dialog, so the manager sees it before saving; made here if not.
  const pin = input.pin || (input.mode === 'generated' ? generatePin(input.length, person) : '');
  checkPin(pin, input.length, person);
  const days = input.expiresInDays === undefined ? policy().expiryDays : input.expiresInDays;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 730)) throw new DomainError('A PIN lasts 1 to 730 days, or never runs out.');
  const hadPin = Boolean(person.pinHash);
  applyPin(person, pin, input.length, days, input.mustChange);
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: actor.staffId,
    action: hadPin ? 'staff.pin_reset' : 'staff.pin_set',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: { length: input.length, generated: input.mode === 'generated', expiresAt: person.pinExpiresAt ?? null, mustChange: input.mustChange },
    reason,
    severity: 'sensitive',
  });
  return { pin: input.mode === 'generated' ? pin : null, expiresAt: person.pinExpiresAt ?? null };
}

/** Take a PIN away: nobody signs in as them until a new one is set. */
export function clearPin(input: { staffId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  assertMaySetPin(actor, person);
  if (pinState(person) === 'none') return;
  person.pinClearedAt = Date.now();
  person.pinHistory = [person.pinHash, ...(person.pinHistory ?? [])].filter((h): h is string => Boolean(h) && credentials.isHashedPin(h)).slice(0, policy().history);
  person.pinHash = null;
  person.pinExpiresAt = null;
  person.pinMustChange = false;
  person.pinVersion = (person.pinVersion ?? 0) + 1;
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: actor.staffId,
    action: 'staff.pin_cleared',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: null,
    reason,
    severity: 'sensitive',
  });
}

/** End every session a person has, on every surface, without changing their PIN. */
export function endSessions(input: { staffId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  const person = staffById(input.staffId);
  if (!person) throw new DomainError('That person is not part of this outlet.');
  assertMaySetPin(actor, person);
  person.pinVersion = (person.pinVersion ?? 0) + 1;
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: actor.staffId,
    action: 'staff.sessions_ended',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: null,
    reason,
    severity: 'sensitive',
  });
}

/**
 * A person chooses their own PIN: from the account menu with their current one, or at sign-in when
 * a manager's reset or an expiry asks them to. The length is the outlet's for a new PIN.
 */
export function chooseOwnPin(input: { staffId: string; next: string; current?: string | null; viaSignIn?: boolean }): void {
  const person = staffById(input.staffId);
  if (!person || person.employmentStatus !== 'active') throw new DomainError('This PIN no longer works. A manager can check your access.');
  if (!input.viaSignIn) {
    if (!input.current || !credentials.verifyPin(input.current, person.pinHash)) throw new DomainError('Your current PIN is not right.');
  }
  const length = policy().length;
  checkPin(input.next, length, person);
  applyPin(person, input.next, length, policy().expiryDays, false);
  bumpCatalogueVersion();
  audit.record({
    outletId: person.outletId,
    actorStaffId: person.id,
    action: 'staff.pin_changed',
    entityType: 'staff',
    entityId: person.id,
    before: null,
    after: { length, expiresAt: person.pinExpiresAt ?? null },
    reason: null,
    severity: 'notable',
  });
}

/** Change the outlet's PIN policy. New PINs follow it; PINs already set keep their length. */
export function updatePolicy(input: { policy: PinPolicy; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  assertCan(actor.staffId, 'staff.manage', 'changing the PIN rules');
  const p = input.policy;
  if (!Number.isInteger(p.length) || p.length < 4 || p.length > 8) throw new DomainError('A PIN is four to eight digits.');
  if (p.expiryDays !== null && (!Number.isInteger(p.expiryDays) || p.expiryDays < 7 || p.expiryDays > 730)) throw new DomainError('A PIN lasts 7 to 730 days, or never runs out.');
  if (!Number.isInteger(p.lockAttempts) || p.lockAttempts < 3 || p.lockAttempts > 10) throw new DomainError('A PIN locks after 3 to 10 wrong tries.');
  if (!Number.isInteger(p.history) || p.history < 0 || p.history > 10) throw new DomainError('Keep 0 to 10 earlier PINs from coming back.');
  const current = outlet();
  const before = policy();
  current.pinPolicy = { length: p.length, expiryDays: p.expiryDays, lockAttempts: p.lockAttempts, history: p.history, ownPinAfterReset: p.ownPinAfterReset };
  bumpCatalogueVersion();
  audit.record({
    outletId: current.id,
    actorStaffId: actor.staffId,
    action: 'outlet.pin_policy',
    entityType: 'outlet',
    entityId: current.id,
    before: { ...before },
    after: { ...current.pinPolicy },
    reason,
    severity: 'sensitive',
  });
}

/** People whose PIN runs out within the week, for the Overview. */
export function expiringSoon(people: readonly Staff[], now = Date.now()): Staff[] {
  return people.filter((s) => s.employmentStatus === 'active' && s.pinExpiresAt && s.pinExpiresAt > now && s.pinExpiresAt - now <= EXPIRING_SOON_DAYS * DAY);
}
