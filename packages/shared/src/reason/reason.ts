/**
 * Every void, discount, write-off, hold and adjustment carries a reason of at least ten characters
 * and an actor. docs/04-data-model.md conventions, and invariant 10 in docs/05-flows-and-channels.md.
 */
export const REASON_MIN_LENGTH = 10;

export const REASON_TOO_SHORT = 'Reason needs at least 10 characters. Say what happened, not just "mistake".';

export type ReasonCheck = { ok: true; reason: string } | { ok: false; message: string; length: number };

export function reasonLength(input: string): number {
  return [...input.trim().replace(/\s+/g, ' ')].length;
}

export function checkReason(input: string): ReasonCheck {
  const reason = input.trim().replace(/\s+/g, ' ');
  const length = [...reason].length;
  if (length < REASON_MIN_LENGTH) return { ok: false, message: REASON_TOO_SHORT, length };
  return { ok: true, reason };
}

/**
 * Quick reason chips populate the field rather than replacing it. Chips alone are never accepted:
 * a chip's text is shorter than the minimum on purpose, so the person adds the detail.
 */
export function applyQuickReason(current: string, chip: string): string {
  const trimmed = current.trim();
  if (trimmed.length === 0) return `${chip}, `;
  if (trimmed.toLowerCase().startsWith(chip.toLowerCase())) return current;
  return `${chip}, ${trimmed}`;
}

export interface Actor {
  staffId: string;
  deviceId: string | null;
}

export interface Reasoned {
  reason: string;
  actor: Actor;
}

/** A reason that does not pass the rules. Its message is written for the person typing it. */
export class ReasonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReasonError';
  }
}

/** Guard used at every service boundary that writes a reasoned change. */
export function requireReasoned(input: { reason: string; actor: Actor | null | undefined }): Reasoned {
  if (!input.actor?.staffId) throw new Error('A reasoned change needs an actor');
  const check = checkReason(input.reason);
  if (!check.ok) throw new ReasonError(check.message);
  return { reason: check.reason, actor: input.actor };
}
