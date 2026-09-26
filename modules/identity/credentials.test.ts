import { describe, expect, it } from 'vitest';
import { ATTEMPT_WINDOW_MS, LOCK_MS, MAX_ATTEMPTS, attemptStatus, clearAttempts, hashPin, isHashedPin, recordFailure, signToken, verifyPin, verifyToken } from './credentials';

describe('PIN hashing', () => {
  it('stores a salted scrypt hash, never the PIN', () => {
    const a = hashPin('482915');
    const b = hashPin('482915');
    expect(isHashedPin(a)).toBe(true);
    expect(a).not.toContain('482915');
    expect(a).not.toBe(b);
  });

  it('accepts the right PIN and refuses a wrong one', () => {
    const stored = hashPin('482915');
    expect(verifyPin('482915', stored)).toBe(true);
    expect(verifyPin('482916', stored)).toBe(false);
    expect(verifyPin('48291', stored)).toBe(false);
  });

  it('still checks a legacy plaintext PIN, in constant time', () => {
    expect(verifyPin('730261', '730261')).toBe(true);
    expect(verifyPin('730262', '730261')).toBe(false);
    expect(verifyPin('730261', null)).toBe(false);
  });

  it('refuses to hash anything but four to eight digits', () => {
    expect(() => hashPin('123')).toThrow();
    expect(() => hashPin('123456789')).toThrow();
    expect(() => hashPin('abcdef')).toThrow();
  });
});

describe('signed tokens', () => {
  it('round trips claims of the right kind', () => {
    const token = signToken({ k: 'station', sid: 'staff-1', did: 'device-1', ttlMs: 60_000 });
    expect(verifyToken(token, 'station')).toMatchObject({ sid: 'staff-1', did: 'device-1' });
  });

  it('never accepts one kind of token as another', () => {
    const token = signToken({ k: 'approval', sid: 'staff-1', perm: 'void.approve', ttlMs: 60_000 });
    expect(verifyToken(token, 'console')).toBeNull();
    expect(verifyToken(token, 'station')).toBeNull();
  });

  it('refuses an expired token', () => {
    const token = signToken({ k: 'console', sid: 'staff-1', ttlMs: 1000 }, 1_000_000);
    expect(verifyToken(token, 'console', 1_000_500)).not.toBeNull();
    expect(verifyToken(token, 'console', 1_001_001)).toBeNull();
  });

  it('refuses a token whose claims were edited', () => {
    const token = signToken({ k: 'console', sid: 'staff-1', ttlMs: 60_000 });
    const [payload, mac] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));
    claims.sid = 'owner';
    const forged = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${mac}`;
    expect(verifyToken(forged, 'console')).toBeNull();
    expect(verifyToken('staff-1', 'console')).toBeNull();
    expect(verifyToken('', 'console')).toBeNull();
  });
});

describe('attempt limiter', () => {
  it('locks after the budget and releases after the lock', () => {
    const key = `test:${Math.random()}`;
    const now = 5_000_000;
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) expect(recordFailure(key, now)).toEqual({ locked: false, remaining: MAX_ATTEMPTS - i });
    expect(recordFailure(key, now)).toEqual({ locked: true, until: now + LOCK_MS });
    expect(attemptStatus(key, now + 1).locked).toBe(true);
    expect(attemptStatus(key, now + LOCK_MS + 1).locked).toBe(false);
  });

  it('forgets failures outside the window', () => {
    const key = `test:${Math.random()}`;
    recordFailure(key, 0);
    recordFailure(key, 0);
    expect(attemptStatus(key, ATTEMPT_WINDOW_MS + 1)).toEqual({ locked: false, remaining: MAX_ATTEMPTS });
    clearAttempts(key);
  });
});
