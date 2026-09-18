import type { Cents } from '@bliss/shared/money';

/**
 * JSON carries money as a string, to survive JavaScript's 53 bit limit. ADR-009.
 * Every money field in the domain ends in `Cents`, so the reviver restores exactly those.
 */

export function toWire(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
}

const INTEGER = /^-?\d+$/;

export function fromWire<T>(text: string): T {
  return JSON.parse(text, (key, v) => {
    if (typeof v === 'string' && /Cents$/.test(key) && INTEGER.test(v)) return BigInt(v) as Cents;
    return v;
  }) as T;
}

export function wireResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(toWire(value), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...init.headers },
  });
}
