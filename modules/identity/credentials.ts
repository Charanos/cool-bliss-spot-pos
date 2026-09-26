import 'server-only';

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Credentials: PIN hashes, signed tokens and the attempt limiter. Everything here runs on the server
 * and uses node:crypto only, so no secret, hash or comparison ever reaches a browser bundle.
 */

/* ------------------------------------------------------------------ secret */

// Held on globalThis, like the attempt store: a server can load this module more than once (server
// actions and page renders), and a per-process key must be the same key in every copy.
const holder = globalThis as unknown as { __blissSessionSecret?: Buffer | null };

/**
 * The signing key. BLISS_SESSION_SECRET is the configured value. Without it, a deployment that has a
 * database derives a stable key from DATABASE_URL (itself a secret, and identical on every instance),
 * so sessions survive a restart and work across instances. Development falls back to a fixed key.
 */
function secret(): Buffer {
  if (holder.__blissSessionSecret) return holder.__blissSessionSecret;
  let cachedSecret: Buffer;
  const configured = process.env.BLISS_SESSION_SECRET;
  if (configured && configured.length >= 32) {
    cachedSecret = Buffer.from(configured, 'utf8');
  } else if (process.env.DATABASE_URL) {
    cachedSecret = createHmac('sha256', 'bliss-session-key-v1').update(process.env.DATABASE_URL).digest();
  } else if (process.env.NODE_ENV === 'production') {
    // One process, no database: a per-process key. Sessions end on restart, which is the safe failure.
    cachedSecret = randomBytes(32);
  } else {
    cachedSecret = Buffer.from('bliss-development-session-key-not-for-production', 'utf8');
  }
  holder.__blissSessionSecret = cachedSecret;
  return cachedSecret;
}

/** Test seam: forget the cached key so a changed environment is read again. */
export function resetSecretForTests() {
  holder.__blissSessionSecret = null;
}

/* -------------------------------------------------------------------- PINs */

/** A PIN is four to eight digits; the outlet's policy says how many a new one has. */
export const PIN_PATTERN = /^\d{4,8}$/;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;
const PREFIX = 'scrypt';

/** Hash a PIN for storage: `scrypt$N$r$p$salt$hash`, salt and hash in base64url. */
export function hashPin(pin: string): string {
  if (!PIN_PATTERN.test(pin)) throw new Error('A PIN is four to eight digits.');
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return [PREFIX, SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export function isHashedPin(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`);
}

/**
 * Check a PIN against what is stored. A stored value that is not a hash is a legacy plaintext PIN
 * (written before hashing existed); it is compared in constant time, and the caller should replace it
 * with a hash on success.
 */
export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !PIN_PATTERN.test(pin)) return false;
  if (!isHashedPin(stored)) return safeEqual(sha(pin), sha(stored));
  const [, n, r, p, salt, hash] = stored.split('$');
  if (!n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(pin, Buffer.from(salt, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return safeEqual(actual, expected);
}

function sha(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ tokens */

export type TokenKind = 'console' | 'station' | 'approval' | 'pin_change';

export interface TokenClaims {
  /** What the token is for. A token of one kind is never accepted as another. */
  k: TokenKind;
  /** The staff member it speaks for. */
  sid: string;
  /** Issued at, epoch milliseconds. */
  iat: number;
  /** Expires at, epoch milliseconds. */
  exp: number;
  /** The bound device, for station tokens. */
  did?: string;
  /** The permission approved, for approval tokens. */
  perm?: string;
  /** The person's PIN version when it was signed: a later PIN change ends it. */
  pv?: number;
}

/** A compact signed token: base64url(JSON claims) + '.' + base64url(HMAC-SHA256). */
export function signToken(claims: Omit<TokenClaims, 'iat' | 'exp'> & { ttlMs: number }, now = Date.now()): string {
  const { ttlMs, ...rest } = claims;
  const body: TokenClaims = { ...rest, iat: now, exp: now + ttlMs };
  const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  return `${payload}.${mac(payload)}`;
}

/** The claims of a valid, unexpired token of the given kind, or null. Never throws. */
export function verifyToken(token: string | null | undefined, kind: TokenKind, now = Date.now()): TokenClaims | null {
  if (!token || token.length > 2048) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(Buffer.from(signature, 'utf8'), Buffer.from(mac(payload), 'utf8'))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
    if (claims.k !== kind || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') return null;
    if (claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

function mac(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/* ----------------------------------------------------------------- limiter */

interface AttemptState {
  failures: number;
  lockedUntil: number;
  windowStart: number;
}

const store = (globalThis as unknown as { __blissAttempts?: Map<string, AttemptState> }).__blissAttempts ?? new Map<string, AttemptState>();
(globalThis as unknown as { __blissAttempts?: Map<string, AttemptState> }).__blissAttempts = store;

export const MAX_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 5 * 60_000;
export const LOCK_MS = 15 * 60_000;

export type AttemptCheck = { locked: false; remaining: number } | { locked: true; until: number };

/** Whether a key (a person, or an address) may try again. */
export function attemptStatus(key: string, now = Date.now(), max = MAX_ATTEMPTS): AttemptCheck {
  const state = store.get(key);
  if (!state) return { locked: false, remaining: max };
  if (state.lockedUntil > now) return { locked: true, until: state.lockedUntil };
  if (now - state.windowStart > ATTEMPT_WINDOW_MS) {
    store.delete(key);
    return { locked: false, remaining: max };
  }
  return { locked: false, remaining: Math.max(0, max - state.failures) };
}

/** Record a failure. Returns the new status: locked once the budget in the window is spent. */
export function recordFailure(key: string, now = Date.now(), max = MAX_ATTEMPTS): AttemptCheck {
  const current = store.get(key);
  const state: AttemptState = current && now - current.windowStart <= ATTEMPT_WINDOW_MS && current.lockedUntil <= now ? current : { failures: 0, lockedUntil: 0, windowStart: now };
  state.failures += 1;
  if (state.failures >= max) {
    state.lockedUntil = now + LOCK_MS;
    state.failures = 0;
    state.windowStart = now;
    store.set(key, state);
    return { locked: true, until: state.lockedUntil };
  }
  store.set(key, state);
  return { locked: false, remaining: max - state.failures };
}

export function clearAttempts(key: string) {
  store.delete(key);
}

/** Lift a lock early, for the Console's unlock action. */
export function unlock(key: string) {
  store.delete(key);
}
