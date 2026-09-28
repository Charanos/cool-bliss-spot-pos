import { randomBytes, scryptSync } from 'node:crypto';

/**
 * Hashing a PIN for storage, on its own so a command-line script (pnpm db:handover) can hash the
 * owner's PIN without loading the server's session keys. Nothing here is a secret, and node:crypto
 * keeps it off every browser bundle; checking a PIN stays in credentials.ts.
 */

/** A PIN is four to eight digits; the outlet's policy says how many a new one has. */
export const PIN_PATTERN = /^\d{4,8}$/;
export const PIN_HASH_PREFIX = 'scrypt';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

/** Hash a PIN for storage: `scrypt$N$r$p$salt$hash`, salt and hash in base64url. */
export function hashPin(pin: string): string {
  if (!PIN_PATTERN.test(pin)) throw new Error('A PIN is four to eight digits.');
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return [PIN_HASH_PREFIX, SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}
