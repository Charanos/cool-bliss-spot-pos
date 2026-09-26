import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import { ViewHeader } from '../../_components/workspace';
import { type DeviceTableRow, DevicesTable } from './devices-table';

export const metadata: Metadata = { title: 'Devices' };

const KIND: Record<string, string> = { floor: 'Floor tablet', counter: 'Counter', bar: 'Bar screen', console: 'Console' };

/** X-02: every registered device, whether it is online, and what it is holding that has not been sent. */
export default async function DevicesPage() {
  const actor = await identity.currentConsoleActor();
  const clock = reporting.clock();
  const rows: DeviceTableRow[] = identity.devices().map((d) => ({
    id: d.id,
    label: d.label,
    kind: KIND[d.kind] ?? d.kind,
    kindKey: d.kind,
    status: d.status,
    pairingPending: d.pairingPending,
    online: d.online,
    lastSeenAt: d.lastSeenAt,
    signedIn: d.signedInStaffId ? identity.displayName(d.signedInStaffId) : null,
    unsynced: d.unsyncedCount,
    appVersion: d.appVersion,
    enrolledAt: d.enrolledAt,
    revokedReason: d.revokedReason,
  }));
  const latest = rows.map((r) => r.appVersion).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? '';
  return (
    <>
      <ViewHeader page="/console/settings/devices" />
      <DevicesTable rows={rows} now={clock.now} latestVersion={latest} timezone={identity.outlet().timezone} canManage={identity.can(actor.staffId, 'device.manage')} />
    </>
  );
}
