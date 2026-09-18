'use client';

import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { listEnter } from './floor';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Floor list motion, imported only by Floor surfaces so the Console never loads Flip.
 *
 * list.enter runs once, the first time the list has items, before the browser paints, so cards never
 * flash in and then fade. Nothing else animates: a zone or scope filter is instant, like category
 * switching (docs/07 section 6), and a data refresh is not an entrance.
 */
export function useListEnter(container: RefObject<Element | null>, ready: boolean, itemSelector = '[data-list-item]') {
  const entered = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const el = container.current;
    if (!el || !ready || entered.current) return;
    entered.current = true;
    listEnter(Array.from(el.querySelectorAll(itemSelector)));
  }, [ready]);
}
