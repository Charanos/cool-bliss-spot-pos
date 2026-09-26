'use client';

import { NoticeViewport } from '@bliss/ui/components/notices';
import { initMotion } from '@bliss/ui/motion';
import { type ReactNode, useEffect } from 'react';
import { primeStationToken, setForcedOffline } from '@/lib/pos/api';
import { META, getMeta } from '@/lib/pos/db';
import { ensureDevice } from '@/lib/pos/session';
import { pruneAcked, startSync, useSync } from '@/lib/pos/sync';
import { startUpdates } from '@/lib/pos/updates';
import { refreshHaptics } from '@/lib/pos/haptics';

/**
 * The client root for a staff device, Floor or Counter: motion defaults once, the sync cycle once, and
 * a first-run gate while the catalogue snapshot lands. After the first pull the device trades from its
 * own store. docs/14 section 4.
 */
export function PosRoot({ children }: { children: ReactNode }) {
  const sync = useSync();

  useEffect(() => {
    initMotion();
    let stop: (() => void) | undefined;
    const stopUpdates = startUpdates();
    void (async () => {
      setForcedOffline(Boolean(await getMeta<boolean>(META.forceOffline)));
      await refreshHaptics();
      await primeStationToken();
      stop = startSync();
      await pruneAcked();
    })();
    return () => {
      stop?.();
      stopUpdates();
    };
  }, []);

  useEffect(() => {
    if (sync.bootstrapped) void ensureDevice();
  }, [sync.bootstrapped]);

  return (
    <>
      {children}
      <NoticeViewport />
    </>
  );
}
