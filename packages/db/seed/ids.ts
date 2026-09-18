/**
 * Deterministic UUIDv7 shaped ids for seed rows, so a seed is identical on every machine and a link
 * to /console/inventory/stock?variant=... still works after a restart. Real rows use createUuidV7.
 */

function fnv1a(input: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function seedId(key: string): string {
  const bytes = new Uint8Array(16);
  // A fixed epoch in August 2026 plus a spread, so ids sort roughly by key without meaning anything.
  const ms = 1_785_542_400_000 + (fnv1a(key, 7) % 1_000_000_000);
  const high = Math.floor(ms / 0x10000);
  const low = ms % 0x10000;
  bytes[0] = (high >>> 24) & 0xff;
  bytes[1] = (high >>> 16) & 0xff;
  bytes[2] = (high >>> 8) & 0xff;
  bytes[3] = high & 0xff;
  bytes[4] = (low >>> 8) & 0xff;
  bytes[5] = low & 0xff;
  const a = fnv1a(key, 11);
  const b = fnv1a(key, 13);
  const c = fnv1a(key, 17);
  bytes[6] = 0x70 | ((a >>> 24) & 0x0f);
  bytes[7] = (a >>> 16) & 0xff;
  bytes[8] = 0x80 | ((a >>> 8) & 0x3f);
  bytes[9] = a & 0xff;
  bytes[10] = (b >>> 24) & 0xff;
  bytes[11] = (b >>> 16) & 0xff;
  bytes[12] = (b >>> 8) & 0xff;
  bytes[13] = b & 0xff;
  bytes[14] = (c >>> 8) & 0xff;
  bytes[15] = c & 0xff;
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += HEX[bytes[i] ?? 0];
    if (i === 3 || i === 5 || i === 7 || i === 9) out += '-';
  }
  return out;
}

/** A small deterministic PRNG for generated history. mulberry32. */
export function prng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function hashSeed(input: string): number {
  return fnv1a(input, 23);
}
