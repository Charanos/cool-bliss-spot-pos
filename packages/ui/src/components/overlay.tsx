'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cx } from '../lib/cx';

export interface OverlayMotion {
  enter(panel: Element, scrim: Element | null): void;
  exit(panel: Element, scrim: Element | null, done: () => void): void;
}

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** A sheet rises from the bottom and stops at the base layer. A dialog is centred. */
  placement: 'sheet' | 'dialog' | 'side';
  motion: OverlayMotion;
  title: ReactNode;
  description?: ReactNode;
  /** Context above the title, in mono capitals: "Table 4 · Seat 2". Sentence case in, caps out. */
  eyebrow?: ReactNode;
  /** A mark beside the title, such as the seat chip the sheet is about. Decorative. */
  leading?: ReactNode;
  /**
   * Actions pinned below the scrolling body, so the outcome button is never pushed off an 800px
   * tablet by a long list. Prefer this to OverlayActions inside children.
   */
  footer?: ReactNode;
  children: ReactNode;
  /** Pixels kept clear at the bottom for a base layer that must stay visible. */
  bottomOffset?: number;
  /** Width of the panel. Sheets span the content region by default. */
  width?: 'sm' | 'md' | 'lg' | 'full';
  /** Where the sheet sits horizontally within the viewport, for sheets over one column. */
  align?: 'start' | 'center' | 'end';
  onOpened?: () => void;
  onClosed?: () => void;
  className?: string;
  hideTitle?: boolean;
}

const widthClass = {
  sm: 'w-[min(440px,calc(100vw-48px))]',
  md: 'w-[min(580px,calc(100vw-48px))]',
  lg: 'w-[min(720px,calc(100vw-48px))]',
  full: 'w-[calc(100vw-48px)]',
} as const;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * One overlay for sheets and dialogs, built on the native <dialog> so focus trapping, Escape and
 * the Android back gesture (through CloseWatcher) come from the platform.
 *
 * docs/07-motion-and-interaction.md section 7: focus moves to the first non-destructive control on
 * open and returns to the trigger on close. docs/06 section 6.7: the destructive action is never the
 * default focus. Scrolling inside carries data-lenis-prevent.
 */
export function Overlay({
  open,
  onClose,
  placement,
  motion,
  title,
  description,
  eyebrow,
  leading,
  footer,
  children,
  bottomOffset = 0,
  width = 'md',
  align = 'center',
  onOpened,
  onClosed,
  className,
  hideTitle,
}: OverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  // Hairlines appear only when content actually runs under the header or footer.
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const bodyRef = useRef<HTMLDivElement>(null);
  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const top = body.scrollTop > 0;
    const bottom = body.scrollTop + body.clientHeight < body.scrollHeight - 1;
    setEdges((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!mounted || !body || typeof ResizeObserver === 'undefined') return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => observer.disconnect();
  }, [mounted, measure]);
  const closing = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const latest = useRef({ onOpened, onClosed, motion });
  latest.current = { onOpened, onClosed, motion };

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!mounted || !dialog || !panel) return;

    if (open && !dialog.open) {
      closing.current = false;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const preferred =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).find((el) => !el.hasAttribute('data-destructive') && el.getAttribute('aria-disabled') !== 'true');
      (preferred ?? panel).focus({ preventScroll: true });
      latest.current.motion.enter(panel, scrimRef.current);
      latest.current.onOpened?.();
    }

    if (!open && dialog.open && !closing.current) {
      closing.current = true;
      latest.current.motion.exit(panel, scrimRef.current, () => {
        dialog.close();
        setMounted(false);
        closing.current = false;
        returnFocus.current?.focus({ preventScroll: true });
        latest.current.onClosed?.();
      });
    }
  }, [open, mounted]);

  const onCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (!mounted) return null;

  // Positioned by a flex wrapper, never by CSS transforms: the panel's transform belongs to GSAP.
  const wrapperPosition =
    placement === 'sheet'
      ? cx('items-end px-16', align === 'start' ? 'justify-start' : align === 'end' ? 'justify-end' : 'justify-center')
      : placement === 'side'
        ? 'items-stretch justify-end'
        : 'items-center justify-center p-24';

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-lenis-prevent=""
      className="fixed inset-x-0 top-0 m-0 h-auto w-auto overflow-hidden bg-transparent p-0"
      style={{ bottom: bottomOffset }}
    >
      <div ref={scrimRef} aria-hidden="true" className="absolute inset-0 bg-page/75 backdrop-blur-[8px]" onClick={onClose} />
      <div className={cx('pointer-events-none absolute inset-0 flex', wrapperPosition)}>
        <div
          ref={panelRef}
          tabIndex={-1}
          style={{
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            backgroundColor: 'color-mix(in srgb, var(--color-raised) 92%, transparent)',
            borderColor: 'color-mix(in srgb, white 9%, transparent)',
            boxShadow: '0 32px 80px -16px black, 0 0 0 1px color-mix(in srgb, white 4%, transparent) inset, 0 1px 0 color-mix(in srgb, white 10%, transparent) inset',
          }}
          className={cx(
            'pointer-events-auto flex max-h-[90vh] flex-col border outline-none',
            placement === 'sheet' && 'rounded-t-[28px] border-b-0',
            placement === 'dialog' && 'rounded-[28px]',
            placement === 'side' ? 'h-full w-[min(480px,100vw)] rounded-l-[28px] border-r-0' : widthClass[width],
            className,
          )}
        >
          {/* Header */}
          <div
            className={cx(
              'shrink-0 px-32 pb-20 pt-32 transition-colors duration-[var(--bliss-duration-hover)]',
              edges.top ? 'border-b border-rule-raised/50' : 'border-b border-transparent',
              hideTitle && 'sr-only',
            )}
          >
            {eyebrow ? (
              <p className="mb-10 font-mono text-caps tracking-widest text-attention text-[10px]">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex items-center gap-12">
              {leading ? (
                <span aria-hidden="true" className="inline-flex shrink-0">
                  {leading}
                </span>
              ) : null}
              <h2 id={titleId} className="min-w-0 text-title font-medium tracking-tight text-ink">
                {title}
              </h2>
            </div>
            {description ? (
              <p id={descriptionId} className="mt-8 text-body text-ink-muted leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>

          {/* Body */}
          <div ref={bodyRef} onScroll={measure} className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-32', footer ? 'pb-24' : 'pb-32', hideTitle ? 'pt-32' : 'pt-4')}>
            {children}
          </div>

          {/* Footer */}
          {footer ? (
            <div
              className={cx(
                'flex shrink-0 flex-wrap items-center justify-end gap-16 px-32 pb-32 pt-24 transition-colors duration-[var(--bliss-duration-hover)]',
                edges.bottom ? 'border-t border-rule-raised/50' : 'border-t border-transparent',
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

/**
 * A row of overlay actions: the cancelling option first and quiet, the outcome last.
 *
 * Sticky to the bottom of the scrolling body. Carries the panel's own tone — the scroller simply
 * disappears beneath it.
 */
export function OverlayActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'sticky bottom-0 z-10 -mx-32 -mb-32 flex items-center justify-end gap-16 border-t border-rule/60 bg-raised/90 backdrop-blur-md px-32 pb-32 pt-20 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  );
}
