'use client';

import type { Cents } from '@bliss/shared/money';
import { formatKes } from '@bliss/shared/money';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowRight, IconLayoutGrid, IconSearch, IconTag, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { posDb } from '@/lib/pos/db';
import { useOpenTabs } from '@/lib/pos/queries';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ProductResult {
  id: string;
  name: string;
  category: string;
  price: Cents | null;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState<ProductResult[]>([]);
  const tabs = useOpenTabs();

  // Load products for search indexing
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const db = posDb();
        const [prods, variants, cats] = await Promise.all([
          db.products.toArray(),
          db.variants.toArray(),
          db.categories.toArray(),
        ]);
        if (!active) return;
        const catMap = new Map(cats.map((c) => [c.id, c.name]));
        const prodMap = new Map(prods.map((p) => [p.id, p]));
        const results: ProductResult[] = variants.map((v) => {
          const prod = prodMap.get(v.productId);
          return {
            id: v.id,
            name: v.name,
            category: (prod?.categoryId ? catMap.get(prod.categoryId) : undefined) ?? 'Drink',
            price: null,
          };
        });
        setProducts(results);
      } catch {
        // Dexie table might still be syncing
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter tabs and products
  const filteredTabs = useMemo(() => {
    if (!tabs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return tabs.slice(0, 6);
    return tabs.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.waiterName.toLowerCase().includes(q) ||
        (t.table?.label && t.table.label.toLowerCase().includes(q)),
    );
  }, [tabs, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const totalResults = filteredTabs.length + filteredProducts.length;

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (totalResults > 0 ? (i + 1) % totalResults : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (totalResults > 0 ? (i - 1 + totalResults) % totalResults : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredTabs.length) {
        const target = filteredTabs[selectedIndex];
        if (target) {
          router.push(`/floor/tabs/${target.tab.id}`);
          onClose();
        }
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search items, seats, tabs"
      className="fixed inset-0 z-50 flex items-center justify-center p-24"
    >
      {/* Scrim backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 transition-opacity"
        style={{ background: 'var(--color-scrim)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      />

      {/* Search box container */}
      <div
        role="search"
        className="relative z-10 flex w-full max-w-[540px] flex-col overflow-hidden"
        style={{
          borderRadius: '24px',
          border: '1px solid color-mix(in oklab, var(--color-glint) 9%, transparent)',
          backgroundColor: 'color-mix(in oklab, var(--color-sunken) 92%, transparent)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow: 'var(--shadow-popover), inset 0 1px 0 color-mix(in oklab, var(--color-glint) 10%, transparent)',
        }}
      >
        {/* Search input bar */}
        <div className="flex h-[64px] items-center gap-12 px-20" style={{ borderBottom: '1px solid color-mix(in oklab, var(--color-glint) 6%, transparent)' }}>
          <IconSearch size={20} stroke={ICON_STROKE} className="shrink-0 text-ink-subtle" />
          <input
            onKeyDown={handleKeyDown}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search items, seats, tabs..."
            className="h-full flex-1 bg-transparent text-body font-medium text-ink placeholder:text-ink-disabled focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="flex size-[32px] items-center justify-center rounded-full text-ink-subtle hover:text-ink press-feedback transition-colors"
              style={{ background: 'color-mix(in oklab, var(--color-glint) 6%, transparent)' }}
            >
              <IconX size={15} stroke={ICON_STROKE} />
            </button>
          ) : (
            <kbd className="rounded-full border border-rule-raised/50 bg-control/30 px-8 py-2 font-mono text-micro text-ink-muted">
              ESC
            </kbd>
          )}
        </div>

        {/* Results scroll area */}
        <div className="max-h-[380px] overflow-y-auto p-8">
          {totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <IconSearch size={32} stroke={1.5} className="mb-8 text-ink-disabled" />
              <p className="text-body font-medium text-ink-muted">No results found</p>
              <p className="mt-4 text-body-sm text-ink-subtle">
                Try searching for a table label, waiter, or drink name
              </p>
            </div>
          ) : null}

          {/* Open Tabs group */}
          {filteredTabs.length > 0 ? (
            <div className="mb-12">
              <div className="px-8 py-4 font-mono text-caps text-ink-subtle">
                Open Tabs ({filteredTabs.length})
              </div>
              <div className="flex flex-col gap-2">
                {filteredTabs.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.tab.id}
                      type="button"
                      onClick={() => {
                        router.push(`/floor/tabs/${item.tab.id}`);
                        onClose();
                      }}
                      className={cx(
                        'flex w-full items-center justify-between rounded-md px-12 py-8 text-left transition-colors press-feedback',
                        isSelected ? 'bg-accent-wash text-accent-text' : 'text-ink hover:bg-control/60',
                      )}
                    >
                      <div className="flex items-center gap-12 min-w-0">
                        <div
                          className={cx(
                            'flex size-control-sm items-center justify-center rounded-md',
                            isSelected ? 'bg-accent text-accent-ink' : 'bg-control text-ink-subtle',
                          )}
                        >
                          <IconLayoutGrid size={18} stroke={ICON_STROKE} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-body font-medium">{item.label}</div>
                          <div className="truncate text-body-sm text-ink-subtle">
                            {item.waiterName ? `${item.waiterName} · ` : ''}
                            {item.seats.length} {item.seats.length === 1 ? 'seat' : 'seats'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-12 shrink-0">
                        <span className="font-mono tabular text-body font-medium text-money">
                          {formatKes(item.total)}
                        </span>
                        <IconArrowRight size={16} stroke={ICON_STROKE} className="text-ink-disabled" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Products / Menu Items group */}
          {filteredProducts.length > 0 ? (
            <div>
              <div className="px-8 py-4 font-mono text-caps text-ink-subtle">
                Menu Items ({filteredProducts.length})
              </div>
              <div className="flex flex-col gap-2">
                {filteredProducts.map((item, idx) => {
                  const itemIndex = filteredTabs.length + idx;
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      className={cx(
                        'flex w-full items-center justify-between rounded-md px-12 py-8 text-left transition-colors',
                        isSelected ? 'bg-accent-wash text-accent-text' : 'text-ink',
                      )}
                    >
                      <div className="flex items-center gap-12 min-w-0">
                        <div className="flex size-control-sm items-center justify-center rounded-md bg-control text-ink-subtle">
                          <IconTag size={18} stroke={ICON_STROKE} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-body font-medium">{item.name}</div>
                          <div className="truncate text-body-sm text-ink-subtle">{item.category}</div>
                        </div>
                      </div>
                      {item.price !== null ? (
                        <span className="font-mono tabular text-body text-ink-muted">
                          {formatKes(item.price)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer shortcuts helper */}
        <div
          className="flex items-center justify-between px-20 py-12 font-mono text-micro text-ink-disabled"
          style={{ borderTop: '1px solid color-mix(in oklab, var(--color-glint) 5%, transparent)' }}
        >
          <div className="flex items-center gap-16">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Dismiss</span>
          </div>
          <span className="text-ink-disabled">Bliss</span>
        </div>
      </div>
    </div>
  );
}
