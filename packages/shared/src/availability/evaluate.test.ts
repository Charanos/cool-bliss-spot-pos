import { describe, expect, it } from 'vitest';
import { depletionFactorFor, evaluateAvailability, servesFromStock } from './evaluate';

const base = { hasActiveHold: false, variantActive: true, categoryActive: true, tracked: true, qtyAvailable: 40, threshold: 6 };

describe('evaluateAvailability', () => {
  it('lets a manual hold outrank a positive stock figure (R2)', () => {
    expect(evaluateAvailability({ ...base, hasActiveHold: true, qtyAvailable: 120 })).toEqual({
      state: 'finished',
      reason: 'hold',
      qtyAvailable: 120,
    });
  });

  it('checks the hold before variant status', () => {
    expect(evaluateAvailability({ ...base, hasActiveHold: true, variantActive: false }).reason).toBe('hold');
  });

  it('shows the count in the attention colour at 4 on hand with a threshold of 6 (R2)', () => {
    expect(evaluateAvailability({ ...base, qtyAvailable: 4 }).state).toBe('low');
  });

  it('is last few at three serves or fewer', () => {
    expect(evaluateAvailability({ ...base, qtyAvailable: 3 }).state).toBe('last_few');
    expect(evaluateAvailability({ ...base, qtyAvailable: 1 }).state).toBe('last_few');
  });

  it('is finished at zero or below', () => {
    expect(evaluateAvailability({ ...base, qtyAvailable: 0 })).toMatchObject({ state: 'finished', reason: 'stock' });
    expect(evaluateAvailability({ ...base, qtyAvailable: -2 })).toMatchObject({ state: 'finished', reason: 'stock' });
  });

  it('never runs out an untracked item, but still honours a hold', () => {
    expect(evaluateAvailability({ ...base, tracked: false, qtyAvailable: 0 }).state).toBe('available');
    expect(evaluateAvailability({ ...base, tracked: false, hasActiveHold: true }).state).toBe('finished');
  });

  it('finishes an item whose category is archived', () => {
    expect(evaluateAvailability({ ...base, categoryActive: false })).toMatchObject({ reason: 'category_status' });
  });
});

describe('servesFromStock', () => {
  it('gets 25 tots from a 750ml bottle (R9)', () => {
    expect(servesFromStock(1, depletionFactorFor(30, 750))).toBe(25);
  });

  it('floors a partial serve', () => {
    expect(servesFromStock(0.13, 0.04)).toBe(3);
  });

  it('models a generous house pour through a larger depletion factor', () => {
    expect(servesFromStock(1, 0.05)).toBe(20);
  });
});
