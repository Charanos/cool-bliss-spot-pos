import { createUuidV7 } from '@bliss/shared/id';
import { cents } from '@bliss/shared/money';
import { describe, expect, it } from 'vitest';
import { isoDay, kes, optionalText, requestId, wholeNumber } from './action';

/**
 * The field schemas every Console action shares. Money arrives as a string of shillings and leaves as
 * Cents; a request key made by the page is accepted; anything else is refused in words a person reads.
 */

describe('action field schemas', () => {
  it('reads shillings into cents, and refuses anything else with the same plain message', () => {
    expect(kes('the price').parse('1,250')).toBe(cents(125_000));
    expect(kes('the price').parse(' 350.50 ')).toBe(cents(35_050));
    const bad = kes('the price').safeParse('-5');
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('Enter the price in shillings, such as 1,250 or 1250.50.');
    expect(kes('the price').safeParse('twelve').success).toBe(false);
  });

  it('accepts the request key the page makes, and nothing that could be a path', () => {
    expect(requestId.safeParse(createUuidV7()()).success).toBe(true);
    expect(requestId.safeParse(null).success).toBe(true);
    expect(requestId.safeParse('../etc').success).toBe(false);
  });

  it('keeps whole numbers whole and in range', () => {
    expect(wholeNumber('The quantity').safeParse(3).success).toBe(true);
    expect(wholeNumber('The quantity').safeParse(1.5).success).toBe(false);
    expect(wholeNumber('The quantity').safeParse(-1).error?.issues[0]?.message).toBe('The quantity cannot be below zero.');
  });

  it('trims optional text to null when empty', () => {
    expect(optionalText(10, 'A note').parse('  ')).toBeNull();
    expect(optionalText(10, 'A note').parse(' hi ')).toBe('hi');
    expect(optionalText(3, 'A note').safeParse('long').success).toBe(false);
  });

  it('reads a date field', () => {
    expect(isoDay.safeParse('2026-09-26').success).toBe(true);
    expect(isoDay.safeParse('26/09/2026').success).toBe(false);
  });
});
