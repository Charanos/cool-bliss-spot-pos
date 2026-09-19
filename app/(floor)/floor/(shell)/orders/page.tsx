'use client';

import { Button } from '@bliss/ui/components/button';
import { FilterChips, Segmented } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { OrderCard } from '@bliss/ui/components/floor/order-card';
import { MetaLine, type MetaItem } from '@bliss/ui/components/working';
import { useListEnter } from '@bliss/ui/motion/floor-hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { markOrderDelivered } from '@/lib/pos/mutations';
import { type FiredOrderView, useFiredOrders, useOutlet } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { OrderActionSheet } from './_components/order-action-sheet';

type Filter = 'all' | FiredOrderView['state'];

/**
 * Hook to track responsive column count for dynamic Bento stacking.
 * 1 col on mobile (<640px), 2 cols on tablet (640-1024px), 3 cols on desktop/wide (1024px+).
 */
function useBentoColumnCount(): number {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setCols(1);
      } else if (width < 1024) {
        setCols(2);
      } else {
        setCols(3);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return cols;
}

/**
 * Distribute orders into balanced column tracks using greedy shortest-column packing.
 * This dynamically adapts the stack to the actual content height of each card:
 * short cards pack immediately below other cards, while tall cards take their natural height
 * without creating empty vertical voids.
 */
function useBentoColumns(orders: FiredOrderView[], cols: number) {
  return useMemo(() => {
    if (!orders || orders.length === 0) return [];
    if (cols <= 1) return [orders];

    const buckets: FiredOrderView[][] = Array.from({ length: cols }, () => []);
    const heights = new Array(cols).fill(0);

    for (const order of orders) {
      let minCol = 0;
      for (let i = 1; i < cols; i++) {
        if ((heights[i] ?? 0) < (heights[minCol] ?? 0)) {
          minCol = i;
        }
      }

      const targetBucket = buckets[minCol];
      if (targetBucket) {
        targetBucket.push(order);
      }

      // Estimated height weight: base header/padding ~100px, lines ~42px each, action banner ~48px
      const cardHeight = 100 + order.lines.length * 42 + 48;
      heights[minCol] = (heights[minCol] ?? 0) + cardHeight;
    }

    return buckets;
  }, [orders, cols]);
}

/**
 * Revamped Orders Page: What the bar has, and what it has done with it.
 * Conforms to docs/13-floor-tabs-revamp.md & docs/12-surface-language.md:
 *
 * Operational Clarity:
 * - Clear domain distinction between Poured (ready at counter) and Served (delivered to table).
 * - Mobile ergonomics: 1-tap "Mark served" button on poured cards + 450ms haptic long-press sheet.
 * - Desktop parity: 3-dot trigger + right-click context menu.
 *
 * Header:
 * - Frosted glass sticky banner with text-heading title.
 * - Non-colliding responsive layout across mobile, tablet, and desktop.
 * - Live telemetry stats pill with JetBrains Mono numbers.
 * - Scope segmented control (Mine vs Everyone).
 * - FilterChips for order states with real-time counts.
 *
 * Content:
 * - Dynamic Bento grid: cards pack tightly into adaptive column tracks based on actual content height.
 * - Smooth entrance motion via useListEnter.
 * - Contextual empty states with Kenyan bar register copy (docs/08).
 * - Generous bottom padding to clear the floating dock.
 */
export default function OrdersPage() {
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const listRef = useRef<HTMLDivElement>(null);
  const cols = useBentoColumnCount();

  const [scope, setScope] = useState<'mine' | 'everyone'>('mine');
  const [filter, setFilter] = useState<Filter>('all');
  const [activeOrder, setActiveOrder] = useState<FiredOrderView | null>(null);

  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const staffId = scope === 'mine' ? (session?.staffId ?? null) : null;
  const orders = useFiredOrders(staffId);

  const loading = orders === undefined;
  useListEnter(listRef, !loading);

  const count = (state: Filter) =>
    (orders ?? []).filter((o) => state === 'all' || o.state === state).length;

  const shown = useMemo(
    () => (orders ?? []).filter((o) => filter === 'all' || o.state === filter),
    [orders, filter],
  );

  const bentoColumns = useBentoColumns(shown, cols);

  const needsYouCount = count('needs_you');
  const atBarCount = count('at_bar');
  const pouredCount = count('poured');
  const servedCount = count('served');
  const heldCount = count('held');

  // Summary MetaLine items for the telemetry pill
  const summaryItems: (MetaItem | null)[] = loading
    ? [{ key: 'loading', text: 'Reading orders\u2026' }]
    : (orders ?? []).length === 0
      ? [{ key: 'none', text: 'No active orders' }]
      : [
          {
            key: 'count',
            text: `${(orders ?? []).length} ${(orders ?? []).length === 1 ? 'order' : 'orders'}`,
            mono: true,
          },
          needsYouCount > 0
            ? {
                key: 'needs_you',
                text: `${needsYouCount} need attention`,
              }
            : null,
          atBarCount > 0
            ? {
                key: 'at_bar',
                text: `${atBarCount} at the bar`,
                mono: true,
              }
            : null,
          pouredCount > 0
            ? {
                key: 'poured',
                text: `${pouredCount} poured`,
                mono: true,
              }
            : null,
          servedCount > 0
            ? {
                key: 'served',
                text: `${servedCount} served`,
                mono: true,
              }
            : null,
        ];

  const handleMarkServed = async (orderId: string) => {
    try {
      await markOrderDelivered(orderId);
    } catch (e) {
      console.error('Failed to mark order as delivered:', e);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent overflow-hidden">
      {/* ── Header: Frosted Glass Sticky Banner ─────────────────────── */}
      <header className="shrink-0 z-10 border-b border-rule-raised/20 bg-page/85 px-16 tablet:px-24 pb-12 tablet:pb-16 pt-16 tablet:pt-24 backdrop-blur-md shadow-sm">
        {/* Tablet / Desktop Header Layout */}
        <div className="hidden tablet:flex items-center justify-between gap-x-24">
          <div className="flex items-center gap-16 min-w-0">
            <h1 className="text-heading font-medium tracking-tight text-ink">Orders</h1>
            <div className="h-24 w-px bg-rule-raised/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center rounded-full bg-sunken/80 px-16 py-6 border border-rule-raised/30 shadow-inner">
              <MetaLine items={summaryItems} className="text-body-sm" />
            </div>
          </div>
          <div className="shrink-0">
            <Segmented
              label="Whose orders"
              size="md"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'everyone', label: 'Everyone' },
              ]}
            />
          </div>
        </div>

        {/* Mobile Header Layout (No overlap, generous clearance) */}
        <div className="tablet:hidden flex flex-col gap-10">
          <div className="flex items-center justify-between gap-8">
            <h1 className="text-title-lg font-medium tracking-tight text-ink">Orders</h1>
            <Segmented
              label="Whose orders"
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'everyone', label: 'Everyone' },
              ]}
              className="w-fit"
            />
          </div>
          <div className="w-fit max-w-full flex items-center rounded-full bg-sunken/80 px-12 py-4 border border-rule-raised/30 shadow-inner overflow-x-auto scrollbar-none">
            <MetaLine items={summaryItems} className="whitespace-nowrap text-micro" />
          </div>
        </div>

        {/* State Filter Chips with Live Counts */}
        <FilterChips
          label="Order state"
          size="md"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: count('all') },
            { value: 'needs_you', label: 'Needs you', count: needsYouCount },
            { value: 'at_bar', label: 'At the bar', count: atBarCount },
            { value: 'poured', label: 'Poured', count: pouredCount },
            { value: 'served', label: 'Served', count: servedCount },
            { value: 'held', label: 'Held', count: heldCount },
          ]}
          className="mt-12 tablet:mt-20 overflow-x-auto no-scrollbar"
        />
      </header>

      {/* ── Workspace / Content Area (Dynamic Bento Columns) ────────── */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-12 tablet:px-24 pt-12 tablet:pt-24 pb-[140px] tablet:pb-[160px]"
      >
        {loading ? (
          <div className="flex flex-col tablet:flex-row gap-12 tablet:gap-16 items-start">
            {Array.from({ length: cols }, (_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-12 tablet:gap-16 flex-1 min-w-0 w-full">
                <Skeleton className="min-h-[220px] rounded-[22px]" />
                <Skeleton className="min-h-[160px] rounded-[22px]" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center">
            {filter === 'all' ? (
              scope === 'mine' ? (
                <EmptyState
                  title="No orders fired yet"
                  body="Orders you fire to the bar will appear here with real-time pouring progress."
                  action={
                    <Button variant="secondary" size="lg" onClick={() => router.push('/floor/tabs')}>
                      Go to tabs
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No orders on the floor"
                  body="There are no active orders at the bar right now across any table."
                  action={
                    <Button variant="secondary" size="lg" onClick={() => router.push('/floor/tabs')}>
                      Go to tabs
                    </Button>
                  }
                />
              )
            ) : filter === 'needs_you' ? (
              <EmptyState
                title="Nothing needs attention"
                body="All items ordered are available and being prepared at the bar."
                action={
                  <Button variant="secondary" size="lg" onClick={() => setFilter('all')}>
                    Show all orders
                  </Button>
                }
              />
            ) : filter === 'held' ? (
              <EmptyState
                title="No held orders"
                body="All orders on this tablet have successfully reached the bar."
                action={
                  <Button variant="secondary" size="lg" onClick={() => setFilter('all')}>
                    Show all orders
                  </Button>
                }
              />
            ) : filter === 'at_bar' ? (
              <EmptyState
                title="Nothing waiting at the bar"
                body="Orders waiting to be poured will appear here as soon as they are fired."
                action={
                  <Button variant="secondary" size="lg" onClick={() => setFilter('all')}>
                    Show all orders
                  </Button>
                }
              />
            ) : filter === 'poured' ? (
              <EmptyState
                title="No poured orders waiting"
                body="Drinks poured by the bartender will appear here ready for table delivery."
                action={
                  <Button variant="secondary" size="lg" onClick={() => setFilter('all')}>
                    Show all orders
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No served orders yet"
                body="Orders delivered to tables will appear here once marked as served."
                action={
                  <Button variant="secondary" size="lg" onClick={() => setFilter('all')}>
                    Show all orders
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col tablet:flex-row gap-12 tablet:gap-16 items-start">
            {bentoColumns.map((colOrders, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-12 tablet:gap-16 flex-1 min-w-0 w-full">
                {colOrders.map((order) => (
                  <div key={order.orderId} data-list-item="true" className="w-full min-w-0">
                    <OrderCard
                      orderId={order.orderId}
                      tabId={order.tabId}
                      label={order.label}
                      firedAt={order.firedAt}
                      state={order.state}
                      deliveredAt={order.deliveredAt}
                      unsent={order.unsent}
                      lines={order.lines.map(({ line, name, seatNo, state, modifiers }) => ({
                        id: line.id,
                        name,
                        qty: line.qty,
                        seatNo,
                        state,
                        modifiers,
                        servedAt: line.servedAt,
                      }))}
                      waiter={order.waiterName}
                      mine={order.waiterId === session?.staffId}
                      zoneName={order.zoneName}
                      total={order.total}
                      timezone={tz}
                      onOpen={() => router.push(`/floor/tabs/${order.tabId}`)}
                      onMarkServed={
                        order.state === 'poured'
                          ? () => void handleMarkServed(order.orderId)
                          : undefined
                      }
                      onActionMenu={() => setActiveOrder(order)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Long Press / 3-Dot Action Sheet ─────────────────────────── */}
      <OrderActionSheet
        order={activeOrder}
        timezone={tz}
        onClose={() => setActiveOrder(null)}
      />
    </div>
  );
}
