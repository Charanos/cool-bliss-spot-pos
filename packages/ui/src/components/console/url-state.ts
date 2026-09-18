'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Table and filter state lives in the query string, so any view is a shareable link. docs/06 6.6.
 * Updates use history.replaceState, which Next keeps in sync with useSearchParams without a server
 * round trip, so sorting a table never refetches the page.
 */
export function useUrlState() {
  const params = useSearchParams();
  const pathname = usePathname();

  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  return { params, set, get: (key: string) => params.get(key) };
}
