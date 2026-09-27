import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { holdsTable, tabLabel } from '@bliss/shared/trade';
import { describe, expect, it } from 'vitest';
import { type IncomingEntry, applyEntry } from './sync/apply';
import { tradeTables } from './trade/schema';
import * as trade from './trade/service';

/**
 * Walk ups have no table, so they are numbered in their own run for the night: Walk up 1, 2, and on
 * without limit. The server allocates the number, so two tablets opening walk ups at once never
 * share one, and a walk up with a name keeps its number behind the name.
 */

const id = createUuidV7();
const floor = deviceByKey('floor-1').id;
const peter = staffByKey('peter').id;
let seq = 8_000_000;

function entry<K extends OutboxKind>(kind: K, staffId: string, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId: floor, staffId, kind, aggregateId, payload, clientAt: Date.now() };
}

function openWalkUp(name: string | null, at = Date.now()) {
  const tabId = id();
  const zoneId = tradeTables().zones[0]!.id;
  const result = applyEntry(entry('tab.open', peter, tabId, { v: 1, tabId, serviceTableId: null, zoneId, name, guestCount: 1, seats: [{ seatId: id(), seatNo: 1 }], openedAt: at }));
  expect(result.status).toBe('acked');
  return trade.tabById(tabId)!;
}

describe('walk ups', () => {
  it('opens a walk up with no name, and numbers each one after the last', () => {
    const first = openWalkUp(null);
    const date = first.businessDate;
    const before = tradeTables().tabs.filter((t) => t.businessDate === date && t.id !== first.id).reduce((max, t) => Math.max(max, t.walkUpNo ?? 0), 0);
    expect(first.walkUpNo).toBe(before + 1);
    expect(first.name).toBeNull();

    // Many more, with no ceiling: every one gets its own number, in order.
    const more = Array.from({ length: 120 }, () => openWalkUp(null));
    const numbers = more.map((t) => t.walkUpNo);
    expect(new Set(numbers).size).toBe(120);
    expect(numbers).toEqual(numbers.map((_, i) => first.walkUpNo! + i + 1));
    expect(tabLabel(more.at(-1)!)).toBe(`Walk up ${first.walkUpNo! + 120}`);
  });

  it('keeps a name when one is given, with the number still allocated', () => {
    const named = openWalkUp('Birthday');
    expect(named.walkUpNo).toBeGreaterThan(0);
    expect(tabLabel(named)).toBe('Birthday');
  });

  it('gives a tab at a table no walk up number', () => {
    const held = new Set(tradeTables().tabs.filter(holdsTable).map((t) => t.serviceTableId));
    const table = trade.tables().find((t) => !held.has(t.id))!;
    const tabId = id();
    applyEntry(entry('tab.open', peter, tabId, { v: 1, tabId, serviceTableId: table.id, zoneId: table.zoneId, name: null, guestCount: 2, seats: [{ seatId: id(), seatNo: 1 }], openedAt: Date.now() }));
    expect(trade.tabById(tabId)?.walkUpNo ?? null).toBeNull();
  });
});
