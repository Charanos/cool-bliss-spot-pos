'use client';

import { plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { FilterChips } from '@bliss/ui/components/choice';
import { Skeleton } from '@bliss/ui/components/feedback';
import { SearchField } from '@bliss/ui/components/fields';
import { useNow } from '@bliss/ui/hooks';
import { useListEnter } from '@bliss/ui/motion/floor-hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/app/_pos/chrome';
import { useCounterTabs } from '@/lib/pos/counter-queries';
import { useSeatedTabs, useZonesAndTables } from '@/lib/pos/queries';
import { SeatedTabs } from '@/app/_pos/seated-tabs';
import { Quiet } from '../../_components/parts';
import { CounterTabCard } from '../../_components/tab-card';

/**
 * Every open tab, for the counter to settle. docs/14 section 6.
 *
 * A guest at the counter says "table four", or "Amina's table", or holds up a tab number, so the
 * search takes all three and Ctrl K from anywhere on the Counter lands here with it focused. Zones
 * narrow it the way the Floor's tab list does. Oldest first: the tab that has been open longest is
 * the one most likely to be asking for its bill.
 */
export default function CounterTabsPage() {
  const tabs = useCounterTabs();
  const places = useZonesAndTables();
  const seated = useSeatedTabs();
  const router = useRouter();
  const now = useNow(30_000);
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState('all');
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Arriving from Ctrl K or the top bar's finder puts the cursor in the search.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('find')) search.current?.focus();
  }, []);

  const inZone = useMemo(() => (tabs ?? []).filter((t) => zone === 'all' || t.zoneId === zone), [tabs, zone]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inZone;
    return inZone.filter((t) => t.label.toLowerCase().includes(q) || t.waiter.toLowerCase().includes(q) || String(t.tabNumber ?? '').includes(q));
  }, [inZone, query]);

  useListEnter(list, Boolean(tabs));

  const due = sum((tabs ?? []).map((t) => t.due));
  const toPour = (tabs ?? []).filter((t) => t.waiting > 0).length;
  const zones = (places?.zones ?? []).filter((z) => (tabs ?? []).some((t) => t.zoneId === z.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Tabs"
        facts={
          tabs === undefined
            ? [{ key: 'r', text: 'Reading the floor' }]
            : tabs.length === 0
              ? [{ key: 'n', text: 'Nothing open' }]
              : [
                  { key: 'n', text: `${tabs.length} open` },
                  { key: 'd', text: formatKes(due, { decimals: 'whole' }), mono: true },
                  { key: 'p', text: 'to settle' },
                  toPour > 0 ? { key: 'w', text: `${toPour} still pouring` } : null,
                ]
        }
        aside={
          <div className="w-full pad:w-[300px]">
            <SearchField
              ref={search}
              label="Find a tab"
              hideLabel
              placeholder="Table, waiter or tab number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
          </div>
        }
      >
        {zones.length > 1 ? (
          <FilterChips
            label="Zone"
            size="md"
            value={zone}
            onChange={setZone}
            options={[{ value: 'all', label: 'All zones', count: tabs?.length }, ...zones.map((z) => ({ value: z.id, label: z.name, count: (tabs ?? []).filter((t) => t.zoneId === z.id).length }))]}
            className="overflow-x-auto no-scrollbar"
          />
        ) : null}
      </PageHeader>

      <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
        {!query ? <SeatedTabs tabs={seated ?? []} onOpen={(id) => router.push(`/counter/tabs/${id}`)} /> : null}
        {tabs === undefined ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-12 tablet:gap-16">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="min-h-card-tab rounded-md" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Quiet
            title={query ? 'Nothing matches that' : tabs.length === 0 ? 'No tabs are open' : 'Nothing open in this zone'}
            body={query ? `Nothing open answers to "${query.trim()}". Try the table, the waiter or the tab number.` : 'Tabs opened on the Floor appear here the moment they are opened.'}
          />
        ) : (
          <>
            {query ? <p className="mb-12 text-body-sm text-ink-muted">{plural(shown.length, 'tab')} found</p> : null}
            <div ref={list} className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-12 tablet:gap-16">
              {shown.map((t) => (
                <div key={t.tabId} data-list-item="">
                  <CounterTabCard tab={t} now={now} onOpen={() => router.push(`/counter/tabs/${t.tabId}`)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
