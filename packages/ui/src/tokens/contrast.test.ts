import { describe, expect, it } from 'vitest';
import { CONTRAST_FLOOR, contrastRatio } from './contrast';
import { contrastPairs } from './tokens';

/** Pairs that are deliberately below the floor, with the reason written into the token file. */
const EXEMPT = new Set(['dark disabled on page', 'dark hairline on page']);

describe('token contrast', () => {
  for (const pair of contrastPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);

    it(`${pair.name} measures ${ratio.toFixed(2)}:1`, () => {
      // The comment in the token file must be the measured value, not an assumed one.
      expect(Math.abs(ratio - pair.measured)).toBeLessThan(0.06);
      if (!EXEMPT.has(pair.name)) {
        expect(ratio).toBeGreaterThanOrEqual(CONTRAST_FLOOR[pair.use]);
      }
    });
  }
});
