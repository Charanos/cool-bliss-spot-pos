import { describe, expect, it } from 'vitest';
import { CEILING_MS, registry } from './registry';

describe('animation registry', () => {
  for (const [name, spec] of Object.entries(registry)) {
    it(`${name} stays inside the ${spec.surface} ceiling`, () => {
      expect(spec.ms).toBeGreaterThan(0);
      expect(spec.ms).toBeLessThanOrEqual(CEILING_MS[spec.surface]);
      expect(spec.ms).toBeLessThanOrEqual(400);
    });
  }

  it('uses only the four named curves', () => {
    const curves = new Set(Object.values(registry).map((s) => s.ease));
    for (const c of curves) expect(['out', 'in', 'inOut', 'snap']).toContain(c);
  });
});
