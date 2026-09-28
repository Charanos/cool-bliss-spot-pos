'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const EVERY_MS = 15_000;

/**
 * Keeps an open Console page current: the Tonight card, the overview, open tabs, stock. Every 15
 * seconds while the page is in view, and the moment it comes back into view, it asks the server for
 * its pulse; when that has moved, the page fetches its data again in place. Never under an open
 * dialog, where someone is typing: it waits for the dialog to close.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let pending = false;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const response = await fetch('/api/console/pulse', { cache: 'no-store' });
        if (!response.ok) return;
        const { pulse } = (await response.json()) as { pulse?: string };
        if (!pulse) return;
        if (last !== null && pulse !== last) pending = true;
        last = pulse;
      } catch {
        // Offline for a moment: the next beat tries again.
      } finally {
        busy = false;
      }
      if (pending && !document.querySelector('dialog[open]')) {
        pending = false;
        router.refresh();
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);
  return null;
}
