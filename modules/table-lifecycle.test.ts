import { variantIdFor } from '@bliss/db/seed/catalogue';
import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, ZERO, add, shillings, toJSON } from '@bliss/shared/money';
import { amountDue } from '@bliss/shared/settlement';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { holdsTable, isSeated } from '@bliss/shared/trade';
import { describe, expect, it } from 'vitest';
import { dataset } from './_data/source';
import { history } from './history/service';
import * as pricing from './pricing/service';
import * as settlement from './settlement/service';
import { type IncomingEntry, applyEntry } from './sync/apply';
import { tradeTables } from './trade/schema';
import * as trade from './trade/service';

/**
 * A table from sitting down to walking out, docs/16 section 8, and the history that records it,
 * section 9: paid is not the same as gone, a cleared table can be taken back until new guests sit
 * at it, an empty tab closes only with a reason, and the blind count holds in history too.
 */

const id = createUuidV7();
const floor = deviceByKey('floor-1').id;
const counter = deviceByKey('counter-1').id;
const amina = staffByKey('amina').id;
const kevin = staffByKey('kevin').id;
let seq = 5_000_000;

function entry<K extends OutboxKind>(kind: K, deviceId: string, staffId: string, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId, staffId, kind, aggregateId, payload, clientAt: Date.now() };
}

/** A table nobody is sitting at, so the test never collides with the seeded night. */
function freeTable(except: readonly string[] = []) {
  const held = new Set(tradeTables().tabs.filter(holdsTable).map((t) => t.serviceTableId));
  const table = trade.tables().find((t) => !held.has(t.id) && !except.includes(t.id));
  if (!table) throw new Error('The seed has no free table left.');
  return table;
}

function open(tableId: string, zoneId: string) {
  const tabId = id();
  const seatId = id();
  const result = applyEntry(
    entry('tab.open', floor, amina, tabId, { v: 1, tabId, serviceTableId: tableId, zoneId, name: null, guestCount: 2, seats: [{ seatId, seatNo: 1 }], openedAt: Date.now() }),
  );
  expect(result.status).toBe('acked');
  return { tabId, seatId };
}

function tonight(askingDevice?: string) {
  const current = dataset().currentBusinessDate;
  return history({ from: current, to: current, askingDevice: askingDevice ?? null });
}

describe('the table lifecycle', () => {
  const table = freeTable();
  const { tabId, seatId } = open(table.id, table.zoneId);
  const orderId = id();
  const lineId = id();
  const tusker = variantIdFor('tusker', 'bottle');

  it('fires, pours and marks the round as at the table, and takes the mark back', () => {
    const at = Date.now();
    const unit = pricing.currentPrice(tusker, at)!.unitPriceCents;
    const fired = applyEntry(
      entry('order.fire', floor, amina, tabId, {
        v: 1,
        orderId,
        tabId,
        firedAt: at,
        catalogueVersion: 0,
        availabilityVersion: 0,
        lines: [{ lineId, tabSeatId: seatId, productVariantId: tusker, qty: 1, unitPriceCents: toJSON(unit), lineTotalCents: toJSON(unit), priceDerivation: [], note: null, modifiers: [], clientCreatedAt: at }],
      }),
    );
    expect(fired.status).toBe('acked');
    expect(applyEntry(entry('line.serve', counter, kevin, tabId, { v: 1, tabId, lineIds: [lineId], servedAt: Date.now() })).status).toBe('acked');

    const delivered = applyEntry(entry('order.deliver', floor, amina, orderId, { v: 1, orderId, tabId, at: Date.now(), undo: false }));
    expect(delivered.status).toBe('acked');
    expect(trade.ordersFor(tabId).find((o) => o.id === orderId)?.deliveredAt).toBeTypeOf('number');

    expect(applyEntry(entry('order.deliver', floor, amina, orderId, { v: 1, orderId, tabId, at: Date.now(), undo: true })).status).toBe('acked');
    expect(trade.ordersFor(tabId).find((o) => o.id === orderId)?.deliveredAt ?? null).toBeNull();
  });

  it('asks for the bill, ignores the same ask twice, and takes it back', () => {
    const ask = () => applyEntry(entry('tab.bill', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: false }));
    expect(ask().status).toBe('acked');
    const first = trade.tabById(tabId)?.billAskedAt;
    expect(first).toBeTypeOf('number');
    expect(ask().status).toBe('acked');
    expect(trade.tabById(tabId)?.billAskedAt).toBe(first);
    expect(trade.tabById(tabId)?.billAskedBy).toBe(amina);

    expect(applyEntry(entry('tab.bill', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: true })).status).toBe('acked');
    expect(trade.tabById(tabId)?.billAskedAt ?? null).toBeNull();
  });

  it('refuses to clear a table that still has something to pay', () => {
    const early = applyEntry(entry('tab.clear', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: false, reason: null }));
    expect(early).toMatchObject({ status: 'rejected', code: 'TAB_NOT_SETTLED' });
  });

  it('keeps a paid tab on its table until the guests leave', () => {
    const lines = trade.linesFor(tabId);
    const subtotal = lines.reduce<Cents>((s, l) => add(s, l.lineTotalCents), ZERO);
    const { due, rounding } = amountDue(subtotal);
    const settled = applyEntry(
      entry('bill.settle', counter, kevin, tabId, {
        v: 1,
        billId: id(),
        scope: 'tab',
        tabId,
        tabSeatId: null,
        lineIds: lines.map((l) => l.id),
        items: [],
        split: null,
        subtotalCents: toJSON(subtotal),
        roundingCents: toJSON(rounding),
        dueCents: toJSON(due),
        tenders: [{ tenderId: id(), kind: 'mpesa', amountCents: toJSON(due), tenderedCents: null, changeCents: null, reference: 'QLC4TEST01' }],
        drawerSessionId: null,
        settledAt: Date.now(),
      }),
    );
    expect(settled.status).toBe('acked');
    const tab = trade.tabById(tabId)!;
    expect(tab.status).toBe('settled');
    expect(tab.clearedAt).toBeNull();
    expect(isSeated(tab)).toBe(true);
    expect(trade.seatedTabs().some((t) => t.id === tabId)).toBe(true);
    expect(tonight().days.flatMap((d) => d.tabs).find((t) => t.id === tabId)?.state).toBe('seated');
  });

  it('refuses a bill request on a tab that is already paid', () => {
    const late = applyEntry(entry('tab.bill', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: false }));
    expect(late).toMatchObject({ status: 'rejected', code: 'TAB_ALREADY_SETTLED' });
  });

  it('clears the table, and takes the clear back', () => {
    expect(applyEntry(entry('tab.clear', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: false, reason: null })).status).toBe('acked');
    expect(trade.tabById(tabId)?.clearedAt).toBeTypeOf('number');
    expect(trade.seatedTabs().some((t) => t.id === tabId)).toBe(false);
    const record = tonight().days.flatMap((d) => d.tabs).find((t) => t.id === tabId);
    expect(record?.state).toBe('cleared');
    expect(record?.lines[0]?.status).toBe('served');

    expect(applyEntry(entry('tab.clear', counter, kevin, tabId, { v: 1, tabId, at: Date.now(), undo: true, reason: null })).status).toBe('acked');
    expect(isSeated(trade.tabById(tabId)!)).toBe(true);
  });

  it('clears the old tab when new guests sit down, and then will not take it back', () => {
    const next = open(table.id, table.zoneId);
    expect(trade.tabById(tabId)?.clearedAt).toBeTypeOf('number');
    expect(trade.tabById(next.tabId)?.status).toBe('open');

    const undo = applyEntry(entry('tab.clear', floor, amina, tabId, { v: 1, tabId, at: Date.now(), undo: true, reason: null }));
    expect(undo).toMatchObject({ status: 'rejected', code: 'TABLE_TAKEN' });
  });

  it('closes an empty tab only with a reason, and records it', () => {
    const other = freeTable([table.id]);
    const empty = open(other.id, other.zoneId);
    const bare = applyEntry(entry('tab.clear', floor, amina, empty.tabId, { v: 1, tabId: empty.tabId, at: Date.now(), undo: false, reason: null }));
    expect(bare).toMatchObject({ status: 'rejected', code: 'VALIDATION_FAILED' });

    const closed = applyEntry(entry('tab.clear', floor, amina, empty.tabId, { v: 1, tabId: empty.tabId, at: Date.now(), undo: false, reason: 'Guests left before ordering' }));
    expect(closed.status).toBe('acked');
    expect(trade.tabById(empty.tabId)?.status).toBe('voided');
    expect(holdsTable(trade.tabById(empty.tabId)!)).toBe(false);
    expect(tonight().days.flatMap((d) => d.tabs).find((t) => t.id === empty.tabId)?.state).toBe('voided');
  });
});

describe('history and the blind count', () => {
  it('keeps tonight’s takings back from a counter with its drawer open', () => {
    if (!settlement.openDrawerFor(counter)) {
      const sessionId = id();
      expect(applyEntry(entry('drawer.open', counter, kevin, sessionId, { v: 1, sessionId, floatCents: toJSON(shillings(5000)), openedAt: Date.now() })).status).toBe('acked');
    }
    const blind = tonight(counter);
    expect(blind.summary.withheld).toBe(true);
    expect(blind.summary.takingsCents).toBeNull();
    expect(blind.summary.byTender).toBeNull();
    const tonightBills = blind.days.filter((d) => d.businessDate === blind.currentBusinessDate).flatMap((d) => [...d.tabs.flatMap((t) => t.bills), ...d.sales.map((s) => s.bill)]);
    expect(tonightBills.length).toBeGreaterThan(0);
    expect(tonightBills.every((b) => b.tenders.every((t) => t.amountCents === null))).toBe(true);

    const open = tonight();
    expect(open.summary.withheld).toBe(false);
    expect(open.summary.takingsCents).not.toBeNull();
  });

  it('shows past nights in full to the same counter', () => {
    const current = dataset().currentBusinessDate;
    const all = history({ from: '2000-01-01', to: current, askingDevice: counter });
    const past = all.days.filter((d) => d.businessDate < current).flatMap((d) => d.tabs.flatMap((t) => t.bills));
    if (past.length > 0) expect(past.some((b) => b.tenders.some((t) => t.amountCents !== null))).toBe(true);
    expect(all.from >= '2000-01-01').toBe(true);
  });

  it('holds a range to 93 days and never runs past tonight', () => {
    const current = dataset().currentBusinessDate;
    const r = history({ from: '2000-01-01', to: '2999-12-31' });
    expect(r.to).toBe(current);
    const days = Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;
    expect(days).toBe(93);
  });
});
