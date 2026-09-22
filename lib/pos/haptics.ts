'use client';

import { META, getMeta } from './db';

/**
 * A buzz to go with a notice, on a device that can and a person who asked for it. The switch lives
 * in Floor settings (tablet station, haptics) and is off until someone turns it on: a vibrating
 * tablet on a bar counter is loud.
 *
 * Patterns are short and distinct, so a waiter holding the tablet knows the outcome without looking:
 * one tick for a tap, two for done, a long one for something that needs them.
 */

export type HapticKind = 'tap' | 'success' | 'warning' | 'error';
const PATTERN: Record<HapticKind, number | number[]> = { tap: 8, success: [10, 40, 10], warning: [30, 60, 30], error: 120 };

let enabled = false;

/** Read the switch once at start, and again whenever settings change it. */
export async function refreshHaptics(): Promise<void> {
  enabled = Boolean(await getMeta<boolean>(META.hapticsEnabled));
}

export function haptic(kind: HapticKind): void {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    // A browser that refuses is a browser that stays quiet.
  }
}
