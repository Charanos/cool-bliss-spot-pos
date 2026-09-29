'use client';

import { isCounted } from '@bliss/shared/availability';
import type { AvailabilityReason, AvailabilityState } from '@bliss/shared/domain';
import { type Cents, formatKes } from '@bliss/shared/money';
import { IconBottle, IconBowlChopsticks, IconBeer, IconGlassCocktail, IconGlassFull, IconBottleFilled, IconPlus } from '@tabler/icons-react';
import { memo, useRef } from 'react';
import { useLongPress } from '../../hooks';
import { cx } from '../../lib/cx';
import { type CategoryColour } from '../../lib/seat';
import { tilePressDown, tilePressUp } from '../../motion/floor';
import { Money } from '../money';
import { Photo } from '../photo';

export type TileGlyph = 'beer' | 'spirit' | 'wine' | 'soft' | 'food' | 'bottle';

/** The category's colour, from the seat palette the category edge also uses (lib/seat). */
const CATEGORY_COLOR: Record<CategoryColour, string> = {
  glacier: 'var(--color-seat-1)',
  ember: 'var(--color-seat-2)',
  leaf: 'var(--color-seat-3)',
  iris: 'var(--color-seat-4)',
  rose: 'var(--color-seat-5)',
  steel: 'var(--color-seat-6)',
  brass: 'var(--color-seat-7)',
  jade: 'var(--color-seat-8)',
};

const GLYPH = {
  beer: IconBeer,
  spirit: IconGlassCocktail,
  wine: IconGlassFull,
  soft: IconBottle,
  food: IconBowlChopsticks,
  bottle: IconBottleFilled,
} as const;

export interface ProductTileProps {
  variantId: string;
  name: string;
  price: Cents | null;
  /** The price came from a time rule, such as happy hour. The grid header names the rule. */
  ruled?: boolean;
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  qtyAvailable: number;
  category: CategoryColour;
  glyph: TileGlyph;
  imageUrl: string | null;
  onAdd: (variantId: string) => void;
  onLongPress: (variantId: string) => void;
  /**
   * How many of this item are already on the current seat's draft, or in the counter's cart. A tap
   * that lands shows here at once: the count bumps and a ring ripples out of the tile.
   */
  inCart?: number;
}

/**
 * The product tile, the most tapped object in the system. docs/06-design-system.md section 6.3.
 *
 * Photograph-led: the item's picture fills the top of the tile, with the stock over its corner, and
 * the name on two lines, the price and the add mark beneath. The whole
 * tile is the target; press feedback runs before any state change; the tap adds the line locally.
 *
 *   available  "12 in stock" over the photograph's corner, quiet, for anything kept in stock
 *   low        "3 left" in the corner, attention colour
 *   last_few   the same, stronger
 *   finished   dimmed, one word in the corner ("Finished", "On hold"), not tappable, still focusable
 *
 * An edge you can see on every profile, and no hover lift on touch, so nothing jumps under a finger.
 */
export const ProductTile = memo(function ProductTile({ variantId, name, price, ruled, state, reason, qtyAvailable, category, glyph, imageUrl, onAdd, onLongPress, inCart = 0 }: ProductTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const finished = state === 'finished';
  const held = finished && reason === 'hold';
  const uncounted = finished && reason === 'not_counted';
  const low = state === 'low' || state === 'last_few';
  const count = Math.max(0, Math.floor(qtyAvailable));
  // Only an item kept in stock has a count to show: food and the like report more than any shelf holds.
  const counted = isCounted(qtyAvailable);

  const press = useLongPress({
    onPressStart: () => ref.current && !finished && tilePressDown(ref.current),
    onPressEnd: () => ref.current && !finished && tilePressUp(ref.current),
    onPress: () => {
      if (!finished) onAdd(variantId);
    },
    onLongPress: () => onLongPress(variantId),
  });

  const stateWords = finished ? (held ? ', on hold' : uncounted ? ', not counted yet' : ', finished') : low ? `, ${count} left` : counted ? `, ${count} in stock` : '';
  const Glyph = GLYPH[glyph];
  const tint = CATEGORY_COLOR[category] ?? 'var(--color-ink-subtle)';

  return (
    <button
      ref={ref}
      type="button"
      {...press}
      aria-disabled={finished || undefined}
      aria-label={`${name}${price ? `, ${formatKes(price)}` : ''}${stateWords}${inCart > 0 ? `, ${inCart} added` : ''}`}
      data-variant-id={variantId}
      className={cx(
        'group relative flex h-tile-photo min-w-0 flex-col overflow-hidden rounded-card border bg-raised text-left transition-colors duration-150',
        inCart > 0 ? 'border-accent/60' : 'border-rule',
        finished ? 'cursor-default' : 'mouse:hover:border-hairline active:bg-control-hover',
      )}
    >
      {inCart > 0 ? <span key={`ring-${inCart}`} aria-hidden="true" className="flash pointer-events-none absolute inset-0 z-10 rounded-card" /> : null}

      {/* The photograph, edge to edge; a tinted plate with the category's mark when there is none. */}
      <span className={cx('relative block min-h-0 flex-1 overflow-hidden', finished && 'opacity-45 grayscale')}>
        <Photo
          src={imageUrl}
          className="absolute inset-0 size-full object-cover transition-transform duration-200 mouse:group-hover:scale-105"
          fallback={
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={{ color: tint }}>
              <span className="absolute inset-0" style={{ backgroundColor: tint, opacity: 0.14 }} />
              <Glyph size={40} stroke={1.25} className="relative" />
            </span>
          }
        />
        {/* A soft foot so the corner labels read over any photograph. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-scrim/40 to-transparent" />
      </span>

      {/* What the tile says about stock, over the photograph's corner. */}
      <span className="pointer-events-none absolute right-6 top-6 flex max-w-full">
        {finished ? (
          <span className="rounded-pill bg-page/85 px-8 py-2 text-caps caps text-ink-muted">{held ? 'On hold' : uncounted ? 'Not counted' : 'Finished'}</span>
        ) : low ? (
          <span className={cx('rounded-pill px-8 py-2 font-mono tabular text-num-sm', state === 'last_few' ? 'bg-low text-page' : 'bg-page/85 text-low')}>{count} left</span>
        ) : counted ? (
          <span className="rounded-pill bg-page/80 px-8 py-2 font-mono tabular text-micro text-ink-muted">{count} in stock</span>
        ) : null}
      </span>

      <span className={cx('flex shrink-0 flex-col gap-4 px-12 pb-12 pt-8', finished && 'opacity-45')}>
        <span className="line-clamp-2 min-h-[2.5em] text-ui font-medium text-ink" title={name}>
          {name}
        </span>
        <span className="flex items-center justify-between gap-8">
          {price ? <Money value={price} size="num" tone={ruled ? 'accent' : finished ? 'disabled' : 'default'} decimals="whole" /> : <span className="text-body-sm text-ink-subtle">No price</span>}
          {inCart > 0 ? (
            <span key={`count-${inCart}`} aria-hidden="true" className="bump flex h-24 min-w-24 items-center justify-center rounded-dot bg-accent px-6 font-mono tabular text-num-sm text-accent-ink">
              ×{inCart}
            </span>
          ) : (
            <span aria-hidden="true" className="flex size-24 shrink-0 items-center justify-center rounded-dot bg-accent-wash text-accent-text">
              <IconPlus size={15} stroke={2.25} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
});
