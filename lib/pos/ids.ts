'use client';

import { createUuidV7, deviceScopeFrom } from '@bliss/shared/id';

let generator: (() => string) | null = null;
let scopedTo: string | null = null;

/** UUIDv7 with this device's scope in the suffix, so ids survive a bad tablet clock. ADR-013. */
export function newId(deviceId: string | null): string {
  if (!generator || (deviceId && scopedTo !== deviceId)) {
    generator = createUuidV7(deviceId ? { deviceScope: deviceScopeFrom(deviceId) } : {});
    scopedTo = deviceId;
  }
  return generator();
}
