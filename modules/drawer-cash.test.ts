import { deviceByKey, staffByKey } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { add, shillings, subtract, toJSON } from '@bliss/shared/money';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { describe, expect, it } from 'vitest';
import * as settlement from './settlement/service';
import { type IncomingEntry, applyEntry } from './sync/apply';

/**
 * Cash in and out of a drawer, other than sales: put in, paid out for the business, to the safe.
 * Each is recorded with its kind and reason, and what the drawer should hold at close allows for it.
 */
const id = createUuidV7();
const counter = deviceByKey('counter-1').id;
const kevin = staffByKey('kevin').id;
let seq = 8_000_000;

function entry<K extends OutboxKind>(kind: K, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId: counter, staffId: kevin, kind, aggregateId, payload, clientAt: Date.now() };
}

describe('drawer cash in and out', () => {
  it('records each kind and counts it in what the drawer should hold', () => {
    let session = settlement.openDrawerFor(counter);
    if (!session) {
      const sessionId = id();
      expect(applyEntry(entry('drawer.open', sessionId, { v: 1, sessionId, floatCents: toJSON(shillings(5000)), openedAt: Date.now() })).status).toBe('acked');
      session = settlement.openDrawerFor(counter)!;
    }
    const before = settlement.expectedCashFor(session);
    const move = (kind: 'paid_in' | 'paid_out' | 'drop_to_safe' | undefined, amount: number, reason: string) =>
      applyEntry(entry('drawer.drop', session.id, { v: 1, movementId: id(), sessionId: session.id, ...(kind ? { kind } : {}), amountCents: toJSON(shillings(amount)), reason, at: Date.now() })).status;

    expect(move('paid_in', 1000, 'Change from the safe')).toBe('acked');
    expect(move('paid_out', 300, 'Ice for the bar tonight')).toBe('acked');
    expect(move('drop_to_safe', 2000, 'To the safe, drawer heavy')).toBe('acked');
    // An entry queued before kinds existed is a drop to the safe.
    expect(move(undefined, 500, 'To the safe, older tablet')).toBe('acked');

    const expected = subtract(add(before, shillings(1000)), shillings(300 + 2000 + 500));
    expect(settlement.expectedCashFor(session)).toBe(expected);

    const kinds = settlement.drawerProjection(session).drops.slice(-4).map((d) => d.kind);
    expect(kinds).toEqual(['paid_in', 'paid_out', 'drop_to_safe', 'drop_to_safe']);
  });

  it('refuses cash out with no amount', () => {
    const session = settlement.openDrawerFor(counter)!;
    const result = applyEntry(entry('drawer.drop', session.id, { v: 1, movementId: id(), sessionId: session.id, kind: 'paid_out', amountCents: toJSON(shillings(0)), reason: 'Nothing at all here', at: Date.now() }));
    expect(result.status).toBe('rejected');
  });
});
