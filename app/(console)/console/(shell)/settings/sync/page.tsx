import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
import { type DeadLetterRow, SyncView } from './sync-view';

export const metadata: Metadata = { title: 'Sync' };

const KIND: Record<string, string> = {
  'order.fire': 'Fired order',
  'line.move': 'Line moved to a seat',
  'line.void': 'Voided line',
  'line.note': 'Line note',
  'seat.add': 'Seat added',
  'seat.label': 'Seat label',
  'seat.remove': 'Seat removed',
  'tab.open': 'Tab opened',
  'tab.move': 'Tab moved',
  'tab.handover': 'Tab handed over',
};

const CODE: Record<string, string> = {
  SEAT_ALREADY_SETTLED: 'The seat was settled first',
  SEAT_HAS_LINES: 'The seat still had lines',
  TAB_CLOSED: 'The tab was already closed',
  STALE_CATALOGUE: 'The item changed while offline',
};

/**
 * Dead letters, docs/04: what a tablet could not send and the server would not accept. Nothing is
 * dropped silently. Each one stays here until a person writes down what was done about it.
 */
export default async function SyncPage() {
  const tz = identity.outlet().timezone;
  const devices = identity.devices();
  const actor = await identity.currentConsoleActor();
  const rows: DeadLetterRow[] = sync.deadLetters().map((d) => {
    const payload = (d.payload ?? {}) as { tab?: string; lines?: number };
    return {
      id: d.id,
      device: devices.find((x) => x.id === d.deviceId)?.label ?? 'A device',
      kind: KIND[d.kind] ?? d.kind,
      what: [payload.tab ? `table ${payload.tab}` : null, payload.lines ? `${payload.lines} lines` : null].filter(Boolean).join(', '),
      code: CODE[d.rejectionCode] ?? d.rejectionCode,
      detail: d.rejectionDetail,
      firstSeenAt: d.firstSeenAt,
      resolvedAt: d.resolvedAt,
      resolvedBy: d.resolvedBy ? identity.displayName(d.resolvedBy) : null,
      note: d.resolutionNote,
    };
  });
  return <SyncView rows={rows} timezone={tz} canResolve={identity.can(actor.staffId, 'device.manage')} />;
}
