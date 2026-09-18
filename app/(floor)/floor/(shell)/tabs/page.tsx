'use client';

import type { ServiceTable } from '@bliss/shared/domain';
import { formatKes, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { FilterChips, Segmented } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { FreeTableCard, TabCard } from '@bliss/ui/components/floor/tab-card';
import { MetaLine } from '@bliss/ui/components/working';
import { SectionHeader } from '@bliss/ui/components/working';
import { useNow } from '@bliss/ui/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { OpenTabSheet, tableLabel } from '../../_components/open-tab-sheet';
import { useOpenTabs, useZonesAndTables } from '@/lib/pos/queries';
import { useSession } from '@/lib/pos/session';
import { formatElapsed } from '@bliss/shared/format';

/**
 * The tab list: the view a waiter starts a shift on. docs/13 §4 Layer 2.
 *
 * Header: title-lg, MetaLine summary, Segmented scope picker, FilterChips zone filter.
 * Content: SectionHeader per group, gap-16 grid, Skeleton loading, EmptyState per scenario.
 * The base layer's walk-up button is the only "Open tab" action on an empty page.
 */
export default function TabsPage() {
  const router = useRouter();
  const session = useSession();
  const tabs = useOpenTabs();
  const places = useZonesAndTables();
  const now = useNow(30_000);
  const [zone, setZone] = useState('all');
  const [scope, setScope] = useState<'mine' | 'everyone'>('mine');
  const [sheet, setSheet] = useState<{ open: boolean; table: ServiceTable | null }>({ open: false, table: null });

  const occupied = useMemo(() => new Set((tabs ?? []).map((t) => t.tab.serviceTableId).filter(Boolean)), [tabs]);
  const visibleTabs = (tabs ?? []).filter(
    (t) => (scope === 'everyone' || t.tab.assignedTo === session?.staffId) && (zone === 'all' || t.tab.zoneId === zone),
  );
  const freeTables = (places?.tables ?? [])
    .filter((t) => !occupied.has(t.id) && t.status !== 'out_of_service' && (zone === 'all' || t.zoneId === zone))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  const counterZone = places?.zones.find((z) => z.name === 'Counter')?.id ?? places?.zones[0]?.id ?? null;

  // Total across all visible tabs (not just mine) for the floor summary
  const allScopedTabs = (tabs ?? []).filter(
    (t) => scope === 'everyone' || t.tab.assignedTo === session?.staffId,
  );
  const onFloor = sum(allScopedTabs.map((t) => t.total));

  const zoneOptions = [
    {
      value: 'all',
      label: 'All zones',
      count: allScopedTabs.length,
    },
    ...(places?.zones ?? []).map((z) => ({
      value: z.id,
      label: z.name,
      count: (tabs ?? []).filter(
        (t) => t.tab.zoneId === z.id && (scope === 'everyone' || t.tab.assignedTo === session?.staffId),
      ).length,
    })),
  ];

  const loading = tabs === undefined || places === undefined;

  // Build summary MetaLine
  const summaryItems = loading
    ? [{ key: 'loading', text: 'Reading tabs\u2026' }]
    : allScopedTabs.length === 0
      ? [{ key: 'none', text: 'No tabs open' }]
      : [
          { key: 'count', text: `${allScopedTabs.length} open` },
          { key: 'total', text: formatKes(onFloor, { decimals: 'whole' }), mono: true },
          { key: 'floor', text: 'on the floor' },
        ];

  return (
    <div className="relative flex h-full flex-col min-h-0 bg-transparent overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 z-10 border-b border-rule-raised/20 bg-page/85 px-24 pb-16 pt-24 backdrop-blur-md shadow-sm">
        <div className="flex flex-col gap-12 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-x-24">
          <div className="flex flex-col gap-10 tablet:flex-row tablet:items-center tablet:gap-16 min-w-0">
            <div className="flex items-center justify-between gap-12 tablet:w-auto">
              <h1 className="text-heading font-medium tracking-tight text-ink">Tabs</h1>
            </div>
            
            {/* Prominent Stats Pill */}
            <div className="hidden tablet:block h-24 w-px bg-rule-raised/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center rounded-full bg-sunken/80 px-12 py-6 tablet:px-16 border border-rule-raised/30 shadow-inner w-fit max-w-full overflow-hidden">
              <MetaLine items={summaryItems} className="flex-nowrap whitespace-nowrap overflow-hidden text-ellipsis" />
            </div>
          </div>
          <div className="hidden tablet:block shrink-0">
            <Segmented
              label="Whose tabs"
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
        <FilterChips
          label="Zone"
          size="md"
          value={zone}
          onChange={setZone}
          options={zoneOptions}
          className="mt-20 overflow-x-auto no-scrollbar"
        />
      </header>

      {/* ── Workspace: Two Columns ─────────────────────────────────── */}
      <div className="flex flex-col tablet:flex-row flex-1 min-h-0 overflow-y-auto tablet:overflow-y-hidden no-scrollbar">
        
        {/* ── Main Column: Free Tables ─────────────────────────────── */}
        <div className="order-2 tablet:order-1 flex-1 tablet:overflow-y-auto no-scrollbar px-16 tablet:px-24 pb-[160px] tablet:pt-24">
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-16">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="min-h-card-tab rounded-md" />
              ))}
            </div>
          ) : (
            <section aria-labelledby="free-tables-heading">
              <SectionHeader
                id="free-tables-heading"
                title="Free tables"
                count={freeTables.length}
                className="mb-16"
              />
              {freeTables.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-16">
                  {freeTables.map((table) => (
                    <FreeTableCard
                      key={table.id}
                      tableLabel={tableLabel(table)}
                      capacity={table.seats}
                      onOpen={() => setSheet({ open: true, table })}
                    />
                  ))}
                </div>
              ) : zone !== 'all' ? (
                <EmptyState
                  title={`Nothing in ${places?.zones.find((z) => z.id === zone)?.name ?? 'this zone'} right now`}
                  body="Try a different zone or check all zones."
                  action={
                    <Button variant="secondary" size="lg" onClick={() => setZone('all')}>
                      Show all zones
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No free tables"
                  body="All tables are currently occupied."
                  action={
                    <Button
                      variant="secondary"
                      size="lg"
                      icon={IconPlus}
                      onClick={() => setSheet({ open: true, table: null })}
                    >
                      Open a walk-up tab
                    </Button>
                  }
                />
              )}
            </section>
          )}
        </div>

        {/* ── Right Rail: Open Tabs ────────────────────────────────── */}
        <aside className="order-1 tablet:order-2 w-full tablet:w-[360px] shrink-0 tablet:overflow-y-auto no-scrollbar tablet:border-l tablet:border-rule-raised/30 tablet:bg-sunken/30 tablet:shadow-[-1px_0_0_rgba(255,255,255,0.03),-12px_0_40px_-12px_rgba(0,0,0,0.2)] px-16 pb-24 tablet:pb-[160px] pt-24 tablet:backdrop-blur-md">
          {loading ? (
            <div className="flex flex-col gap-12">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="min-h-card-tab rounded-[20px]" />
              ))}
            </div>
          ) : (
            <section aria-labelledby="open-tabs-heading">
              <SectionHeader
                id="open-tabs-heading"
                title="Open tabs"
                count={visibleTabs.length}
                className="mb-16"
              />
              
              {visibleTabs.length > 0 ? (
                <div className="flex flex-col gap-12">
                  {visibleTabs.map((t) => (
                    <TabCard
                      key={t.tab.id}
                      tableLabel={t.label}
                      name={t.tab.name}
                      seats={t.seats.map((s) => ({ seatNo: s.seatNo, settled: s.status === 'settled', hasSpend: false }))}
                      showSeats={t.showSeats}
                      elapsed={formatElapsed(now - t.tab.openedAt)}
                      total={t.total}
                      waiter={t.waiterName}
                      mine={t.tab.assignedTo === session?.staffId}
                      unsentCount={t.unsentCount}
                      ranOutCount={t.ranOutCount}
                      onOpen={() => router.push(`/floor/tabs/${t.tab.id}`)}
                    />
                  ))}
                </div>
              ) : freeTables.length > 0 ? (
                <div className="rounded-[20px] border border-dashed border-rule-raised/40 p-20 text-center">
                  <p className="text-body text-ink-subtle">Tap a free table to start one.</p>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-rule-raised/40 p-20 text-center">
                  <p className="text-body text-ink-subtle">No tabs open.</p>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* ── Base layer action ───────────────────────────────────────── */}
      <BaseAction>
        <Button
          variant="secondary"
          size="xl"
          icon={IconPlus}
          onClick={() => setSheet({ open: true, table: null })}
          className="w-[48px] tablet:w-[260px] h-[48px] tablet:h-auto p-0 tablet:px-24 gap-0 tablet:gap-12 !rounded-full shadow-md !bg-ink !text-page hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.15)] transition-all flex items-center justify-center overflow-hidden"
        >
          <span className="hidden tablet:inline">Open a walk-up tab</span>
        </Button>
      </BaseAction>

      <OpenTabSheet
        open={sheet.open}
        table={sheet.table}
        walkUpZoneId={counterZone}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
