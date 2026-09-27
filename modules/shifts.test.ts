import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { holdsTable } from '@bliss/shared/trade';
import { describe, expect, it } from 'vitest';
import { type IncomingEntry, applyEntry } from './sync/apply';
import { tradeTables } from './trade/schema';
import * as trade from './trade/service';
import * as shifts from './trade/shifts';

/**
 * Shifts are recorded by what people do on the stations: signing in starts one (or joins the one
 * running), signing out ends it, and tables handed over count on the shift of whoever gave them.
 * A running shift's figures are worked out as it is read; an ended one keeps its own.
 */

const id = createUuidV7();
const floor = deviceByKey('floor-1').id;
const peter = staffByKey('peter').id;
const amina = staffByKey('amina').id;
let seq = 7_000_000;

function entry<K extends OutboxKind>(kind: K, deviceId: string, staffId: string, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId, staffId, kind, aggregateId, payload, clientAt: Date.now() };
}

function freeTable() {
  const held = new Set(tradeTables().tabs.filter(holdsTable).map((t) => t.serviceTableId));
  const table = trade.tables().find((t) => !held.has(t.id));
  if (!table) throw new Error('The seed has no free table left.');
  return table;
}

describe('shifts', () => {
  // Start clean: whatever the seeded night left running for Peter is ended first.
  shifts.endShift({ staffId: peter, deviceId: floor });
  const signedIn = Date.now() - 1000;

  it('starts a shift when someone signs in, and joins it when they sign in again', () => {
    const first = shifts.startShift({ staffId: peter, roleKey: 'waiter', deviceId: floor, at: signedIn });
    const again = shifts.startShift({ staffId: peter, roleKey: 'waiter', deviceId: floor });
    expect(again.id).toBe(first.id);
    expect(first.status).toBe('open');
    expect(trade.shiftById(first.id)?.tabsOpened).toBe(0);
  });

  it('counts the tabs a running shift opens as it goes, and the tables it hands over', () => {
    const table = freeTable();
    const tabId = id();
    const opened = applyEntry(
      entry('tab.open', floor, peter, tabId, { v: 1, tabId, serviceTableId: table.id, zoneId: table.zoneId, name: null, guestCount: 2, seats: [{ seatId: id(), seatNo: 1 }], openedAt: Date.now() }),
    );
    expect(opened.status).toBe('acked');
    const runningId = tradeTables().shifts.find((s) => s.staffId === peter && s.status === 'open')!.id;
    const running = trade.shiftById(runningId)!;
    expect(running.tabsOpened).toBe(1);

    const handed = applyEntry(entry('tab.handover', floor, peter, tabId, { v: 1, tabIds: [tabId], toStaffId: amina }));
    expect(handed.status).toBe('acked');
    const after = trade.shiftById(running.id)!;
    expect(after.tabsHandedOver).toBe(1);
    expect(after.handoverTo).toBe(amina);
  });

  it('ends the shift on sign out and keeps its figures as they stood', () => {
    const ended = shifts.endShift({ staffId: peter, deviceId: floor })!;
    expect(ended.status).toBe('closed');
    expect(ended.endedAt).not.toBeNull();
    expect(ended.tabsOpened).toBe(1);
    expect(shifts.endShift({ staffId: peter, deviceId: floor })).toBeNull();

    // Signing in again the same night starts a new shift rather than reopening the ended one.
    const next = shifts.startShift({ staffId: peter, roleKey: 'waiter', deviceId: floor });
    expect(next.id).not.toBe(ended.id);
    shifts.endShift({ staffId: peter, deviceId: floor });
  });
});
