'use client';

import { type Cents, interpolate } from '@bliss/shared/money';
import { type DependencyList, type RefObject, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { gsap, isInstant, isReduced, motionStore, play, vars } from './engine';
import type { AnimationName } from './registry';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Scope animations to a component with gsap.context and revert on unmount, every time. A POS runs
 * for eight hours without a reload, and a leaked transform surfaces at 1am as a laggy tablet.
 */
export function useMotionScope(scope: RefObject<Element | null>, effect: () => void, deps: DependencyList) {
  useIsomorphicLayoutEffect(() => {
    if (!scope.current) return undefined;
    const ctx = gsap.context(effect, scope.current);
    return () => ctx.revert();
  }, deps);
}

export function useMotionState() {
  return useSyncExternalStore(motionStore.subscribe, motionStore.get, motionStore.get);
}

/**
 * Count a money figure to its new value: seat.total, amount.change, metric.count.
 *
 * The tween drives a progress number from 0 to 10,000, never the money itself, so no float ever
 * touches a Cents value, and the figure always lands on the exact amount.
 */
export function useCountTo(value: Cents, name: AnimationName, options: { fromZeroOnMount?: boolean } = {}): Cents {
  const [shown, setShown] = useState<Cents>(() => (options.fromZeroOnMount ? (0n as Cents) : value));
  const shownRef = useRef<Cents>(shown);
  const mounted = useRef(false);

  useEffect(() => {
    const from = shownRef.current;
    const firstRun = !mounted.current;
    mounted.current = true;

    const settle = () => {
      shownRef.current = value;
      setShown(value);
    };

    if (from === value || (firstRun && !options.fromZeroOnMount) || isInstant() || isReduced()) {
      settle();
      return undefined;
    }

    const proxy = { p: 0 };
    const animation = play(name, () =>
      gsap.to(
        proxy,
        vars(name, {
          p: 10_000,
          onUpdate: () => {
            const next = interpolate(from, value, proxy.p);
            shownRef.current = next;
            setShown(next);
          },
        }),
      ),
    );
    if (!animation) settle();

    return () => {
      animation?.kill();
      shownRef.current = value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the value and the animation name drive the tween
  }, [value, name]);

  return shown;
}

