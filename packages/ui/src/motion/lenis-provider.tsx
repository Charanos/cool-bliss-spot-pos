'use client';

import Lenis from 'lenis';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ScrollTrigger } from './console';
import { gsap, isReduced } from './engine';

/**
 * Smooth wheel scrolling for the Console only. ADR-014: Lenis is never loaded in the Floor or
 * Counter bundles, and touch stays native even here.
 *
 * Lenis 1.3 has no `smoothTouch` option. `syncTouch: false` is the equivalent and keeps touch native.
 * `lerp` takes precedence over `duration` in Lenis, so only lerp is set. See docs/11-design-drift.md, D-13.
 *
 * One rAF loop: Lenis is driven from the GSAP ticker rather than its own.
 * Scrollable tables, dialogs and sheets carry data-lenis-prevent.
 */

interface LenisControls {
  stop(): void;
  start(): void;
  scrollTo(target: number | string | HTMLElement): void;
}

const LenisContext = createContext<LenisControls | null>(null);

export function useLenis(): LenisControls | null {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (isReduced()) return;
    const wrapper = document.getElementById('sheet-scroll-container') || window;
    const lenis = new Lenis({
      wrapper,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    // GSAP ticker time is in seconds; Lenis.raf() expects a DOMHighResTimeStamp (ms).
    // Do NOT set lagSmoothing(0): that disables all frame-skip protection and causes
    // the mid-scroll hang the user sees. Keep the engine's (500, 33) intact.
    const tick = () => lenis.raf(performance.now());
    gsap.ticker.add(tick);
    lenis.on('scroll', ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const controls = useMemo<LenisControls>(
    () => ({
      stop: () => lenisRef.current?.stop(),
      start: () => lenisRef.current?.start(),
      scrollTo: (target) => {
        if (lenisRef.current) lenisRef.current.scrollTo(target, { immediate: isReduced() });
        else if (typeof target === 'number') window.scrollTo({ top: target });
      },
    }),
    [],
  );

  return <LenisContext.Provider value={controls}>{children}</LenisContext.Provider>;
}
