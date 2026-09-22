'use client';

import { useRouter } from 'next/navigation';
import { HistoryView } from '@/app/_pos/history/history-view';
import { useSession } from '@/lib/pos/session';

/** The waiter's history: their own tabs first, everyone's a tap away. docs/16 section 9. */
export default function FloorHistoryPage() {
  const session = useSession();
  const router = useRouter();
  return <HistoryView surface="floor" staffId={session?.staffId ?? null} onOpenTab={(tabId) => router.push(`/floor/tabs/${tabId}`)} />;
}
