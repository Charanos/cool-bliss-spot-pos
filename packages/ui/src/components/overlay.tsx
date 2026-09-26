'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { cx } from '../lib/cx';

export interface OverlayMotion {
  enter(panel: Element, scrim: Element | null): void;
  exit(panel: Element, scrim: Element | null, done: () => void): void;
}

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /**
   * A sheet rises from the bottom, a dialog is centred, a side panel comes in from the right.
   * `adaptive` is the one to reach for on a working surface: a sheet under the thumb on a phone,
   * a centred dialog from a tablet up, where there is no thumb and no bottom edge to hug.
   */
  placement: 'sheet' | 'dialog' | 'side' | 'adaptive';
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
  /**
   * `glass` is the Floor and Counter sheet: frosted, over a working surface. `solid` is the Console
   * dialog: the card surface, one edge, the popover shadow and the Console's type. docs/19.
   */
  surface?: 'glass' | 'solid';
}

const widthClass = {
  sm: 'w-[min(440px,calc(100vw-32px))]',
  md: 'w-[min(580px,calc(100vw-32px))]',
  lg: 'w-[min(720px,calc(100vw-32px))]',
  full: 'w-[calc(100vw-32px)]',
} as const;

/**
 * A sheet is the full width of a phone and takes its width back from a tablet up. Written out
 * rather than composed, because Tailwind reads these class names from the source as plain text.
 */
const sheetWidthClass = {
  sm: 'w-full pad:w-[min(440px,calc(100vw-32px))]',
  md: 'w-full pad:w-[min(580px,calc(100vw-32px))]',
  lg: 'w-full pad:w-[min(720px,calc(100vw-32px))]',
  full: 'w-full pad:w-[calc(100vw-32px)]',
} as const;

/** Square at the bottom edge on a phone, a card once it is centred. */
const ADAPTIVE_SHAPE = 'safe-b rounded-t-[28px] border-b-0 pad:rounded-[28px] pad:border-b pad:[padding-bottom:0]';

/** Which surface an overlay's children sit on, so its actions row can match the padding. */
const SurfaceContext = createContext<'glass' | 'solid'>('glass');

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
  surface = 'glass',
}: OverlayProps) {
  const solid = surface === 'solid';
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
      ? cx('items-end px-0 pad:px-16', align === 'start' ? 'justify-start' : align === 'end' ? 'justify-end' : 'justify-center')
      : placement === 'adaptive'
        ? 'items-end justify-center px-0 pad:items-center pad:p-24'
        : placement === 'side'
          ? 'items-stretch justify-end'
          : 'items-center justify-center p-16 pad:p-24';

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
      <div ref={scrimRef} aria-hidden="true" className={cx('absolute inset-0', solid ? 'bg-scrim' : 'scrim-glass')} onClick={onClose} />
      <div className={cx('pointer-events-none absolute inset-0 flex', wrapperPosition)}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cx(
            'pointer-events-auto flex max-h-[92dvh] flex-col outline-none',
            solid ? 'overlay-solid' : 'overlay-glass',
            // A sheet on a phone is the width of the phone, and pays back the home indicator.
            placement === 'sheet' && 'safe-b rounded-t-[28px] border-b-0',
            placement === 'adaptive' && ADAPTIVE_SHAPE,
            placement === 'dialog' && (solid ? 'rounded-overlay' : 'rounded-[28px]'),
            placement === 'side'
              ? cx('h-full w-[min(480px,100vw)] border-r-0', solid ? 'rounded-l-overlay' : 'rounded-l-[28px]')
              : placement === 'sheet' || placement === 'adaptive'
                ? sheetWidthClass[width]
                : widthClass[width],
            className,
          )}
        >
          {/* Header */}
          <div
            className={cx(
              'shrink-0 transition-hover',
              solid ? 'px-24 pb-16 pt-24' : 'px-16 pb-12 pt-20 pad:px-32 pad:pb-20 pad:pt-32',
              edges.top ? (solid ? 'border-b border-edge' : 'border-b border-rule-raised/50') : 'border-b border-transparent',
              hideTitle && 'sr-only',
            )}
          >
            {eyebrow ? <p className={cx('mb-8', solid ? 'overline text-ink-subtle' : 'font-mono text-caps text-attention')}>{eyebrow}</p> : null}
            <div className="flex items-center gap-12">
              {leading ? (
                <span aria-hidden="true" className="inline-flex shrink-0">
                  {leading}
                </span>
              ) : null}
              <h2 id={titleId} className={cx('min-w-0 text-ink', solid ? 'text-title-section' : 'text-title font-medium')}>
                {title}
              </h2>
            </div>
            {description ? (
              <p id={descriptionId} className={cx('text-ink-muted', solid ? 'measure mt-4 text-body-sm' : 'mt-8 text-body')}>
                {description}
              </p>
            ) : null}
          </div>

          {/* Body */}
          <div
            ref={bodyRef}
            onScroll={measure}
            className={cx(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain',
              solid ? cx('px-24', footer ? 'pb-16' : 'pb-24', hideTitle ? 'pt-24' : 'pt-4') : cx('px-16 pad:px-32', footer ? 'pb-16 pad:pb-24' : 'pb-20 pad:pb-32', hideTitle ? 'pt-20 pad:pt-32' : 'pt-4'),
            )}
          >
            <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>
          </div>

          {/* Footer */}
          {footer ? (
            <div
              className={cx(
                'flex shrink-0 flex-wrap items-center justify-end transition-hover',
                solid ? 'gap-8 card-band px-24 py-16' : 'gap-8 px-16 pb-16 pt-16 pad:gap-16 pad:px-32 pad:pb-32 pad:pt-24',
                edges.bottom ? (solid ? 'border-t border-edge' : 'border-t border-rule-raised/50') : solid ? 'border-t border-edge' : 'border-t border-transparent',
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
  const surface = useContext(SurfaceContext);
  return (
    <div
      className={cx(
        surface === 'solid'
          ? 'sticky bottom-0 z-raised -mx-24 -mb-24 flex items-center justify-end gap-8 border-t border-edge bg-card px-24 py-16'
          : 'sticky bottom-0 z-10 -mx-16 -mb-20 flex items-center justify-end gap-8 border-t border-rule/60 bg-raised/90 px-16 pb-20 pt-16 backdrop-blur-glass transition-colors pad:-mx-32 pad:-mb-32 pad:gap-16 pad:px-32 pad:pb-32 pad:pt-20',
        className,
      )}
    >
      {children}
    </div>
  );
}
