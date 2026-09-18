import { describe, expect, it } from 'vitest';
import { applyQuickReason, checkReason, requireReasoned } from './reason';

describe('reasons', () => {
  it('refuses fewer than ten characters, counting trimmed text', () => {
    expect(checkReason('   mistake   ').ok).toBe(false);
    expect(checkReason('Wrong item').ok).toBe(true);
  });

  it('does not accept a quick chip on its own for the short chips', () => {
    expect(checkReason(applyQuickReason('', 'Ran out')).ok).toBe(false);
  });

  it('prefixes a chip to what was already typed', () => {
    expect(applyQuickReason('guest wanted a Tusker', 'Changed mind')).toBe('Changed mind, guest wanted a Tusker');
  });

  it('needs an actor', () => {
    expect(() => requireReasoned({ reason: 'Bottle broke at the bar', actor: null })).toThrow('actor');
    expect(requireReasoned({ reason: ' Bottle broke at the bar ', actor: { staffId: 'k', deviceId: null } }).reason).toBe(
      'Bottle broke at the bar',
    );
  });
});
