'use client';

import { motionStore } from '@bliss/ui/motion';
import { useSyncExternalStore } from 'react';
import { type DisplayProfile, readCaps, suggestProfiles } from './device-caps';
import { DISPLAY_KEY as KEY } from './display-boot';

/**
 * How this device draws Bliss. docs/06, display profiles; docs/11 D-25.
 *
 *  - standard: the design as drawn.
 *  - lite: the artwork drawn once, small frosted surfaces solid (a sheet keeps its blur), short motion only.
 *    For slower devices such as the iPad mini 4.
 *  - clarity: wider steps between surfaces, visible edges, stronger status colours, larger meta text.
 *    The default on every station: it reads well on good and weak screens alike.
 *
 * Profiles combine. Until the device chooses, it follows what it reports about itself. The choice is
 * the device's own, kept on it, applied as data-display on <html> before anything else draws.
 */

export const PROFILES: DisplayProfile[] = ['lite', 'clarity'];

interface DisplayState {
  /** What the device chose, or null to follow the suggestion. */
  chosen: DisplayProfile[] | null;
  suggested: DisplayProfile[];
}

let state: DisplayState = { chosen: null, suggested: [] };
const listeners = new Set<() => void>();

function read(): DisplayProfile[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((p): p is DisplayProfile => PROFILES.includes(p as DisplayProfile)) : null;
  } catch {
    return null;
  }
}

function apply() {
  const active = state.chosen ?? state.suggested;
  document.documentElement.dataset.display = active.length > 0 ? active.join(' ') : 'standard';
  // Lite also quietens motion: the engine skips anything longer than a press.
  motionStore.set({ lowPower: active.includes('lite') });
  for (const l of listeners) l();
}

/** Once, as a station starts: read the device, read its choice, draw accordingly. */
export function initDisplay() {
  state = { chosen: read(), suggested: suggestProfiles(readCaps()) };
  apply();
}

export function setDisplay(chosen: DisplayProfile[] | null) {
  state = { ...state, chosen };
  try {
    if (chosen === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(chosen));
  } catch {
    // Private mode or storage off: the choice holds until the page reloads.
  }
  apply();
}

export function activeDisplay(): DisplayProfile[] {
  return state.chosen ?? state.suggested;
}

const EMPTY: DisplayState = { chosen: null, suggested: [] };

export function useDisplay(): DisplayState & { active: DisplayProfile[] } {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => EMPTY,
  );
  return { ...snapshot, active: snapshot.chosen ?? snapshot.suggested };
}
