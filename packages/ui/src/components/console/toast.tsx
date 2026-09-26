'use client';

import { IconAlertTriangle, IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';

export type ToastTone = 'success' | 'info' | 'attention' | 'stop';

export interface ToastInput {
  title: string;
  /** One line more: what changed, or what to do next. */
  body?: string;
  tone?: ToastTone;
  /** A way on, such as "Open the product". */
  action?: { label: string; href: string };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Say that something was done, in the Console only (the Floor keeps its inline notices, docs/11
 * D-22). A toast confirms; it never asks, and a refusal stays in the dialog that caused it.
 */
export function useToast(): (toast: ToastInput) => void {
  const push = useContext(ToastContext);
  return push ?? (() => undefined);
}

const MAX = 3;
const LIFE_MS = 5_000;

const TONE: Record<ToastTone, { icon: typeof IconCheck; tile: string }> = {
  success: { icon: IconCheck, tile: 'bg-poured-wash text-poured' },
  info: { icon: IconInfoCircle, tile: 'bg-info-wash text-info' },
  attention: { icon: IconAlertTriangle, tile: 'bg-low-wash text-low' },
  stop: { icon: IconAlertTriangle, tile: 'bg-stop-wash text-stop' },
};

/** The stack at the foot of the sheet. Mount once, around the Console. */
export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const push = useCallback((toast: ToastInput) => {
    const id = next.current++;
    setItems((current) => [...current, { ...toast, id }].slice(-MAX));
  }, []);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((t) => t.id !== id)), []);
  const value = useMemo(() => push, [push]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div aria-live="polite" className="pointer-events-none fixed bottom-24 right-24 z-toast flex w-popover flex-col gap-8">
              {items.map((t) => (
                <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const tone = toast.tone ?? 'success';
  const { icon: Glyph, tile } = TONE[tone];
  const [paused, setPaused] = useState(false);
  const left = useRef(LIFE_MS);
  const started = useRef(Date.now());

  useEffect(() => {
    if (paused) {
      left.current -= Date.now() - started.current;
      return undefined;
    }
    started.current = Date.now();
    const timer = window.setTimeout(onDismiss, Math.max(800, left.current));
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss]);

  return (
    <div
      role={tone === 'stop' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx('pointer-events-auto flex items-start gap-12 rounded-card border border-edge bg-card p-12 shadow-popover toast-in')}
    >
      <span aria-hidden="true" className={cx('flex size-control-sm shrink-0 items-center justify-center rounded-md', tile)}>
        <Glyph size={16} stroke={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-4">
        <p className="text-ui font-medium text-ink">{toast.title}</p>
        {toast.body ? <p className="text-body-sm text-ink-muted">{toast.body}</p> : null}
        {toast.action ? (
          <Link href={toast.action.href} onClick={onDismiss} className="w-fit rounded-sm pt-4 text-body-sm font-medium text-accent-text transition-hover hover:text-ink">
            {toast.action.label}
          </Link>
        ) : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="inline-flex size-row-compact shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-hover hover:bg-control hover:text-ink">
        <IconX size={14} stroke={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
