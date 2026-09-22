'use client';

import { SeatChipStack, CountBadge } from '@bliss/ui/components/working';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconMap2, IconPlus, IconClipboardList } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import Link from 'next/link';
import { useState } from 'react';
import type { TabListItem } from '@/lib/pos/queries';
import { useZonesAndTables } from '@/lib/pos/queries';

/**
 * Production-grade Left Rail Sidebar (180px width).
 *
 * Uses design-system primitives only:
 * - Zone active: accent dot indicator (distinctly different from tab active bar).
 * - Tab active: texture-dots-accent background + left accent bar + accent/30 border.
 * - Borders: border-rule-raised, border-accent/30, border-rule primitives only.
 * - Typography: caps utility for section eyebrows.
 */
export function TablesRail({
  tabs,
  currentTabId,
  currentZoneId,
  staffId,
  selectedSeatId,
}: {
  tabs: TabListItem[];
  currentTabId: string;
  currentZoneId: string | null;
  staffId: string;
  selectedSeatId?: string | null;
}) {
  const places = useZonesAndTables();
  const [zone, setZone] = useState<string | 'all'>('all');
  const mine = tabs.filter((t) => t.tab.assignedTo === staffId);
  const shown = mine.filter((t) => zone === 'all' || t.tab.zoneId === zone);

  const allZones = [{ id: 'all', name: 'All zones' }, ...(places?.zones ?? [])];

  return (
    <aside
      aria-label="Zones and my tabs"
      className="hidden tablet:flex min-h-0 w-rail-tables shrink-0 flex-col bg-page/60 border-r border-rule shadow-[2px_0_20px_-4px_rgba(0,0,0,0.4)] relative z-10 select-none"
    >
      {/* ── 1. Zone filter section ──────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-12">
        {/* Section eyebrow */}
        <div className="flex items-center justify-between px-8 pb-8">
          <span className="caps text-ink-subtle/70 flex items-center gap-4">
            <IconMap2 size={11} stroke={2} className="text-accent/70" aria-hidden="true" />
            Zones
          </span>
        </div>

        {/* Zone switcher buttons */}
        <nav aria-label="Zones" className="flex flex-col gap-2">
          {allZones.map((z) => {
            const selected = zone === z.id;
            const count = z.id === 'all' ? mine.length : mine.filter((t) => t.tab.zoneId === z.id).length;
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setZone(z.id)}
                className={cx(
                  'group relative flex h-[34px] w-full items-center justify-between gap-8 rounded-lg px-8 text-left text-body-sm transition-all duration-150 ease-out press-feedback',
                  selected
                    ? 'bg-control font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_-2px_rgba(0,0,0,0.35)]'
                    : 'text-ink-muted hover:bg-control-hover/40 hover:text-ink',
                )}
              >
                <span className="truncate">
                  {z.name}
                  {z.id === currentZoneId ? <span className="sr-only">, current zone</span> : null}
                </span>

                {/* Count */}
                <span
                  className={cx(
                    'font-mono tabular text-num-sm shrink-0 transition-colors',
                    selected ? 'text-accent' : 'text-ink-subtle/60 group-hover:text-ink-subtle',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Fade-out hairline divider (design-system primitive) ─────── */}
      <div className="rule-fade-x mx-8 my-16" aria-hidden="true" />

      {/* ── 2. My tabs section ──────────────────────────────────────── */}
      <div className="shrink-0 px-8">
        <div className="flex items-center justify-between px-8 pb-8">
          <span className="caps text-ink-subtle/70 flex items-center gap-4">
            <IconClipboardList size={11} stroke={2} className="text-attention/70" aria-hidden="true" />
            My tabs
          </span>
          {mine.length > 0 ? (
            <CountBadge count={mine.length} tone="attention" />
          ) : null}
        </div>
      </div>

      {/* Scrollable Tab cards list */}
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pb-8 pt-2 flex flex-col gap-4 no-scrollbar">
        {shown.map((t) => {
          const current = t.tab.id === currentTabId;
          return (
            <li key={t.tab.id}>
              <Link
                href={`/floor/tabs/${t.tab.id}`}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  // Base layout
                  'group relative overflow-hidden flex min-h-[66px] flex-col justify-center gap-6 rounded-[16px] p-12 my-2 transition-all duration-150 ease-out press-feedback',
                  current
                    ? 'bg-accent-wash texture-dots-accent border border-accent/30 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-control/50 hover:bg-control border border-rule-raised/40 hover:border-rule-raised hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)] hover:-translate-y-px',
                )}
              >
                {/* Header row: Table label & total */}
                <span className="flex items-baseline justify-between gap-6">
                  <span
                    className={cx(
                      'truncate text-body-sm ',
                      current ? 'font-medium text-ink' : 'font-medium text-ink-muted group-hover:text-ink',
                    )}
                  >
                    {t.label}
                  </span>
                  <Money
                    value={t.total}
                    size="num-sm"
                    currency={false}
                    decimals="whole"
                    className={cx(
                      'font-mono tabular shrink-0 transition-colors',
                      current
                        ? 'text-accent-text'
                        : 'text-ink-subtle group-hover:text-ink-muted',
                    )}
                  />
                </span>

                {/* Seat chips */}
                {t.showSeats ? (
                  <span className="flex items-center justify-between">
                    <SeatChipStack
                      seats={t.seats.map((s) => ({
                        seatNo: s.seatNo,
                        status: s.status,
                        settled: s.status === 'settled',
                        label: s.label,
                        selected: current && selectedSeatId === s.id,
                      }))}
                      max={7}
                      size="tile"
                      overlapping
                    />
                    {t.unsentCount > 0 ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-attention shadow-[0_0_6px_var(--color-attention)]"
                        title={`${t.unsentCount} unsent lines`}
                        aria-label={`${t.unsentCount} unsent lines`}
                      />
                    ) : null}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}

        {shown.length === 0 ? (
          <li className="px-8 py-16 text-center rounded-lg border border-rule bg-page/20">
            <p className="caps text-ink-subtle">No tabs in this zone</p>
          </li>
        ) : null}
      </ul>

      {/* ── 3. Bottom Action: Open tab ──────────────────────────────── */}
      <div className="shrink-0 px-8 py-8 border-t border-rule">
        <Link
          href="/floor/tabs"
          className="flex h-[36px] w-full items-center justify-center gap-6 rounded-lg border border-rule-raised/60 bg-control/60 hover:bg-control hover:border-accent/40 hover:text-accent text-ink-subtle text-body-sm font-medium transition-all duration-150 active:scale-[0.98] press-feedback"
        >
          <IconPlus size={14} stroke={ICON_STROKE} className="transition-colors" aria-hidden="true" />
          <span>Open tab</span>
        </Link>
      </div>
    </aside>
  );
}
