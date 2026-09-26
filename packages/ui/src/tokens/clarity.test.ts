import { describe, expect, it } from 'vitest';
import { CONTRAST_FLOOR, contrastRatio, separation, weakPanel } from './contrast';
import { clarity, themes } from './tokens';

/**
 * Clarity must read on a screen that washes colour out: every check here runs on colours passed
 * through weakPanel(), a model of a budget TN laptop panel. docs/06, display profiles; docs/11 D-25.
 */
const standard = themes.dark as Record<string, string>;
const clear = { ...standard, ...clarity } as Record<string, string>;
const onPanel = (t: Record<string, string>, fg: string, bg: string) => contrastRatio(weakPanel(t[fg]!), weakPanel(t[bg]!));

const WORKING_SURFACES = ['page', 'sunken', 'card'];
const TEXT = ['ink', 'ink-muted', 'ink-subtle', 'accent-text', 'poured', 'served', 'low', 'stop', 'money'];
const STATUSES = ['poured', 'served', 'low', 'stop', 'accent'];

describe('Clarity on a weak panel', () => {
  for (const fg of TEXT) {
    for (const bg of WORKING_SURFACES) {
      it(`${fg} on ${bg} stays readable body text`, () => {
        expect(onPanel(clear, fg, bg)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body);
      });
    }
    it(`${fg} on raised stays at least large text and icon contrast`, () => {
      expect(onPanel(clear, fg, 'raised')).toBeGreaterThanOrEqual(fg.startsWith('ink') && fg !== 'ink-subtle' ? CONTRAST_FLOOR.body : CONTRAST_FLOOR.large);
    });
  }

  it('keeps the surfaces apart, where the standard dark theme runs them together', () => {
    const steps: [string, string, number][] = [
      ['page', 'sunken', 1.15],
      ['sunken', 'raised', 1.25],
      ['raised', 'rule', 1.3],
      ['page', 'hairline', 2.5],
    ];
    for (const [a, b, floor] of steps) {
      expect(onPanel(clear, a, b), `${a} against ${b}`).toBeGreaterThanOrEqual(floor);
      expect(onPanel(clear, a, b), `${a} against ${b} improves on standard`).toBeGreaterThan(onPanel(standard, a, b));
    }
  });

  it('keeps every status colour distinct from every other once the panel has flattened them', () => {
    for (let i = 0; i < STATUSES.length; i += 1) {
      for (let j = i + 1; j < STATUSES.length; j += 1) {
        const [a, b] = [STATUSES[i]!, STATUSES[j]!];
        expect(separation(weakPanel(clear[a]!), weakPanel(clear[b]!)), `${a} and ${b}`).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it('never makes a rule the same colour as the surface it sits on', () => {
    expect(clear.rule).not.toBe(clear.raised);
    expect(clear.rule).not.toBe(clear.sunken);
  });
});
