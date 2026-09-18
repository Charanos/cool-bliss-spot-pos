import { describe, expect, it } from 'vitest';
import * as availability from './availability/service';
import * as catalogue from './catalogue/service';
import * as identity from './identity/service';
import * as inventory from './inventory/service';
import * as settlement from './settlement/service';

/**
 * Contract tests at the module service boundary: what a response physically contains, not what a
 * screen chooses to show.
 */
describe('blind count', () => {
  it('omits expected quantity from every line before review (docs/04 blind count rule)', () => {
    const counting = inventory.counts().find((c) => c.status === 'counting');
    expect(counting).toBeTruthy();
    const view = inventory.countLines(counting!.id);
    expect(view.stage).toBe('blind');
    for (const line of view.lines) {
      expect(Object.keys(line)).not.toContain('expectedQty');
      expect(JSON.stringify(line)).not.toMatch(/expected/i);
    }
  });

  it('includes expected quantity once the count reaches review', () => {
    const review = inventory.counts().find((c) => c.status === 'review');
    const view = inventory.countLines(review!.id);
    expect(view.stage).toBe('review');
    expect(view.lines.every((l) => 'expectedQty' in l)).toBe(true);
  });

  it('keeps expected hidden on a count opened now', () => {
    const actor = identity.currentConsoleActor();
    const bar = inventory.locations().find((l) => l.kind === 'service')!;
    const opened = inventory.openCount({ locationId: bar.id, kind: 'spot', categoryIds: [], notes: null, actor });
    const view = inventory.countLines(opened.id);
    expect(view.stage).toBe('blind');
    expect(JSON.stringify(view)).not.toMatch(/expectedQty/);
    inventory.cancelCount({ countId: opened.id, reason: 'Opened by the contract test only', actor });
  });
});

describe('drawer', () => {
  it('withholds the expected figure from an open drawer session (R7)', () => {
    const open = settlement.drawerSessions().find((s) => s.status !== 'closed');
    if (!open) return;
    const view = settlement.drawerFor(open.businessDate);
    expect(view && 'expectedCashCents' in view).toBe(false);
  });
});

describe('availability', () => {
  it('lets a hold outrank a positive stock figure (R2)', () => {
    const actor = identity.currentConsoleActor();
    const tusker = catalogue.variants().find((v) => v.name === 'Tusker 500ml')!;
    expect(inventory.onHand(tusker.id)).toBeGreaterThan(0);
    const before = availability.evaluate(tusker.id);
    expect(before.state).not.toBe('finished');
    const hold = inventory.placeHold({ variantId: tusker.id, reason: 'Contract test, checking the hold wins', expectedBack: null, actor });
    expect(availability.evaluate(tusker.id)).toMatchObject({ state: 'finished', reason: 'hold' });
    inventory.releaseHold({ holdId: hold.id, note: 'Released by the contract test', actor });
    expect(availability.evaluate(tusker.id).state).toBe(before.state);
  });

  it('stops every serve of a held bottle, including a recipe that uses it', () => {
    const hunters = catalogue.variants().filter((v) => catalogue.productOfVariant(v.id)?.name === 'Hunters Choice');
    for (const v of hunters) expect(availability.evaluate(v.id).reason).toBe('hold');
  });

  it('refuses a hold without a ten character reason', () => {
    const actor = identity.currentConsoleActor();
    const coke = catalogue.variants().find((v) => v.name === 'Coke 300ml')!;
    expect(() => inventory.placeHold({ variantId: coke.id, reason: 'broke', expectedBack: null, actor })).toThrow(/10 characters/);
  });
});
