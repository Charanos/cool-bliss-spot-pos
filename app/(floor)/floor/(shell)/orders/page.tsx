'use client';

import { Button } from '@bliss/ui/components/button';
import { FilterChips, Segmented } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { OrderCard } from '@bliss/ui/components/floor/order-card';
import { MetaLine, type MetaItem } from '@bliss/ui/components/working';
import { useListEnter } from '@bliss/ui/motion/floor-hooks';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { deliver } from '@/lib/pos/actions';
import { type FiredOrderView, useFiredOrders, useOutlet } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { OrderActionSheet } from './_components/order-action-sheet';

type Filter = 'all' | FiredOrderView['state'];

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

  // Reports its own outcome, with an undo, instead of failing silently into the console.
  const handleMarkServed = (orderId: string, label: string) => deliver(orderId, label);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent overflow-hidden">
      {/* ── Header: Frosted Glass Sticky Banner ─────────────────────── */}
      <header className="shrink-0 z-10 border-b border-rule-raised/20 bg-page/85 px-12 pb-12 pt-12 backdrop-blur-glass pad:px-24 pad:pb-16 pad:pt-20 short:py-6">
        {/* Tablet / Desktop Header Layout */}
        <div className="hidden pad:flex items-center justify-between gap-x-24">
          <div className="flex items-center gap-16 min-w-0">
            <h1 className="text-heading font-medium text-ink">Orders</h1>
            <div className="h-24 w-px bg-rule-raised/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center rounded-full bg-sunken/80 px-16 py-6 border border-rule-raised/30 ">
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
        <div className="flex flex-col gap-8 pad:hidden">
          <div className="flex items-center justify-between gap-8">
            <h1 className="text-title-lg font-medium text-ink">Orders</h1>
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
          <div className="flex w-fit max-w-full items-center overflow-x-auto rounded-dot border border-rule-raised/30 bg-sunken/80 px-12 py-4 no-scrollbar">
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
          className="mt-12 overflow-x-auto no-scrollbar pad:mt-20 short:mt-6"
        />
      </header>

      {/* ── Workspace / Content Area (Dynamic Bento Columns) ────────── */}
      <div
        ref={listRef}
        className="scroll-region no-scrollbar px-12 pb-24 pt-12 pad:px-24 pad:pt-24"
      >
        {loading ? (
          <div className="columns-1 gap-12 pad:columns-2 pad:gap-16 desktop:columns-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="mb-12 min-h-[200px] break-inside-avoid rounded-lg pad:mb-16" />
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
          <div className="columns-1 gap-12 pad:columns-2 pad:gap-16 desktop:columns-3">
            {shown.map((order) => (
              <div key={order.orderId} data-list-item="true" className="mb-12 break-inside-avoid pad:mb-16">
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
                            ? () => void handleMarkServed(order.orderId, order.label)
                            : undefined
                        }
                        onActionMenu={() => setActiveOrder(order)}
                      />
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
