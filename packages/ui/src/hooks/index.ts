'use client';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from '../tokens/tokens';

export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * True only after `pending` has been true for `delayMs`. docs/07 section 7: no spinner appears for
 * anything under 100ms, and anything slower shows a determinate or skeleton state by 100ms.
 */
export function useDelayedFlag(pending: boolean, delayMs: number = motion.feedbackMs): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!pending) {
      setShown(false);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);
  return pending && shown;
}

/** A clock that ticks on a fixed interval, for elapsed shift time and ticket ages. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const noopSubscribe = () => () => undefined;

/** True on the client after hydration. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerLeave: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onClick: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * Long press at 450ms, consistent everywhere, with a haptic tick at the threshold where the platform
 * supports it. A press that moves more than 10px is a scroll, not a press.
 *
 * The ordinary press runs through the native click, so a screen reader's activation, Enter and
 * Space all work. A long press suppresses the click that follows it. Keyboard parity for the long
 * press: the context menu key and Shift+F10.
 */
export function useLongPress(options: {
  onLongPress: () => void;
  onPress?: () => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  disabled?: boolean;
}): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const latest = useRef(options);
  latest.current = options;

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const end = useCallback(() => {
    clear();
    if (origin.current) latest.current.onPressEnd?.();
    origin.current = null;
  }, [clear]);

  return {
    onPointerDown(event) {
      if (event.button > 0) return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      latest.current.onPressStart?.();
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(10);
        latest.current.onPressEnd?.();
        origin.current = null;
        latest.current.onLongPress();
      }, motion.longPressMs);
    },
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
    onPointerMove(event) {
      const start = origin.current;
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) {
        fired.current = false;
        end();
      }
    },
    onClick(event) {
      if (fired.current) {
        event.preventDefault();
        fired.current = false;
        return;
      }
      if (!latest.current.disabled) latest.current.onPress?.();
    },
    onContextMenu(event) {
      event.preventDefault();
    },
    onKeyDown(event) {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        latest.current.onLongPress();
      }
    },
  };
}

/**
 * Close a menu or dropdown: on a pointer down outside it, on Escape, when the page scrolls under it,
 * and when the window is resized. A press on the control that opened it closes it and stays closed:
 * the click that would toggle it open again is swallowed, so a trigger always toggles.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    if (!open) return undefined;
    let pressedTrigger: Element | null = null;
    let pressedAt = 0;
    const inside = (target: EventTarget | null) => Boolean(ref.current && target instanceof Node && ref.current.contains(target));
    const onPointer = (event: PointerEvent) => {
      if (inside(event.target)) return;
      // Only the control that shows this menu as open; any other control works on its first press.
      const trigger = event.target instanceof Element ? event.target.closest('[aria-expanded="true"]') : null;
      pressedTrigger = trigger;
      pressedAt = Date.now();
      latest.current();
    };
    const onClick = (event: MouseEvent) => {
      if (!pressedTrigger || Date.now() - pressedAt > 800) return;
      if (event.target instanceof Node && pressedTrigger.contains(event.target)) {
        event.stopPropagation();
        event.preventDefault();
      }
      pressedTrigger = null;
    };
    const onScroll = (event: Event) => {
      if (inside(event.target)) return;
      latest.current();
    };
    const onResize = () => latest.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      // The click that follows the closing press still needs swallowing after this effect ends.
      window.setTimeout(() => document.removeEventListener('click', onClick, true), 800);
    };
  }, [open, ref]);
}

/** Remember a value per viewer in localStorage, tolerating a blocked or empty store. */
export function usePersistentState<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored && (allowed as readonly string[]).includes(stored)) setValue(stored as T);
    } catch {
      // Storage can be unavailable in a private window. The fallback is correct without it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per key
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not persisting is acceptable; the in-memory value still applies.
      }
    },
    [key],
  );
  return [value, set];
}
