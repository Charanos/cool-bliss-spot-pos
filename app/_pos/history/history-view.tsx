'use client';

import { formatDayShort, formatIsoDate, formatTime, formatWeekday, plural } from '@bliss/shared/format';
import { type Cents, formatKes, isPositive, shareBps, sum } from '@bliss/shared/money';
import { addDays, businessDate } from '@bliss/shared/time';
import { HISTORY_MAX_DAYS, HISTORY_PRESETS, type HistoryDay, type HistoryPreset, type HistoryResult, type HistoryTab, historyRange, matchPreset } from '@bliss/shared/trade';
import { Button } from '@bliss/ui/components/button';
import { FilterChips, Segmented } from '@bliss/ui/components/choice';
import { EmptyState, InlineNotice, Skeleton } from '@bliss/ui/components/feedback';
import { SearchField, TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { MetricTile } from '@bliss/ui/components/metric-tile';
import { Money } from '@bliss/ui/components/money';
import { Spinner } from '@bliss/ui/components/spinner';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconBan, IconBeer, IconCloudOff, IconLock, IconReceipt, IconRefresh, IconUsers } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../chrome';
import { TENDER_FILL, TENDER_WORD } from '../tenders';
import { META, getMeta } from '@/lib/pos/db';
import { useHistory } from '@/lib/pos/history';
import { useOutlet } from '@/lib/pos/queries';
import { useSync } from '@/lib/pos/sync';
import { SaleRecord, TabRecord } from './records';

/**
 * History, for the Floor and the Counter. docs/16 section 9.
 *
 * Every tab of the night, active and done, and every night before it: what was fired, what was
 * poured and taken to the table, what was voided and why, how each bill was paid and when the
 * table was cleared. A range is one tap (tonight, yesterday, this week, this month, last month) or
 * two dates; search takes a table, a waiter, a tab number or an item.
 *
 * The Floor opens on the waiter's own tabs, the Counter on what was settled at this till, and both
 * can widen to everyone. The blind count holds: with a drawer open on this device, tonight's
 * takings and the split by tender stay off the screen.
 */

type Scope = 'own' | 'everyone';
type Show = 'all' | 'active' | 'done' | 'voided' | 'sales';

const PAGE = 40;

export interface HistoryViewProps {
  surface: 'floor' | 'counter';
  /** The person signed in, for the Floor's "Mine". */
  staffId?: string | null;
  onOpenTab?: (tabId: string) => void;
}

function dayName(date: string, current: string): string {
  if (date === current) return 'Tonight';
  if (date === addDays(current, -1)) return 'Yesterday';
  return formatWeekday(date);
}

function rangeName(preset: HistoryPreset, from: string, to: string): string {
  const named = HISTORY_PRESETS.find((p) => p.value === preset);
  if (from === to) return `${named ? `${named.label} · ` : ''}${formatDayShort(from)}`;
  return `${named ? `${named.label} · ` : ''}${formatDayShort(from)} to ${formatDayShort(to)}`;
}

function dayTakings(day: HistoryDay): Cents {
  return sum([...day.tabs.filter((t) => t.state !== 'voided' && t.state !== 'merged').map((t) => t.paidCents), ...day.sales.map((s) => s.bill.totalCents)]);
}

const isActive = (t: HistoryTab) => t.state === 'ordering' || t.state === 'seated';

export function HistoryView({ surface, staffId, onOpenTab }: HistoryViewProps) {
  const outlet = useOutlet();
  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const now = useNow(30_000);
  const sync = useSync();
  const synced = useLiveQuery(() => getMeta<string>(META.businessDate), []);
  const [served, setServed] = useState<string | null>(null);
  // Tonight as the server last said it, then as this device last synced it, then by the clock.
  const current = served ?? synced ?? businessDate(now, tz, outlet?.cutover);

  const [preset, setPreset] = useState<HistoryPreset>('tonight');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [scope, setScope] = useState<Scope>('own');
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const search = useRef<HTMLInputElement>(null);

  const range = preset === 'custom' && custom ? custom : historyRange(preset === 'custom' ? 'tonight' : preset, current);
  const params = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      staffId: surface === 'floor' && scope === 'own' ? (staffId ?? null) : null,
      thisDevice: surface === 'counter' && scope === 'own',
      q: query,
    }),
    [range.from, range.to, surface, scope, staffId, query],
  );
  const { state, refresh } = useHistory(surface === 'floor' && scope === 'own' && !staffId ? null : params);
  const data = state.status === 'ready' || state.status === 'saved' ? state.data : null;

  useEffect(() => {
    if (data && data.currentBusinessDate !== served) setServed(data.currentBusinessDate);
  }, [data, served]);

  // A new range, scope or search starts from the top of the list again.
  useEffect(() => setLimit(PAGE), [params]);

  // "/" finds, as it does across the Counter; never while typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choosePreset = (next: HistoryPreset) => {
    if (next === 'custom') setCustom(custom ?? { from: range.from, to: range.to });
    setPreset(next);
  };
  const setCustomDate = (edge: 'from' | 'to', value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const next = { ...(custom ?? range), [edge]: value > current ? current : value };
    if (next.from > next.to) {
      if (edge === 'from') next.to = next.from;
      else next.from = next.to;
    }
    setCustom(next);
    // Two dates that make a named range read as it.
    const named = matchPreset(next.from, next.to, current);
    if (named !== 'custom') setPreset(named);
  };

  const days = useMemo(() => data?.days ?? [], [data]);
  const filtered = useMemo(
    () =>
      days
        .map((d) => ({
          ...d,
          tabs: show === 'sales' ? [] : d.tabs.filter((t) => (show === 'active' ? isActive(t) : show === 'done' ? t.state === 'cleared' : show === 'voided' ? t.state === 'voided' || t.lines.some((l) => l.status === 'voided') : true)),
          sales: show === 'all' || show === 'sales' ? d.sales : [],
        }))
        .filter((d) => d.tabs.length + d.sales.length > 0),
    [days, show],
  );
  const counts = useMemo(() => {
    const tabs = days.flatMap((d) => d.tabs);
    return {
      all: tabs.length + days.reduce((n, d) => n + d.sales.length, 0),
      active: tabs.filter(isActive).length,
      done: tabs.filter((t) => t.state === 'cleared').length,
      voided: tabs.filter((t) => t.state === 'voided' || t.lines.some((l) => l.status === 'voided')).length,
      sales: days.reduce((n, d) => n + d.sales.length, 0),
    };
  }, [days]);

  const shownCount = filtered.reduce((n, d) => n + d.tabs.length + d.sales.length, 0);
  let budget = limit;

  const scopeOptions =
    surface === 'floor'
      ? [
          { value: 'own' as const, label: 'Mine' },
          { value: 'everyone' as const, label: 'Everyone' },
        ]
      : [
          { value: 'own' as const, label: 'This counter' },
          { value: 'everyone' as const, label: 'Whole outlet' },
        ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="History"
        facts={[
          { key: 'r', text: rangeName(preset, range.from, range.to) },
          state.status === 'loading'
            ? { key: 's', text: 'Reading the record' }
            : state.status === 'unavailable'
              ? { key: 's', text: 'Not loaded' }
              : state.refreshing
                ? { key: 's', text: 'Updating' }
                : { key: 's', text: `${state.status === 'saved' ? 'Saved' : 'Updated'} ${formatTime(state.fetchedAt, tz)}`, mono: true },
        ]}
        aside={
          <div className="flex w-full items-center gap-8 pad:w-auto">
            <div className="min-w-0 flex-1 pad:w-[280px] pad:flex-none">
              <SearchField ref={search} label="Search history" hideLabel placeholder="Table, waiter, tab or item" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} />
            </div>
            <Button
              variant="ghost"
              size="md"
              iconOnly
              icon={state.status !== 'loading' && state.status !== 'unavailable' && state.refreshing ? undefined : IconRefresh}
              aria-label="Read the record again"
              onClick={refresh}
            >
              {state.status !== 'loading' && state.status !== 'unavailable' && state.refreshing ? <Spinner size={16} /> : null}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-8 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-16">
          <FilterChips
            label="Range"
            size="md"
            value={preset}
            onChange={choosePreset}
            options={[...HISTORY_PRESETS, { value: 'custom' as const, label: 'Pick dates' }]}
            className="-mx-12 overflow-x-auto px-12 no-scrollbar pad:mx-0 pad:px-0"
          />
          <Segmented label="Whose" size="sm" value={scope} onChange={setScope} options={scopeOptions} className="self-start tablet:self-auto" />
        </div>
        {preset === 'custom' ? (
          <div className="mt-12 flex max-w-[480px] items-end gap-12">
            <TextField label="From" type="date" size="md" value={custom?.from ?? range.from} min={addDays(current, 1 - HISTORY_MAX_DAYS)} max={current} onChange={(e) => setCustomDate('from', e.target.value)} frameClassName="flex-1" />
            <TextField label="To" type="date" size="md" value={custom?.to ?? range.to} min={addDays(current, 1 - HISTORY_MAX_DAYS)} max={current} onChange={(e) => setCustomDate('to', e.target.value)} frameClassName="flex-1" />
          </div>
        ) : null}
      </PageHeader>

      <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
        <div className="flex flex-col gap-16 tablet:gap-24">
          {state.status === 'saved' && !state.refreshing ? (
            <div className="flex items-start gap-12 rounded-[18px] border border-low/30 bg-low/[0.08] px-16 py-12">
              <IconCloudOff size={18} stroke={ICON_STROKE} aria-hidden="true" className="mt-2 shrink-0 text-low" />
              <p className="min-w-0 flex-1 text-body-sm text-ink">
                Saved on this device at {formatTime(state.fetchedAt, tz)}. The record could not be read just now, so anything since then is not shown.
              </p>
              <Button variant="ghost" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : null}

          {sync.heldOrders + sync.unsentLines > 0 && range.to >= current ? (
            <p className="flex items-center gap-8 text-body-sm text-ink-muted">
              <Spinner size={16} />
              {sync.heldOrders > 0 ? plural(sync.heldOrders, 'order') : plural(sync.unsentLines, 'line')} on this device not in the record yet. They join it once sent.
            </p>
          ) : null}

          {state.status === 'loading' ? (
            <Loading />
          ) : state.status === 'unavailable' ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <EmptyState align="center" title="History did not load" body={state.message} action={<Button variant="secondary" size="md" icon={IconRefresh} onClick={refresh}>Try again</Button>} />
            </div>
          ) : (
            <>
              <Summary data={state.data} surface={surface} />

              {counts.all > 0 ? (
                <FilterChips
                  label="Show"
                  size="sm"
                  value={show}
                  onChange={setShow}
                  options={[
                    { value: 'all', label: 'Everything', count: counts.all },
                    { value: 'active', label: 'Active', count: counts.active },
                    { value: 'done', label: 'Cleared', count: counts.done },
                    { value: 'voided', label: 'With voids', count: counts.voided },
                    ...(counts.sales > 0 ? [{ value: 'sales' as const, label: 'Quick sales', count: counts.sales }] : []),
                  ]}
                  className="-mx-12 overflow-x-auto px-12 no-scrollbar pad:mx-0 pad:px-0"
                />
              ) : null}

              {state.data.truncated ? (
                <InlineNotice tone="low">The newest {plural(counts.all, 'record')} are shown. Narrow the range or search to see the rest.</InlineNotice>
              ) : null}

              {filtered.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <EmptyState
                    align="center"
                    title={query.trim() ? 'Nothing matches that' : counts.all > 0 ? 'Nothing of that kind' : 'Nothing in this range'}
                    body={
                      query.trim()
                        ? `Nothing in ${rangeName(preset, range.from, range.to).toLowerCase()} answers to "${query.trim()}". Try the table, the waiter, the tab number or an item.`
                        : counts.all > 0
                          ? 'Everything in this range is under another filter.'
                          : scope === 'own'
                            ? `Nothing ${surface === 'floor' ? 'of yours' : 'settled at this counter'} in this range. Everyone shows the whole outlet.`
                            : 'No tab was opened and nothing was sold in this range.'
                    }
                    action={
                      scope === 'own' && counts.all === 0 && !query.trim() ? (
                        <Button variant="secondary" size="md" icon={IconUsers} onClick={() => setScope('everyone')}>
                          Show everyone
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-16">
                  {filtered.map((day) => {
                    if (budget <= 0) return null;
                    const entries = [
                      ...day.tabs.map((t) => ({ at: t.openedAt, key: t.id, node: <TabRecord key={t.id} tab={t} tz={tz} now={now} staffId={staffId} onOpen={onOpenTab} /> })),
                      ...day.sales.map((s) => ({ at: s.bill.settledAt ?? 0, key: s.bill.id, node: <SaleRecord key={s.bill.id} sale={s} tz={tz} /> })),
                    ]
                      .sort((a, b) => b.at - a.at)
                      .slice(0, budget);
                    budget -= entries.length;
                    const heldBack = state.data.summary.withheld && day.businessDate === state.data.currentBusinessDate;
                    const poured = day.tabs.reduce((n, t) => n + t.lines.filter((l) => l.status === 'served').reduce((q, l) => q + l.qty, 0), 0);
                    return (
                      <section key={day.businessDate} aria-label={`${dayName(day.businessDate, state.data.currentBusinessDate)}, ${formatIsoDate(day.businessDate)}`}>
                        <header className="sticky top-0 z-[1] -mx-12 mb-8 flex items-baseline justify-between gap-12 bg-page/85 px-12 py-8 backdrop-blur-glass pad:top-[-24px] pad:-mx-24 pad:px-24">
                          <h2 className="flex min-w-0 items-baseline gap-8">
                            <span className="text-title text-ink">{dayName(day.businessDate, state.data.currentBusinessDate)}</span>
                            <span className="truncate font-mono text-micro text-ink-subtle">{formatIsoDate(day.businessDate)}</span>
                          </h2>
                          <span className="flex shrink-0 items-baseline gap-12 text-body-sm text-ink-muted">
                            <span className="hidden compact:inline">
                              {plural(day.tabs.length, 'tab')} · {poured} poured
                            </span>
                            {heldBack ? <IconLock size={14} stroke={ICON_STROKE} aria-label="Takings held back while the drawer is open" className="self-center text-ink-subtle" /> : <Money value={dayTakings(day)} size="num-sm" tone="muted" decimals="whole" />}
                          </span>
                        </header>
                        <ul className="flex flex-col gap-8">{entries.map((e) => e.node)}</ul>
                      </section>
                    );
                  })}
                  {shownCount > limit ? (
                    <div className="flex justify-center pt-8">
                      <Button variant="secondary" size="lg" onClick={() => setLimit((l) => l + PAGE)}>
                        Show {Math.min(PAGE, shownCount - limit)} more of {shownCount - limit}
                      </Button>
                    </div>
                  ) : shownCount > PAGE ? (
                    <p className="text-center text-body-sm text-ink-subtle">That is everything in this range.</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true" aria-label="Reading the record">
      <div className="grid grid-cols-2 gap-8 pad:gap-16 desktop:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-md pad:rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-[160px]" />
      <div className="flex flex-col gap-8">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-row-floor rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}

function Summary({ data, surface }: { data: HistoryResult; surface: 'floor' | 'counter' }) {
  const s = data.summary;
  const split = s.byTender?.filter((t) => isPositive(t.amountCents)) ?? [];
  const total = sum(split.map((t) => t.amountCents));
  return (
    <section aria-label="This range at a glance" className="flex flex-col gap-8 pad:gap-12">
      <div className="grid grid-cols-2 gap-8 pad:gap-16 desktop:grid-cols-4">
        <MetricTile
          label="Takings"
          icon={s.withheld ? IconLock : IconReceipt}
          tone="money"
          value={s.takingsCents === null ? <span className="text-title text-ink-subtle">Held back</span> : <Money value={s.takingsCents} size="num-lg" tone="money" decimals="whole" />}
          subtitle={s.withheld ? 'Shows once this drawer is closed' : s.averageTabCents ? `${formatKes(s.averageTabCents, { decimals: 'whole' })} a paid tab` : 'Nothing paid yet'}
        />
        <MetricTile label="Tabs" icon={IconUsers} tone="accent" value={<span className="font-mono tabular text-num-lg text-ink">{s.tabs}</span>} subtitle={plural(s.guests, 'guest')} />
        <MetricTile label="Poured" icon={IconBeer} tone="poured" value={<span className="font-mono tabular text-num-lg text-ink">{s.itemsPoured}</span>} subtitle={`${plural(s.linesFired, 'line')} fired`} />
        <MetricTile
          label="Voided"
          icon={IconBan}
          tone={s.voided > 0 ? 'stop' : 'neutral'}
          value={<span className="font-mono tabular text-num-lg text-ink">{s.voided}</span>}
          subtitle={surface === 'counter' || s.quickSales > 0 ? `${s.quickSales} quick ${s.quickSales === 1 ? 'sale' : 'sales'}` : s.voided === 0 ? 'Nothing taken back' : 'Each with its reason'}
        />
      </div>

      {split.length > 0 && isPositive(total) ? (
        <div className="rounded-[18px] border border-rule-raised/40 bg-raised/60 px-16 py-12 backdrop-blur-glass">
          <div className="flex h-8 w-full gap-2 overflow-hidden rounded-dot" role="img" aria-label={split.map((t) => `${TENDER_WORD[t.kind]} ${formatKes(t.amountCents, { decimals: 'whole' })}`).join(', ')}>
            {split.map((t) => (
              <span key={t.kind} className={cx('h-full min-w-[4px] first:rounded-l-dot last:rounded-r-dot', TENDER_FILL[t.kind])} style={{ flexGrow: Math.max(1, shareBps(t.amountCents, total)) }} />
            ))}
          </div>
          <ul className="mt-12 flex flex-wrap gap-x-20 gap-y-8">
            {split.map((t) => (
              <li key={t.kind} className="flex items-center gap-8 text-body-sm text-ink-muted">
                <span aria-hidden="true" className={cx('size-dot rounded-dot', TENDER_FILL[t.kind])} />
                {TENDER_WORD[t.kind]}
                <Money value={t.amountCents} size="num-sm" decimals="whole" />
                <span className="font-mono text-micro text-ink-subtle">{Math.round(shareBps(t.amountCents, total) / 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

