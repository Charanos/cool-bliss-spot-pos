import { describe, expect, it } from 'vitest';
import { historyRange, matchPreset } from './history';

describe('history ranges', () => {
  // Tuesday 22 September 2026.
  const current = '2026-09-22';

  it('names tonight and yesterday as single business days', () => {
    expect(historyRange('tonight', current)).toEqual({ from: current, to: current });
    expect(historyRange('yesterday', current)).toEqual({ from: '2026-09-21', to: '2026-09-21' });
  });

  it('starts a week on Monday', () => {
    expect(historyRange('week', current)).toEqual({ from: '2026-09-21', to: current });
    expect(historyRange('week', '2026-09-21')).toEqual({ from: '2026-09-21', to: '2026-09-21' });
    expect(historyRange('week', '2026-09-27')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('counts the last seven days including tonight', () => {
    expect(historyRange('last7', current)).toEqual({ from: '2026-09-16', to: current });
  });

  it('takes months whole, across a year end', () => {
    expect(historyRange('month', current)).toEqual({ from: '2026-09-01', to: current });
    expect(historyRange('lastMonth', current)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(historyRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(historyRange('lastMonth', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('reads two dates as the named range they make', () => {
    expect(matchPreset('2026-09-21', '2026-09-21', current)).toBe('yesterday');
    expect(matchPreset('2026-08-01', '2026-08-31', current)).toBe('lastMonth');
    expect(matchPreset('2026-08-03', '2026-08-09', current)).toBe('custom');
  });
});
