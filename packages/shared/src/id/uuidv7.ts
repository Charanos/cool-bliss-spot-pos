/**
 * UUIDv7, per ADR-013. Time ordered, so indexes on tables holding millions of lines keep their
 * locality, and generated on the client so an offline tablet can create a tab before the server
 * has seen it. The id doubles as the idempotency key of the outbox entry that carries it.
 *
 * Layout (RFC 9562):
 *   48 bits  unix epoch milliseconds
 *    4 bits  version 7
 *   12 bits  monotonic counter within the millisecond
 *    2 bits  variant 10
 *   46 bits  random
 *   16 bits  device scope
 *
 * The device scope suffix is what survives a bad clock: two tablets that both think it is 1970
 * still cannot mint the same id, because their last two bytes differ.
 */

export type Uuid = string;

type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

export interface UuidV7Options {
  /** Two bytes that identify the device. Derive them once from the enrolled device id. */
  deviceScope?: Uint8Array;
  now?: () => number;
  random?: RandomFill;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function defaultRandom(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(bytes);
}

/** Derive a stable two byte scope from any string, such as a device id. FNV-1a, folded. */
export function deviceScopeFrom(seed: string): Uint8Array {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const folded = ((hash >>> 16) ^ (hash & 0xffff)) & 0xffff;
  return new Uint8Array([folded >>> 8, folded & 0xff]);
}

export function createUuidV7(options: UuidV7Options = {}): () => Uuid {
  const now = options.now ?? Date.now;
  const random = options.random ?? defaultRandom;
  const scope = options.deviceScope ?? random(new Uint8Array(2));
  if (scope.length !== 2) throw new RangeError('Device scope must be exactly two bytes');

  let lastMs = -1;
  let counter = 0;

  return function next(): Uuid {
    let ms = Math.floor(now());
    if (ms <= lastMs) {
      // Same millisecond, or the clock stepped backwards: stay monotonic.
      ms = lastMs;
      counter += 1;
      if (counter > 0xfff) {
        ms += 1;
        counter = 0;
      }
    } else {
      counter = random(new Uint8Array(2)).reduce((a, b) => (a << 8) | b, 0) & 0x3ff;
    }
    lastMs = ms;

    const bytes = random(new Uint8Array(16));
    // 48 bit timestamp, big endian. Split to stay inside 32 bit bitwise maths.
    const high = Math.floor(ms / 0x10000);
    const low = ms % 0x10000;
    bytes[0] = (high >>> 24) & 0xff;
    bytes[1] = (high >>> 16) & 0xff;
    bytes[2] = (high >>> 8) & 0xff;
    bytes[3] = high & 0xff;
    bytes[4] = (low >>> 8) & 0xff;
    bytes[5] = low & 0xff;
    bytes[6] = 0x70 | ((counter >>> 8) & 0x0f);
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
    bytes[14] = scope[0] ?? 0;
    bytes[15] = scope[1] ?? 0;

    let out = '';
    for (let i = 0; i < 16; i += 1) {
      out += HEX[bytes[i] ?? 0];
      if (i === 3 || i === 5 || i === 7 || i === 9) out += '-';
    }
    return out;
  };
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

/** The millisecond timestamp embedded in a UUIDv7. */
export function uuidV7Time(value: Uuid): number {
  const hex = value.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}
