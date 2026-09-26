'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { META, getMeta } from './db';

/**
 * Keep the screen on while Bliss is open, when the device has chosen to. Held for the whole station,
 * not one page, and taken again whenever the page comes back into view, since the system releases it.
 * Safari before 16.4 (the iPad mini 4) has no Wake Lock: there, Auto-Lock set to Never does the job.
 */
export function useKeepAwake() {
  const wanted = useLiveQuery(() => getMeta<boolean>(META.screenKeepAwake), []);
  useEffect(() => {
    if (!wanted || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const take = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Refused (low battery, a background tab): the screen follows its own timeout.
      }
    };
    void take();
    document.addEventListener('visibilitychange', take);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', take);
      void lock?.release().catch(() => undefined);
    };
  }, [wanted]);
}

export const canKeepAwake = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
