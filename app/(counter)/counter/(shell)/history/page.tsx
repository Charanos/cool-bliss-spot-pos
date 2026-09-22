'use client';

import { useRouter } from 'next/navigation';
import { HistoryView } from '@/app/_pos/history/history-view';

/**
 * The Counter's history: what was settled at this till first, the whole outlet a tap away.
 * docs/16 section 9. It took the place of the Bills view, whose day it still opens on.
 */
export default function CounterHistoryPage() {
  const router = useRouter();
  return <HistoryView surface="counter" onOpenTab={(tabId) => router.push(`/counter/tabs/${tabId}`)} />;
}
