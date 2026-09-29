import { describe, expect, it } from 'vitest';
import { haystack, normalise, score } from './search-match';

const q = (text: string) => normalise(text).split(' ').filter(Boolean);
const fit = (query: string, ...fields: string[]) => score(q(query), haystack(...fields));

describe('station search matching', () => {
  it('ignores case, accents and apostrophes', () => {
    expect(normalise("Jack Daniel's 750ml")).toBe('jack daniels 750ml');
    expect(normalise('Café  Rosé')).toBe('cafe rose');
  });

  it('needs every word, in any order', () => {
    expect(fit('daniels 750', "Jack Daniel's 750ml")).toBeGreaterThan(0);
    expect(fit('750 jack', "Jack Daniel's 750ml")).toBeGreaterThan(0);
    expect(fit('jack 375', "Jack Daniel's 750ml")).toBe(0);
  });

  it('finds a word by its start, and figures with or without a space', () => {
    expect(fit('lag', 'Tusker Lager', 'Beers')).toBeGreaterThan(0);
    expect(fit('250 ml', 'KC 250ml')).toBeGreaterThan(0);
    expect(fit('250ml', 'KC 250 ml')).toBeGreaterThan(0);
  });

  it('ranks a whole word above a start, and a start above the middle', () => {
    expect(fit('tusker', 'Tusker Lager')).toBeGreaterThan(fit('tusk', 'Tusker Lager'));
    expect(fit('tusk', 'Tusker Lager')).toBeGreaterThan(fit('sker', 'Tusker Lager'));
  });

  it('forgives one slip in a word long enough to bear it', () => {
    expect(fit('guiness', 'Guinness 500ml')).toBeGreaterThan(0);
    expect(fit('tusekr', 'Tusker Lager')).toBeGreaterThan(0);
    expect(fit('heinken', 'Heineken 330ml')).toBeGreaterThan(0);
    // Too short to guess, and too far off.
    expect(fit('ko', 'Guinness')).toBe(0);
    expect(fit('gunness', 'Tusker')).toBe(0);
  });
});
