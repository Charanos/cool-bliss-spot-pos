'use client';

import { formatAgo, formatTime, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { FilterChips } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type FiredOrderView, useFiredOrders, useOutlet } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';

type Filter = 'all' | FiredOrderView['state'];

const STATE_CHIP = { held: 'held', at_bar: 'fired', poured: 'poured', needs_you: 'ran_out' } as const;
const STATE_WORD = { held: 'Held on this tablet', at_bar: 'At the bar', poured: 'Poured', needs_you: 'Ran out' } as const;

/**
 * What the bar has, and what it has done with it. F-07 and F-09: see an order reach the bar, and see
 * which lines are poured and which are still waiting.
 */
export default function OrdersPage() {
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const orders = useFiredOrders(session?.staffId);
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>('all');
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const count = (state: Filter) => (orders ?? []).filter((o) => state === 'all' || o.state === state).length;
  const shown = (orders ?? []).filter((o) => filter === 'all' || o.state === filter);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end gap-x-24 gap-y-12 border-b border-rule px-24 pb-16 pt-20">
        <div className="min-w-0 flex-1">
          <h1 className="text-title-lg text-ink">Orders</h1>
          <p className="mt-4 text-body text-ink-subtle">What the bar has, and what it has done with it.</p>
        </div>
        <FilterChips
          label="Order state"
          size="lg"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: count('all') },
            { value: 'needs_you', label: 'Needs you', count: count('needs_you') },
            { value: 'held', label: 'Held', count: count('held') },
            { value: 'at_bar', label: 'At the bar', count: count('at_bar') },
            { value: 'poured', label: 'Poured', count: count('poured') },
          ]}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-24 pb-32 pt-20">
        {orders === undefined ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-12">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-md" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          filter === 'all' ? (
            <EmptyState title="Nothing fired yet" body="Orders you fire show here until the bar pours them." />
          ) : (
            <EmptyState title="No orders in this state" body="Everything else is in the other filters." action={<Button variant="secondary" size="lg" onClick={() => setFilter('all')}>Show all orders</Button>} />
          )
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] items-start gap-12">
            {shown.map((order) => (
              <li key={order.orderId}>
                <button
                  type="button"
                  onClick={() => router.push(`/floor/tabs/${order.tabId}`)}
                  className={cx(
                    'flex w-full flex-col rounded-md border bg-raised p-16 text-left press-feedback hover:border-ink-disabled',
                    order.state === 'needs_you' ? 'border-stop' : 'border-hairline',
                  )}
                >
                  <span className="flex items-start gap-12">
                    <span className="min-w-0 flex-1">
                      <span className="block text-subtitle text-ink">{order.label}</span>
                      <span className="block text-body text-ink-subtle">
                        Fired {formatTime(order.firedAt, tz)} · {formatAgo(now - order.firedAt)} · {plural(order.lines.length, 'line')}
                      </span>
                    </span>
                    <StatusChip status={STATE_CHIP[order.state]} label={STATE_WORD[order.state]} />
                  </span>
                  <span className="mt-8 flex flex-col">
                    {order.lines.map(({ line, name, seatNo, state }) => (
                      <span key={line.id} className="flex min-h-[40px] items-center gap-12 border-t border-rule-raised py-4">
                        {seatNo ? <SeatChip seat={seatNo} size="dense" /> : <SeatChip seat="shared" size="dense" />}
                        <span className="font-mono tabular text-num text-ink-muted">{line.qty}</span>
                        <span className={cx('min-w-0 flex-1 truncate text-body', state === 'poured' ? 'text-ink-muted' : 'text-ink')}>{name}</span>
                        {state === 'poured' ? (
                          <span className="inline-flex items-center gap-6 text-body text-poured">
                            <Dot tone="poured" />
                            {line.servedAt ? formatTime(line.servedAt, tz) : 'Poured'}
                          </span>
                        ) : state === 'ran_out' ? (
                          <StatusChip status="ran_out" />
                        ) : state === 'unsent' ? (
                          <span className="inline-flex items-center gap-6 text-body text-info">
                            <Dot tone="info" />
                            Held
                          </span>
                        ) : (
                          <span className="text-body text-ink-subtle">Waiting</span>
                        )}
                      </span>
                    ))}
                  </span>
                  {order.state === 'needs_you' ? (
                    <span className="mt-12 text-body text-stop">The bar could not pour this. Open the tab to swap it or void it with the reason prefilled.</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
