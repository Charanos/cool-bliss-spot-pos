import { deviceByKey } from '@bliss/db/seed/organisation';
import { describe, expect, it } from 'vitest';
import * as identity from './identity/service';

/** A station's pull is its heartbeat: the Console's device list is live, not seeded. docs/16 section 1. */
describe('device presence', () => {
  const deviceId = deviceByKey('floor-2').id;
  const sighting = {
    deviceId,
    staffId: null,
    unsyncedCount: 0,
    appVersion: '0.1.0',
    capabilities: identity.parseCapabilities('{"b":"Safari 15.6","s":"iPadOS 15.8","v":"768×1024","r":2,"g":"srgb","p":"touch","c":2,"m":null,"f":["wakeLock"],"d":["lite"]}'),
  };

  it('reads what a station reports, and nothing malformed', () => {
    expect(sighting.capabilities).toMatchObject({ browser: 'Safari 15.6', system: 'iPadOS 15.8', dpr: 2, failed: ['wakeLock'], display: ['lite'] });
    expect(identity.parseCapabilities('not json')).toBeNull();
    expect(identity.parseCapabilities(null)).toBeNull();
    expect(identity.parseCapabilities('x'.repeat(3000))).toBeNull();
  });

  it('marks a station online when it pulls, and offline once it goes quiet', () => {
    const now = Date.now();
    expect(identity.presenceChanged(sighting, now)).toBe(true);
    identity.notePresence(sighting, now);
    const row = () => identity.devices().find((d) => d.id === deviceId)!;
    expect(row().online).toBe(true);
    expect(row().capabilities?.browser).toBe('Safari 15.6');

    // A pull seconds later with nothing new is not worth a write.
    expect(identity.presenceChanged(sighting, now + 5_000)).toBe(false);
    // Something new, or a sighting grown old, is.
    expect(identity.presenceChanged({ ...sighting, unsyncedCount: 3 }, now + 5_000)).toBe(true);
    expect(identity.presenceChanged(sighting, now + identity.ONLINE_WINDOW_MS)).toBe(true);

    identity.notePresence(sighting, now - identity.ONLINE_WINDOW_MS - 1);
    expect(row().online).toBe(false);
  });
});
