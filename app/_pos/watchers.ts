'use client';

import { plural } from '@bliss/shared/format';
import { notify } from '@bliss/ui/components/notices';
import { useEffect, useRef } from 'react';
import { deliver } from '@/lib/pos/actions';
import type { Ticket } from '@/lib/pos/counter-queries';
import { haptic } from '@/lib/pos/haptics';
import type { FiredOrderView } from '@/lib/pos/queries';

/**
 * News from the other station. docs/16 section 7.
 *
 * Each watcher compares what it sees now with what it saw a moment ago and speaks only about the
 * change. The first reading after a screen opens is taken as the baseline, never announced, so
 * signing in to a busy night is not a wall of notices about things that already happened.
 */

/** The Floor hears when its rounds are poured, and when something on them ran out. */
export function useFloorWatch(orders: readonly FiredOrderView[] | undefined, onOpenTab: (tabId: string) => void) {
  const seen = useRef<Map<string, FiredOrderView['state']> | null>(null);

  useEffect(() => {
    if (!orders) return;
    const now = new Map(orders.map((o) => [o.orderId, o.state]));
    const before = seen.current;
    seen.current = now;
    if (!before) return;

    for (const o of orders) {
      const was = before.get(o.orderId);
      if (!was || was === o.state) continue;
      if (o.state === 'poured') {
        haptic('success');
        notify({
          key: `poured:${o.orderId}`,
          title: `${o.label} is poured`,
          body: `${plural(o.lines.length, 'line')} ready at the counter.`,
          holdMs: 9000,
          action: { label: 'Mark served', run: () => deliver(o.orderId, o.label) },
        });
      } else if (o.state === 'needs_you') {
        haptic('warning');
        notify({
          tone: 'warning',
          key: `ranout:${o.orderId}`,
          title: `Something ran out on ${o.label}`,
          body: 'The counter could not pour it. Swap it or void it on the tab.',
          action: { label: 'Open the tab', run: () => onOpenTab(o.tabId) },
        });
      }
    }
  }, [orders, onOpenTab]);
}

/** The Counter hears about every new ticket, unless it is already looking at the queue. */
export function useCounterWatch(waiting: readonly Ticket[] | undefined, onOrdersPage: boolean, onOpenOrders: () => void) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const now = new Set(waiting.map((t) => t.orderId));
    const before = seen.current;
    seen.current = now;
    if (!before) return;

    const fresh = waiting.filter((t) => !before.has(t.orderId));
    if (fresh.length === 0) return;
    haptic('tap');
    for (const t of fresh) {
      const lines = t.lines.reduce((n, l) => n + l.qty, 0);
      notify({
        tone: 'info',
        key: `ticket:${t.orderId}`,
        title: `New order · ${t.label}`,
        body: `${plural(lines, 'item')}${t.waiter ? ` from ${t.waiter}` : ''}.`,
        holdMs: onOrdersPage ? 3500 : 8000,
        action: onOrdersPage ? undefined : { label: 'See orders', run: onOpenOrders },
      });
    }
  }, [waiting, onOrdersPage, onOpenOrders]);
}
