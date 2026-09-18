import { type Cents, cents, splitParts } from './cents';

export interface FormatOptions {
  /**
   * `always` renders 12,450.00. `whole` drops .00 for a whole shilling amount, which is how
   * button copy reads: "Settle KES 4,200".
   */
  decimals?: 'always' | 'whole';
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The figure without the currency prefix: 12,450.00. Negative values take a leading minus,
 * never parentheses. docs/06-design-system.md section 3, Currency.
 */
export function formatFigure(value: Cents, options: FormatOptions = {}): string {
  const { negative, shillings, cents: minor } = splitParts(value);
  const whole = groupThousands(shillings.toString());
  const sign = negative ? '-' : '';
  if (options.decimals === 'whole' && minor === 0n) return `${sign}${whole}`;
  return `${sign}${whole}.${minor.toString().padStart(2, '0')}`;
}

/** KES 12,450.00, for plain-text contexts such as dialog bodies and CSV. */
export function formatKes(value: Cents, options: FormatOptions = {}): string {
  return `KES ${formatFigure(value, options)}`;
}

/** CSV and exports carry a plain decimal with no grouping: 12450.00 */
export function formatDecimal(value: Cents): string {
  const { negative, shillings, cents: minor } = splitParts(value);
  return `${negative ? '-' : ''}${shillings.toString()}.${minor.toString().padStart(2, '0')}`;
}

const PARSE = /^(-)?\s*(?:KES\s*)?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/i;

/**
 * Parse what a cashier types or what a CSV carries. Accepts "12,450", "12450.5", "KES 700.00".
 * Rejects more than two decimal places rather than rounding them away silently.
 */
export function parseKes(input: string): Cents {
  const trimmed = input.trim();
  const match = trimmed.match(PARSE);
  if (!match) throw new TypeError(`"${input}" is not an amount in KES`);
  const [, minus, whole = '0', fraction = ''] = match;
  const shillingDigits = whole.replace(/,/g, '');
  const minor = fraction.padEnd(2, '0');
  const total = BigInt(shillingDigits) * 100n + BigInt(minor);
  return cents(minus ? -total : total);
}

/**
 * KES 54.1k, for a figure glanced at rather than reconciled: a card, a badge. One decimal, half up,
 * in whole integer arithmetic. Under a thousand shillings it is the whole figure.
 */
export function formatKesCompact(value: Cents): string {
  const { negative, shillings } = splitParts(value);
  const sign = negative ? '-' : '';
  const compact = (unit: bigint, suffix: string) => {
    const tenths = (shillings * 10n + unit / 2n) / unit;
    const whole = tenths / 10n;
    const fraction = tenths % 10n;
    return `KES ${sign}${groupThousands(whole.toString())}${fraction === 0n ? '' : `.${fraction}`}${suffix}`;
  };
  if (shillings < 1_000n) return `KES ${sign}${shillings.toString()}`;
  if (shillings < 999_950n) return compact(1_000n, 'k');
  return compact(1_000_000n, 'm');
}
