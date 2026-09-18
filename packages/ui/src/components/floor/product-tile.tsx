'use client';

import type { AvailabilityReason, AvailabilityState } from '@bliss/shared/domain';
import { type Cents, formatKes } from '@bliss/shared/money';
import { IconBottle, IconBowlChopsticks, IconBeer, IconGlassCocktail, IconGlassFull, IconBottleFilled, IconPlus } from '@tabler/icons-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useLongPress } from '../../hooks';
import { cx } from '../../lib/cx';
import { type CategoryColour } from '../../lib/seat';
import { gsap } from '../../motion/engine';
import { tileFinished, tilePressDown, tilePressUp } from '../../motion/floor';
import { Badge } from '../badge';
import { ICON_STROKE } from '../icon';
import { Money } from '../money';


export type TileGlyph = 'beer' | 'spirit' | 'wine' | 'soft' | 'food' | 'bottle';

const GLYPH_NAME: Record<TileGlyph, string> = {
  beer: 'BEER',
  spirit: 'SPIRITS',
  wine: 'WINE',
  soft: 'SOFT DRINK',
  food: 'FOOD',
  bottle: 'BOTTLE',
};

const CATEGORY_COLOR: Record<CategoryColour, string> = {
  glacier: '#6FC6D6',
  ember: '#E0A35A',
  leaf: '#9DC271',
  iris: '#B79BE0',
  rose: '#E58BA4',
  steel: '#7FA8E0',
  brass: '#D9C46B',
  jade: '#6FD2B4',
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
}

/**
 * The product tile, the most tapped object in the system. docs/06-design-system.md section 6.3,
 * with a photograph band per the tile imagery decision (docs/11-design-drift.md, D-02).
 *
 * The whole tile is the target: there is no separate add button, which would nest a filled control
 * inside the tile. Press feedback runs before any state change. The tap adds the line locally, so
 * the network is never in the interaction path and a spinner here would be a lie.
 *
 *   available  normal
 *   low        remaining count in the corner, attention colour
 *   last_few   count plus a 1px corner tick
 *   finished   40% opacity, one diagonal hairline, FINISHED or ON HOLD chip, not tappable, still focusable
 */
export const ProductTile = memo(function ProductTile({
  variantId,
  name,
  price,
  ruled,
  state,
  reason,
  qtyAvailable,
  category,
  glyph,
  imageUrl,
  onAdd,
  onLongPress,
}: ProductTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const hairlineRef = useRef<HTMLSpanElement>(null);
  const previousState = useRef(state);
  const [imageFailed, setImageFailed] = useState(false);
  const finished = state === 'finished';
  const held = finished && reason === 'hold';
  const count = Math.max(0, Math.floor(qtyAvailable));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (state === 'finished' && previousState.current !== 'finished') tileFinished(el, hairlineRef.current);
    if (state !== 'finished' && previousState.current === 'finished') gsap.set(el, { clearProps: 'opacity' });
    previousState.current = state;
  }, [state]);

  const press = useLongPress({
    onPressStart: () => ref.current && !finished && tilePressDown(ref.current),
    onPressEnd: () => ref.current && !finished && tilePressUp(ref.current),
    onPress: () => {
      if (!finished) onAdd(variantId);
    },
    onLongPress: () => onLongPress(variantId),
  });

  const stateWords = finished ? (held ? ', on hold' : ', finished') : state === 'low' || state === 'last_few' ? `, ${count} left` : '';
  const Glyph = GLYPH[glyph];

  return (
    <button
      ref={ref}
      type="button"
      {...press}
      aria-disabled={finished || undefined}
      aria-label={`${name}${price ? `, ${formatKes(price)}` : ''}${stateWords}`}
      data-variant-id={variantId}
      className={cx(
        'group relative flex min-h-[192px] min-w-0 flex-col overflow-hidden rounded-[16px] bg-[#161F27] text-left will-change-transform',
        'shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
        'transition-all duration-[300ms] ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)] active:scale-[0.98]',
        finished && 'cursor-default opacity-40',
      )}
    >
      <span aria-hidden="true" className="relative block h-[96px] w-full shrink-0 overflow-hidden bg-[#11181F]">
        {imageUrl && !imageFailed ? (
          <>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className={cx(
                'size-full object-cover transition-transform duration-[500ms] ease-out group-hover:scale-105',
                finished ? 'grayscale' : 'saturate-[0.9] contrast-[1.05] brightness-[0.88]',
              )}
            />
            {/* Rich cinematic dark mask */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-90"
              style={{
                background:
                  'linear-gradient(to top, #161F27 0%, rgba(22, 31, 39, 0.94) 28%, rgba(22, 31, 39, 0.6) 62%, rgba(10, 15, 20, 0.35) 100%)',
              }}
            />
          </>
        ) : (
          <span className="flex size-full items-center justify-center text-ink-disabled bg-[#11181F] transition-transform duration-[500ms] ease-out group-hover:scale-105">
            <Glyph size={26} stroke={ICON_STROKE} />
          </span>
        )}

        {/* Category Overlay Label (Bottom Left) */}
        <span
          className="absolute bottom-[6px] left-[14px] text-[10px] font-bold tracking-[0.14em] uppercase z-10 select-none"
          style={{ color: CATEGORY_COLOR[category] ?? '#8C9AA6' }}
        >
          {GLYPH_NAME[glyph] ?? 'ITEM'}
        </span>

        {/* Availability / Quantity / Status Badge (Top Right) */}
        <Badge
          tone={
            held
              ? 'attention'
              : finished
                ? 'stop'
                : state === 'low' || state === 'last_few'
                  ? 'attention'
                  : 'neutral'
          }
          className="absolute top-[8px] right-[8px] z-20 backdrop-blur-md bg-[#0B1015]/85 shadow-sm px-[7px] py-[3px] text-[10px] font-semibold tracking-wider rounded-[6px]"
        >
          {held
            ? (count > 0 ? `On hold · ${count}` : 'On hold')
            : finished
              ? (count > 0 ? `Finished · ${count}` : '0 left')
              : `${count} left`}
        </Badge>
      </span>

      <span className="relative z-10 flex flex-1 flex-col justify-between px-[14px] pb-[12px] pt-[8px]">
        <span
          className="line-clamp-2 min-h-[38px] text-[14px] font-medium tracking-tight text-[#F4F7F9] leading-[19px]"
          title={name}
        >
          {name}
        </span>

        <div className="mt-auto flex items-center justify-between pt-[6px]">
          {price ? (
            <Money value={price} size="num" tone={ruled ? 'accent' : 'default'} />
          ) : (
            <span className="text-[12px] font-medium text-ink-subtle">No price</span>
          )}

          <span
            aria-hidden="true"
            className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#1E3B40] text-[#3CD4D3] shadow-sm transition-all duration-200 group-hover:bg-[#275359] group-hover:scale-105 active:scale-90"
          >
            <IconPlus size={17} stroke={2.5} />
          </span>
        </div>
      </span>

      {state === 'last_few' ? (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[6px] right-[6px] size-[10px] border-b border-r border-attention" />
      ) : null}

      {finished ? (
        <span ref={hairlineRef} aria-hidden="true" className="pointer-events-none absolute inset-0 origin-left text-ink-disabled">
          <svg className="size-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      ) : null}
    </button>
  );
});

