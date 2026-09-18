'use client';

import { FilterChips } from '@bliss/ui/components/choice';
import { EmptyState, Skeleton } from '@bliss/ui/components/feedback';
import { SearchField } from '@bliss/ui/components/fields';
import { ProductTile } from '@bliss/ui/components/floor/product-tile';
import { Dot } from '@bliss/ui/components/status';
import { Button } from '@bliss/ui/components/button';
import { IconLayoutGrid, IconList } from '@tabler/icons-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TileModel } from '@/lib/pos/queries';

interface Grid {
  categories: { id: string; name: string; count: number }[];
  tiles: TileModel[];
  activeRule: string | null;
}

/**
 * The item grid. Switching category and searching are instant: the Floor has deliberately no
 * animation for either, and scroll position is restored per category. docs/07 section 6.
 */
export function ItemGrid({ grid, onAdd, onLongPress }: { grid: Grid | undefined; onAdd: (variantId: string) => void; onLongPress: (variantId: string) => void }) {
  const [category, setCategory] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());

  const visible = useMemo(() => {
    if (!grid) return [];
    return grid.tiles.filter((t) => (category === 'all' || t.categoryId === category));
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
    <section aria-label="Items" className="flex min-h-0 min-w-0 flex-1 flex-col relative z-0">
      <div className="flex shrink-0 items-center gap-12 px-24 py-12 border-b border-hairline/30 relative z-10">
        <FilterChips label="Category" value={category} onChange={changeCategory} options={options} size="md" className="min-w-0 flex-1 overflow-x-auto no-scrollbar" />
        <div className="flex shrink-0 items-center gap-1 rounded-full p-1 bg-sunken/50 border border-rule-raised/30 shadow-inner">
          <button
            type="button"
            className="flex h-[32px] w-[48px] items-center justify-center rounded-full border border-accent/30 bg-accent/15 text-accent-text shadow-[0_2px_8px_-2px_var(--color-accent-subtle),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-transform active:scale-95"
            title="Grid view"
          >
            <IconLayoutGrid size={16} stroke={1.5} />
          </button>
          <button
            type="button"
            className="flex h-[32px] w-[48px] items-center justify-center rounded-full border border-transparent text-ink-subtle transition-all hover:bg-page hover:text-ink hover:border-rule-raised/50 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
            title="List view"
          >
            <IconList size={16} stroke={1.5} />
          </button>
        </div>
      </div>
      {grid?.activeRule ? (
        <p className="flex shrink-0 items-center gap-8 px-16 pt-12 text-body text-accent-text">
          <Dot tone="accent" />
          {grid.activeRule} prices apply now.
        </p>
      ) : null}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-16 relative z-0" onScroll={(e) => positions.current.set(category, e.currentTarget.scrollTop)}>
        {!grid ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-12 pb-24 pt-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-[192px] rounded-[16px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing in this category"
            body="Try looking under another category."
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-12 pb-24 pt-4">
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
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
