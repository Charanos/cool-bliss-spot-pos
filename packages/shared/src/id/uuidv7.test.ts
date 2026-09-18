import { describe, expect, it } from 'vitest';
import { createUuidV7, deviceScopeFrom, isUuidV7, uuidV7Time } from './uuidv7';

describe('uuidv7', () => {
  it('produces RFC 9562 version 7 ids', () => {
    const next = createUuidV7();
    for (let i = 0; i < 1000; i += 1) expect(isUuidV7(next())).toBe(true);
  });

  it('embeds the millisecond timestamp', () => {
    const at = Date.UTC(2026, 8, 6, 19, 41, 7, 123);
    const next = createUuidV7({ now: () => at });
    expect(uuidV7Time(next())).toBe(at);
  });

  it('is strictly increasing within one millisecond and across a backwards clock step', () => {
    let clock = 1_789_000_000_000;
    const next = createUuidV7({ now: () => clock });
    const ids: string[] = [];
    for (let i = 0; i < 5000; i += 1) ids.push(next());
    clock -= 60_000; // the tablet clock jumps back a minute
    for (let i = 0; i < 100; i += 1) ids.push(next());
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries the device scope in the last two bytes', () => {
    const scope = deviceScopeFrom('floor-3');
    const next = createUuidV7({ deviceScope: scope });
    const id = next();
    const suffix = id.slice(-4);
    expect(suffix).toBe(Array.from(scope, (b) => b.toString(16).padStart(2, '0')).join(''));
  });

  it('keeps two devices with the same broken clock apart', () => {
    const frozen = () => 0;
    const a = createUuidV7({ now: frozen, deviceScope: deviceScopeFrom('floor-1'), random: (b) => b.fill(7) });
    const b = createUuidV7({ now: frozen, deviceScope: deviceScopeFrom('floor-2'), random: (b) => b.fill(7) });
    expect(a()).not.toBe(b());
  });
});
