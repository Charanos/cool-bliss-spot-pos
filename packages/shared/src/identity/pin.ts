/**
 * The rules a PIN follows, shared by the server that enforces them and the screens that explain them
 * as someone types. docs/08, PINs.
 */

export const PIN_MIN = 4;
export const PIN_MAX = 8;

const COMMON = new Set(['1234', '4321', '1111', '0000', '1212', '2580', '123456', '654321', '121212', '112233', '123123', '696969', '12345678', '87654321', '11223344']);

/** Why a PIN is too easy, in words for the person choosing it, or null when it is fine. */
export function pinWeakness(pin: string): string | null {
  if (/^(\d)\1+$/.test(pin)) return 'It is one digit repeated.';
  const digits = [...pin].map(Number);
  const up = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 1) % 10);
  const down = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 9) % 10);
  if (up || down) return 'It is a run of digits.';
  if (COMMON.has(pin)) return 'It is one of the first PINs anyone would try.';
  if (pin.length % 2 === 0 && pin.slice(0, pin.length / 2) === pin.slice(pin.length / 2)) return 'Its two halves are the same.';
  return null;
}

/** Only the digits of something typed or pasted, at most this many. */
export function digitsOnly(value: string, max = PIN_MAX): string {
  return value.replace(/\D/g, '').slice(0, max);
}
