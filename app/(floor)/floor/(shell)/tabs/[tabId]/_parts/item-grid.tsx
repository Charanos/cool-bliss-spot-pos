'use client';

import { FilterChips } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { ProductTile } from '@bliss/ui/components/floor/product-tile';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { usePersistentState } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconLayoutGrid, IconList, IconPlus } from '@tabler/icons-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TileModel } from '@/lib/pos/queries';

interface Grid {
  categories: { id: string; name: string; count: number }[];
  tiles: TileModel[];
  activeRule: string | null;
}

type View = 'grid' | 'list';
const VIEWS: readonly View[] = ['grid', 'list'];

/**
 * The item grid. Switching category and searching are instant: the Floor has deliberately no
 * animation for either, and scroll position is restored per category. docs/07 section 6.
 *
 * Two views, because one shape does not fit both devices: tiles with their photograph, which is how
 * a waiter finds a drink they only know by sight, and a list, which fits twice as many rows on a
 * phone and is what someone who knows the menu wants. The choice is remembered per device.
 */
export function ItemGrid({ grid, onAdd, onLongPress, inCart }: { grid: Grid | undefined; onAdd: (variantId: string) => void; onLongPress: (variantId: string) => void; inCart?: ReadonlyMap<string, number> }) {
  const [category, setCategory] = useState('all');
  const [view, setView] = usePersistentState<View>('floor.items.view', 'grid', VIEWS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());

  const visible = useMemo(() => {
    if (!grid) return [];
    return grid.tiles.filter((t) => category === 'all' || t.categoryId === category);
  }, [grid, category]);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = positions.current.get(category) ?? 0;
  }, [category]);

  const changeCategory = (next: string) => {
    if (scrollRef.current) positions.current.set(category, scrollRef.current.scrollTop);
    setCategory(next);
  };

  const options = [{ value: 'all', label: 'All', count: grid?.tiles.length }, ...(grid?.categories ?? []).map((c) => ({ value: c.id, label: c.name, count: c.count }))];

  return (
    <section aria-label="Items" className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative z-10 flex shrink-0 items-center gap-8 border-b border-hairline/30 px-12 py-8 pad:gap-12 pad:px-24 pad:py-12">
        <FilterChips label="Category" value={category} onChange={changeCategory} options={options} size="md" className="min-w-0 flex-1 overflow-x-auto no-scrollbar" />
        <div role="radiogroup" aria-label="How items are shown" className="flex shrink-0 items-center gap-4 rounded-dot border border-rule-raised/30 bg-sunken/50 p-4">
          {(
            [
              { value: 'grid' as const, label: 'Tiles with photographs', icon: IconLayoutGrid },
              { value: 'list' as const, label: 'A compact list', icon: IconList },
            ] satisfies { value: View; label: string; icon: typeof IconList }[]
          ).map((option) => {
            const Glyph = option.icon;
            const selected = view === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                onClick={() => setView(option.value)}
                className={cx(
                  'flex h-control-sm w-40 items-center justify-center rounded-dot press-feedback',
                  selected ? 'bg-accent/15 text-accent-text' : 'text-ink-subtle hover:bg-page hover:text-ink',
                )}
              >
                <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {grid?.activeRule ? (
        <p className="flex shrink-0 items-center gap-8 px-12 pt-12 text-body text-accent-text pad:px-16">
          <Dot tone="accent" />
          {grid.activeRule} prices apply now.
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain p-12 pad:p-16"
        onScroll={(e) => positions.current.set(category, e.currentTarget.scrollTop)}
      >
        {!grid ? (
          <div className="grid grid-cols-2 gap-8 pb-24 pad:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] pad:gap-12">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-[192px] rounded-md" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing in this category" body="Try looking under another category." />
        ) : view === 'list' ? (
          <ul className="flex flex-col pb-24">
            {visible.map((t) => {
              const finished = t.state === 'finished';
              return (
                <li key={t.variantId} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    disabled={finished}
                    onClick={() => onAdd(t.variantId)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onLongPress(t.variantId);
                    }}
                    aria-label={`Add ${t.name}${t.price ? `, ${t.price}` : ''}`}
                    className={cx(
                      'flex min-h-row-floor w-full items-center gap-12 px-4 text-left press-feedback',
                      finished ? 'opacity-40' : 'hover:bg-control active:bg-control-hover',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-lg text-ink">{t.name}</span>
                      {t.state === 'low' || t.state === 'last_few' ? (
                        <span className="caps block text-low">{t.qtyAvailable} left</span>
                      ) : finished ? (
                        <span className="caps block text-ink-subtle">Finished</span>
                      ) : null}
                    </span>
                    {t.price ? <Money value={t.price} size="num" tone={finished ? 'disabled' : 'default'} decimals="whole" /> : null}
                    {(inCart?.get(t.variantId) ?? 0) > 0 ? (
                      // The count replaces the plus once something is on the seat, and bumps as it grows.
                      <span key={inCart!.get(t.variantId)} aria-hidden="true" className="bump flex size-control-md shrink-0 items-center justify-center rounded-sm bg-accent font-mono tabular text-num-sm text-accent-ink">
                        ×{inCart!.get(t.variantId)}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-sm bg-control text-ink">
                        <IconPlus size={18} stroke={ICON_STROKE} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-8 pb-24 pad:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] pad:gap-12">
            {visible.map((t) => (
              <ProductTile
                key={t.variantId}
                variantId={t.variantId}
                name={t.name}
                price={t.price}
                ruled={Boolean(t.ruleName)}
                state={t.state}
                reason={t.reason}
                qtyAvailable={t.qtyAvailable}
                category={t.colour}
                glyph={t.glyph}
                imageUrl={t.imageUrl}
                onAdd={onAdd}
                onLongPress={onLongPress}
                inCart={inCart?.get(t.variantId) ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
