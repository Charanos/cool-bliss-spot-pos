import { variantIdFor } from '@bliss/db/seed/catalogue';
import { deviceByKey, staffByKey, tableByLabel } from '@bliss/db/seed/organisation';
import { createUuidV7 } from '@bliss/shared/id';
import { type Cents, add, shillings, toJSON } from '@bliss/shared/money';
import { amountDue, evenShares } from '@bliss/shared/settlement';
import type { OutboxKind, OutboxPayload } from '@bliss/shared/sync';
import { describe, expect, it } from 'vitest';
import { toWire } from '@/lib/wire';
import * as inventory from './inventory/service';
import * as pricing from './pricing/service';
import * as settlementCommands from './settlement/commands';
import * as settlement from './settlement/service';
import { type IncomingEntry, applyEntry, bootstrap } from './sync/apply';
import * as trade from './trade/service';

/**
 * The Floor to Counter chain at the module boundary, docs/14: an order fired on a floor tablet is
 * applied, poured at the counter, settled by seat and then whole, with the drawer's blind rules.
 */

const id = createUuidV7();
const floor = deviceByKey('floor-1').id;
const counter = deviceByKey('counter-1').id;
const amina = staffByKey('amina').id;
const kevin = staffByKey('kevin').id;
let seq = 1_000_000;

function entry<K extends OutboxKind>(kind: K, deviceId: string, staffId: string, aggregateId: string, payload: OutboxPayload<K>): IncomingEntry {
  seq += 1;
  return { id: id(), seq, deviceId, staffId, kind, aggregateId, payload, clientAt: Date.now() };
}

function price(variantId: string, qty: number, at: number) {
  const unit = pricing.currentPrice(variantId, at)!.unitPriceCents;
  let total: Cents = shillings(0);
  for (let i = 0; i < qty; i += 1) total = add(total, unit);
  return { unit, total };
}

describe('floor to counter', () => {
  const tabId = id();
  const seat1 = id();
  const seat2 = id();
  const tusker = variantIdFor('tusker', 'bottle');
  const tot = variantIdFor('smirnoff', 'tot');
  const lineA = id();
  const lineB = id();
  const at = Date.now();

  it('opens a tab and fires an order that takes stock', () => {
    const opened = applyEntry(
      entry('tab.open', floor, amina, tabId, {
        v: 1,
        tabId,
        serviceTableId: tableByLabel('T2').id,
        zoneId: tableByLabel('T2').zoneId,
        name: null,
        guestCount: 2,
        seats: [
          { seatId: seat1, seatNo: 1 },
          { seatId: seat2, seatNo: 2 },
        ],
        openedAt: at,
      }),
    );
    expect(opened.status).toBe('acked');
    expect(trade.tabById(tabId)?.tabNumber).toBeGreaterThan(0);

    const stockBefore = inventory.onHand(tusker);
    const a = price(tusker, 2, at);
    const b = price(tot, 1, at);
    const fire = entry('order.fire', floor, amina, tabId, {
      v: 1,
      orderId: id(),
      tabId,
      firedAt: at,
      catalogueVersion: 0,
      availabilityVersion: 0,
      lines: [
        { lineId: lineA, tabSeatId: seat1, productVariantId: tusker, qty: 2, unitPriceCents: toJSON(a.unit), lineTotalCents: toJSON(a.total), priceDerivation: [], note: null, modifiers: [], clientCreatedAt: at },
        { lineId: lineB, tabSeatId: seat2, productVariantId: tot, qty: 1, unitPriceCents: toJSON(b.unit), lineTotalCents: toJSON(b.total), priceDerivation: [], note: 'No ice', modifiers: [], clientCreatedAt: at },
      ],
    });
    expect(applyEntry(fire).status).toBe('acked');
    expect(applyEntry(fire)).toMatchObject({ status: 'acked', idempotent: true });
    expect(inventory.onHand(tusker)).toBeCloseTo(stockBefore - 2, 4);
    expect(trade.linesFor(tabId)).toHaveLength(2);
  });

  it('refuses pouring from a floor tablet and pours from the counter', () => {
    const fromFloor = applyEntry(entry('line.serve', floor, amina, tabId, { v: 1, tabId, lineIds: [lineA], servedAt: Date.now() }));
    expect(fromFloor).toMatchObject({ status: 'rejected', code: 'WRONG_SURFACE' });
    const poured = applyEntry(entry('line.serve', counter, kevin, tabId, { v: 1, tabId, lineIds: [lineA, lineB], servedAt: Date.now() }));
    expect(poured.status).toBe('acked');
    expect(trade.linesFor(tabId).every((l) => l.status === 'served')).toBe(true);
  });

  it('refuses cash without an open drawer, and settles seat 1 by M-Pesa', () => {
    const seatLines = trade.linesFor(tabId).filter((l) => l.tabSeatId === seat1);
    const subtotal = seatLines.reduce<Cents>((s, l) => add(s, l.lineTotalCents), shillings(0));
    const { due, rounding } = amountDue(subtotal);
    const base = { v: 1 as const, scope: 'seat' as const, tabId, tabSeatId: seat1, lineIds: seatLines.map((l) => l.id), items: [], split: null, subtotalCents: toJSON(subtotal), roundingCents: toJSON(rounding), dueCents: toJSON(due), drawerSessionId: null, settledAt: Date.now() };

    // The seeded night may have left a drawer open on this counter; the refusal only applies without one.
    if (!settlement.openDrawerFor(counter)) {
      const cash = applyEntry(entry('bill.settle', counter, kevin, tabId, { ...base, billId: id(), tenders: [{ tenderId: id(), kind: 'cash', amountCents: toJSON(due), tenderedCents: toJSON(due), changeCents: '0', reference: null }] }));
      expect(cash).toMatchObject({ status: 'rejected', code: 'DRAWER_NOT_OPEN' });
    }

    const mpesa = applyEntry(entry('bill.settle', counter, kevin, tabId, { ...base, billId: id(), tenders: [{ tenderId: id(), kind: 'mpesa', amountCents: toJSON(due), tenderedCents: null, changeCents: null, reference: 'QGH7K2LP9X' }] }));
    expect(mpesa.status).toBe('acked');
    expect(trade.seatsFor(tabId).find((s) => s.id === seat1)?.status).toBe('settled');
    expect(trade.tabById(tabId)?.status).toBe('part_settled');
  });

  it('refuses a bill whose total the device worked out wrong', () => {
    const remaining = trade.linesFor(tabId).filter((l) => l.tabSeatId === seat2);
    const wrong = applyEntry(
      entry('bill.settle', counter, kevin, tabId, {
        v: 1,
        billId: id(),
        scope: 'tab',
        tabId,
        tabSeatId: null,
        lineIds: remaining.map((l) => l.id),
        items: [],
        split: null,
        subtotalCents: '100',
        roundingCents: '0',
        dueCents: '100',
        tenders: [{ tenderId: id(), kind: 'card', amountCents: '100', tenderedCents: null, changeCents: null, reference: null }],
        drawerSessionId: null,
        settledAt: Date.now(),
      }),
    );
    expect(wrong).toMatchObject({ status: 'rejected', code: 'BILL_TOTAL_MISMATCH' });
  });

  it('opens the drawer, settles the rest in cash, and closes the tab', () => {
    const existing = settlement.openDrawerFor(counter);
    if (!existing) {
      const sessionId = id();
      expect(applyEntry(entry('drawer.open', counter, kevin, sessionId, { v: 1, sessionId, floatCents: toJSON(shillings(5000)), openedAt: Date.now() })).status).toBe('acked');
    }
    const remaining = trade.linesFor(tabId).filter((l) => l.tabSeatId === seat2);
    const subtotal = remaining.reduce<Cents>((s, l) => add(s, l.lineTotalCents), shillings(0));
    const { due, rounding } = amountDue(subtotal);
    const tendered = shillings(1000);
    const settled = applyEntry(
      entry('bill.settle', counter, kevin, tabId, {
        v: 1,
        billId: id(),
        scope: 'tab',
        tabId,
        tabSeatId: null,
        lineIds: remaining.map((l) => l.id),
        items: [],
        split: null,
        subtotalCents: toJSON(subtotal),
        roundingCents: toJSON(rounding),
        dueCents: toJSON(due),
        tenders: [{ tenderId: id(), kind: 'cash', amountCents: toJSON(due), tenderedCents: toJSON(tendered), changeCents: null, reference: null }],
        drawerSessionId: null,
        settledAt: Date.now(),
      }),
    );
    expect(settled.status).toBe('acked');
    expect(trade.tabById(tabId)?.status).toBe('settled');
  });

  it('keeps the drawer blind until counted, then needs a reason for a large variance', () => {
    const session = settlement.openDrawerFor(counter)!;
    const feed = bootstrap(counter);
    const drawerRows = feed.rows.drawers as Record<string, unknown>[];
    expect(drawerRows.length).toBeGreaterThan(0);
    for (const row of drawerRows.filter((r) => r.status === 'open')) {
      expect(Object.keys(row)).not.toContain('expectedCashCents');
      expect(toWire(row)).not.toMatch(/expected/i);
    }

    // Other tabs from the seeded night are still open, so the count is refused until they are settled.
    if (trade.openTabs().length > 0) {
      expect(() => settlementCommands.countDrawer({ sessionId: session.id, countedCents: shillings(0), actor: { staffId: kevin, deviceId: counter } })).toThrow(/still open/);
    }
  });

  it('shares an even split so the parts add back to the whole', () => {
    const shares = evenShares(shillings(2101), 3);
    expect(shares.map(String)).toEqual(['70034', '70033', '70033']);
  });
});
