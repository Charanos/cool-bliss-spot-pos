import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain ES module shared with the check-copy script, without type declarations.
import { problemsIn, titleCase } from './copy-rules.mjs';

/** The docs/08 copy rules, held to the kinds of strings they exist to catch, and to ones they must let through. */

const why = (source: string) => (problemsIn(source) as { why: string }[]).map((p) => p.why);

describe('copy rules', () => {
  it('refuse filler, form-letter errors and prototype words', () => {
    expect(why('<p>Please try again</p>')).toHaveLength(1);
    expect(why('<p>Oops, something went wrong</p>').length).toBeGreaterThanOrEqual(2);
    expect(why('<h1>Executive Overview</h1>')).toHaveLength(1);
    expect(why('<Button>Submit</Button>')).toHaveLength(1);
  });

  it('hold the locked terms: a line is voided, money is settled', () => {
    expect(why('<span>Delete line</span>')).toHaveLength(1);
    expect(why('<span>Checkout</span>')).toHaveLength(1);
  });

  it('keep KRA eTIMS out, and em dashes out', () => {
    expect(why('<p>eTIMS reference</p>')).toHaveLength(1);
    expect(why(`<p>Settled ${'\u2014'} thanks</p>`)).toHaveLength(1);
  });

  it('refuse shouted capitals and Title Case labels, but not names or sentences', () => {
    expect(why('<p>OPERATIONAL INTELLIGENCE</p>').length).toBeGreaterThanOrEqual(1);
    expect(why('<Metric label="Average Ticket" />')).toHaveLength(1);
    expect(titleCase('Pay with M-Pesa')).toBe(false);
    expect(titleCase('Open tabs. Settle Them first.')).toBe(false);
  });

  it('let plain copy through', () => {
    expect(why('<Metric label="Average bill" detail="Per settled bill" />')).toEqual([]);
    expect(why('<p>Nothing needs you</p>')).toEqual([]);
    expect(why('<span>KES 1,250</span>')).toEqual([]);
  });
});
