'use client';

import type { CategoryColourToken } from '@bliss/shared/domain';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import { cx } from '@bliss/ui/lib/cx';
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/assets';

/**
 * A product in a Console row or card: its catalogue photograph, or its initial on a quiet tile, with
 * the category's colour as an edge, as on the Floor. Decorative; the name beside it is the label.
 * A photograph that fails to load (offline, a removed asset) falls back to the initial.
 */
export function ProductThumb({ name, imageKey, colour, size = 'sm' }: { name: string; imageKey: string | null; colour?: CategoryColourToken | null; size?: 'sm' | 'md' }) {
  const px = size === 'md' ? 96 : 72;
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image can fail before hydration, when onError is not yet listening: check once mounted.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const src = failed ? null : assetUrl(imageKey, px, px);
  return (
    <span aria-hidden="true" className={cx('relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-thumb', size === 'md' ? 'size-control-lg' : 'size-control-md')}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small catalogue thumbnail from the asset store
        <img ref={img} src={src} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="text-label text-ink-subtle">{name.trim().slice(0, 1).toUpperCase()}</span>
      )}
      {colour ? <span className={cx('absolute inset-y-0 left-0 w-2', categoryEdgeClass(colour))} /> : null}
    </span>
  );
}
