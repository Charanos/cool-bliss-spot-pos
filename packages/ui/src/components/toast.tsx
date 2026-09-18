'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { gsap } from '../motion/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface ToastAPI {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Tone styles
// ---------------------------------------------------------------------------

const TONE_DOT: Record<ToastTone, string> = {
  success: 'bg-poured',
  error: 'bg-stop',
  info: 'bg-info',
  warning: 'bg-attention',
};

const TONE_RING: Record<ToastTone, string> = {
  success: 'ring-poured/20',
  error: 'ring-stop/20',
  info: 'ring-info/20',
  warning: 'ring-attention/20',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Individual toast — self-animates in and out, auto-dismisses after 3.5s
// ---------------------------------------------------------------------------

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enter animation
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 24, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(1.6)', clearProps: 'will-change' },
    );
  }, []);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, 3500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = useCallback(() => {
    const el = ref.current;
    if (!el) {
      onDismiss(item.id);
      return;
    }
    gsap.to(el, {
      y: 12,
      opacity: 0,
      scale: 0.96,
      duration: 0.14,
      ease: 'power2.in',
      onComplete: () => onDismiss(item.id),
    });
  }, [item.id, onDismiss]);

  return (
    <li
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="list-none"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className={cx(
          'flex w-full cursor-pointer items-center gap-10 rounded-lg px-14 py-10 text-left',
          'bg-raised/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.08)]',
          'ring-1 backdrop-blur-md select-none',
          TONE_RING[item.tone],
        )}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Tone dot */}
        <span className={cx('h-7 w-7 shrink-0 rounded-full', TONE_DOT[item.tone])} aria-hidden="true" />
        {/* Message */}
        <span className="min-w-0 flex-1 text-body text-ink">{item.message}</span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Provider — renders toasts into a portal at the safe-area bottom
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const containerId = useId();

  const add = useCallback((message: string, tone: ToastTone) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api: ToastAPI = {
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
    warning: (msg) => add(msg, 'warning'),
  };

  const portal =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            id={containerId}
            aria-label="Notifications"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-8 px-16 pb-[max(16px,env(safe-area-inset-bottom))]"
          >
            <ul className="pointer-events-auto flex w-full max-w-sm flex-col gap-8">
              {toasts.map((t) => (
                <ToastRow key={t.id} item={t} onDismiss={dismiss} />
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portal}
    </ToastContext.Provider>
  );
}
