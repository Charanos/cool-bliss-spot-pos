import { businessDate } from '@bliss/shared/time';
import { stationAuth } from '@/lib/station';
import { wireResponse } from '@/lib/wire';
import { dataset } from '@/modules/_data/source';
import { fresh } from '@/modules/_data/store';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import { bootstrap, changesSince, deviceDrawers } from '@/modules/sync/apply';
import * as trade from '@/modules/trade/service';

export const dynamic = 'force-dynamic';

/** A station token older than this is renewed on the next pull, so a tablet in daily use never lapses. */
const RENEW_AFTER_MS = 24 * 60 * 60_000;

/**
 * Station pull, docs/14 section 4. Pull before push, always.
 *
 *  - Catalogue and availability travel whole, only when the device is behind. They are what a
 *    sign-in screen needs, so they travel without a station token; no PIN, hash or contact does.
 *  - Trade rows travel as changes since the device's cursor, and only to a device that carries a
 *    valid station token for itself. Without one the reply says so, and the device asks for a PIN.
 *  - A device on another epoch, or with no cursor, receives a bootstrap and is told to reset.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const knownCatalogue = Number(url.searchParams.get('catalogue') ?? -1);
  const knownAvailability = Number(url.searchParams.get('availability') ?? -1);
  const since = Number(url.searchParams.get('since') ?? -1);
  const epoch = url.searchParams.get('epoch');
  const deviceId = url.searchParams.get('device');

  await fresh();
  const data = dataset();
  const outlet = identity.outlet();
  const map = availability.map();
  const catalogueVersion = catalogue.version();
  const reset = epoch !== data.epoch;

  const body: Record<string, unknown> = {
    epoch: data.epoch,
    reset,
    outlet: { id: outlet.id, name: outlet.name, timezone: outlet.timezone, cutover: outlet.businessDayCutover, drawerVarianceThresholdCents: outlet.drawerVarianceThresholdCents },
    businessDate: businessDate(Date.now(), outlet.timezone, outlet.businessDayCutover),
    catalogueVersion,
    availabilityVersion: map.version,
    serverTime: Date.now(),
  };

  if (reset || knownCatalogue !== catalogueVersion) {
    body.catalogue = catalogue.snapshot();
    body.pricing = pricing.snapshot();
    body.recipes = inventory.recipes();
    body.zones = trade.zones();
    body.tables = trade.tables();
    body.staff = identity
      .staffList()
      .filter((s) => s.employmentStatus === 'active')
      .map((s) => {
        const role = identity.roleFor(s.id);
        return { id: s.id, displayName: s.displayName, roleKey: role?.key ?? 'waiter', permissions: role?.permissions ?? [], colourIndex: s.colourIndex, pinLength: s.pinLength ?? 6 };
      });
    body.devices = identity.devices().map((d) => ({ id: d.id, label: d.label, kind: d.kind, status: d.status, pairing: d.pairingPending }));
  }

  if (reset || knownAvailability !== map.version) body.availability = map.entries;

  const auth = deviceId ? stationAuth(request, deviceId) : null;
  if (!auth?.ok) {
    body.authRequired = true;
    return wireResponse(body);
  }
  if (Date.now() - auth.issuedAt > RENEW_AFTER_MS) body.stationToken = identity.issueStationToken(auth.staff.id, auth.device.id);

  const feed = reset || since < 0 ? bootstrap(deviceId) : changesSince(since, deviceId);
  body.cursor = feed.cursor;
  body.trade = feed.rows;
  // The device's own drawer rides on every pull, deduped against whatever the feed already carries.
  if (deviceId) {
    const known = new Set((feed.rows.drawers as { id: string }[]).map((r) => r.id));
    for (const row of deviceDrawers(deviceId) as { id: string }[]) if (!known.has(row.id)) (feed.rows.drawers as unknown[]).push(row);
  }
  body.full = reset || since < 0;

  return wireResponse(body);
}
