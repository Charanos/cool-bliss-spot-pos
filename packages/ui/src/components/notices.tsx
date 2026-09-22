'use client';

import { IconAlertCircle, IconAlertTriangle, IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';

/**
 * Notices: the answer to "did that work?". docs/16-responsive-and-offline.md section 7.
 *
 * A store outside React, so a notice can come from anywhere: a tap on a tile, the sync cycle noticing
 * the network came back, a mutation that failed after the screen moved on. One viewport per surface
 * renders them, top centre under the top bar, clear of the dock and of the thing the waiter is doing.
 *
 * Rules the store enforces rather than trusting every caller to remember:
 *
 *  - Repeats merge. Five taps on Tusker is one notice that says "Tusker, 5 added", not a tower.
 *  - An undo is a real undo, offered for as long as the notice stands, and the notice stays up long
 *    enough to reach it: never less than six seconds.
 *  - Errors stay until they are read. Success leaves on its own.
 *  - Hovering or focusing a notice holds it, so nobody loses one while reaching for its button.
 *  - Four at most on screen. The oldest quiet one goes first.
 */

export type NoticeTone = 'success' | 'info' | 'warning' | 'error';

export interface NoticeInput {
  tone?: NoticeTone;
  title: string;
  body?: string;
  /** Notices with the same key merge: the newest words, a count of how many times, a fresh timer. */
  key?: string;
  /** Show "×n" when a keyed notice repeats. */
  count?: boolean;
  action?: { label: string; run: () => void | Promise<void> };
  undo?: () => void | Promise<void>;
  /** Milliseconds, or sticky until dismissed. Defaults by tone. */
  holdMs?: number | 'sticky';
}

export interface Notice extends Required<Pick<NoticeInput, 'tone' | 'title'>> {
  id: string;
  key: string | null;
  body: string | null;
  count: boolean;
  times: number;
  action: NoticeInput['action'] | null;
  undo: NoticeInput['undo'] | null;
  holdMs: number | 'sticky';
  /** Bumped on every merge, so the view can restart its timer and replay its bump. */
  revision: number;
  leaving: boolean;
}

const DEFAULT_MS: Record<NoticeTone, number | 'sticky'> = { success: 3200, info: 4500, warning: 7000, error: 'sticky' };
const UNDO_MIN_MS = 6000;
const MAX_VISIBLE = 4;
const LEAVE_MS = 160;

let notices: readonly Notice[] = [];
const listeners = new Set<() => void>();
let sequence = 0;

function emit(next: readonly Notice[]) {
  notices = next;
  for (const l of listeners) l();
}

/** Raise a notice. Returns its id, which `dismissNotice` takes. */
export function notify(input: NoticeInput): string {
  const tone = input.tone ?? 'success';
  const base = input.holdMs ?? DEFAULT_MS[tone];
  const holdMs = input.undo && base !== 'sticky' ? Math.max(base, UNDO_MIN_MS) : base;

  if (input.key) {
    const existing = notices.find((n) => n.key === input.key && !n.leaving);
    if (existing) {
      emit(
        notices.map((n) =>
          n.id === existing.id
            ? {
                ...n,
                tone,
                title: input.title,
                body: input.body ?? null,
                action: input.action ?? null,
                undo: input.undo ?? null,
                holdMs,
                times: n.times + 1,
                revision: n.revision + 1,
              }
            : n,
        ),
      );
      return existing.id;
    }
  }

  const notice: Notice = {
    id: `notice-${++sequence}`,
    key: input.key ?? null,
    tone,
    title: input.title,
    body: input.body ?? null,
    count: input.count ?? false,
    times: 1,
    action: input.action ?? null,
    undo: input.undo ?? null,
    holdMs,
    revision: 0,
    leaving: false,
  };

  let next = [...notices, notice];
  const live = next.filter((n) => !n.leaving);
  if (live.length > MAX_VISIBLE) {
    // The oldest notice that is not an error makes room; an unread error is never pushed off.
    const drop = live.find((n) => n.tone !== 'error') ?? live[0];
    if (drop) next = next.filter((n) => n.id !== drop.id);
  }
  emit(next);
  return notice.id;
}

/** Take a notice away, by id or by key, with its exit. */
export function dismissNotice(idOrKey: string) {
  const target = notices.find((n) => n.id === idOrKey || n.key === idOrKey);
  if (!target || target.leaving) return;
  emit(notices.map((n) => (n.id === target.id ? { ...n, leaving: true } : n)));
  setTimeout(() => emit(notices.filter((n) => n.id !== target.id)), LEAVE_MS);
}

export function useNotices(): readonly Notice[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => notices,
    () => notices,
  );
}

/* ------------------------------------------------------------------- view */

/** Each tone colours the whole notice: its wash and dot grid (via --notice-tone), its edge, its mark. */
const TONE: Record<NoticeTone, { icon: TablerIcon; tile: string; bar: string; edge: string; surface: string }> = {
  success: { icon: IconCheck, tile: 'bg-poured/20 text-poured', bar: 'bg-poured/60', edge: 'border-poured/30', surface: '[--notice-tone:var(--color-poured)]' },
  info: { icon: IconInfoCircle, tile: 'bg-info/20 text-info', bar: 'bg-info/60', edge: 'border-info/30', surface: '[--notice-tone:var(--color-info)]' },
  warning: { icon: IconAlertTriangle, tile: 'bg-low/20 text-low', bar: 'bg-low/60', edge: 'border-low/35', surface: '[--notice-tone:var(--color-low)]' },
  error: { icon: IconAlertCircle, tile: 'bg-stop/20 text-stop', bar: 'bg-stop/60', edge: 'border-stop/40', surface: '[--notice-tone:var(--color-stop)]' },
};

const TEXT_BUTTON = 'h-32 shrink-0 rounded-[10px] px-12 text-label font-medium press-feedback disabled:opacity-50';

function NoticeCard({ notice }: { notice: Notice }) {
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const remaining = useRef<number>(typeof notice.holdMs === 'number' ? notice.holdMs : 0);
  const startedAt = useRef(0);
  const t = TONE[notice.tone];
  const Glyph = t.icon;

  // A fresh timer on every merge.
  useEffect(() => {
    remaining.current = typeof notice.holdMs === 'number' ? notice.holdMs : 0;
  }, [notice.revision, notice.holdMs]);

  useEffect(() => {
    if (notice.holdMs === 'sticky' || held || notice.leaving) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissNotice(notice.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [notice.id, notice.holdMs, notice.revision, held, notice.leaving]);

  const act = async (run: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await run();
      dismissNotice(notice.id);
    } catch (e) {
      notify({ tone: 'error', title: 'That did not go through', body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      role={notice.tone === 'error' ? 'alert' : 'status'}
      aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cx(
        'notice-surface group pointer-events-auto relative flex w-full items-center gap-12 overflow-hidden rounded-[18px] border py-8 pl-8 pr-6 shadow-lift backdrop-blur-veil',
        t.edge,
        t.surface,
        notice.leaving ? 'notice-out' : 'notice-in',
      )}
    >
      <span key={notice.revision} className={cx('flex size-32 shrink-0 items-center justify-center self-start rounded-[12px]', t.tile, notice.revision > 0 && 'bump')}>
        <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 py-2">
        <p className="flex min-w-0 items-center gap-8 text-body-sm font-medium text-ink">
          <span className="min-w-0 truncate">{notice.title}</span>
          {notice.count && notice.times > 1 ? (
            <span key={`n-${notice.times}`} className="bump shrink-0 rounded-dot bg-sunken/80 px-6 font-mono tabular text-num-sm text-ink-muted">
              ×{notice.times}
            </span>
          ) : null}
        </p>
        {notice.body ? <p className="mt-2 text-label text-ink-muted">{notice.body}</p> : null}
      </div>

      {notice.undo ? (
        <button type="button" disabled={busy} onClick={() => void act(notice.undo!)} className={cx(TEXT_BUTTON, 'text-accent-text hover:bg-accent/10')}>
          Undo
        </button>
      ) : null}
      {notice.action ? (
        <button type="button" disabled={busy} onClick={() => void act(notice.action!.run)} className={cx(TEXT_BUTTON, 'bg-accent/10 text-accent-text hover:bg-accent/20')}>
          {notice.action.label}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissNotice(notice.id)}
        className={cx(
          'flex size-[28px] shrink-0 items-center justify-center self-start rounded-dot text-ink-subtle press-feedback hover:bg-control hover:text-ink',
          // With a mouse the cross waits for the pointer; an error keeps it, and a finger always has it.
          notice.tone !== 'error' && 'mouse:opacity-0 mouse:group-hover:opacity-100 mouse:focus-visible:opacity-100',
        )}
      >
        <IconX size={14} stroke={ICON_STROKE} aria-hidden="true" />
      </button>

      {typeof notice.holdMs === 'number' && !notice.leaving ? (
        <span
          key={`bar-${notice.revision}`}
          aria-hidden="true"
          className={cx('notice-timer absolute inset-x-16 bottom-0 h-px origin-left rounded-dot', t.bar, held && '[animation-play-state:paused]')}
          style={{ animationDuration: `${notice.holdMs}ms` }}
        />
      ) : null}
    </li>
  );
}

/**
 * The viewport. Top centre on every screen, just under the top bar, between the brand on the left
 * and the clock and account on the right, where it covers neither and never the dock. The newest
 * sits nearest the bar and they drop down from it.
 */
export function NoticeViewport({ label = 'Notifications' }: { label?: string }) {
  const list = useNotices();
  return (
    <section
      aria-label={label}
      className="safe-t safe-x pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center [--bliss-gutter-t:calc(var(--spacing-strip-compact)+8px)] [--bliss-gutter-x:12px] pad:[--bliss-gutter-t:calc(var(--spacing-strip)+10px)] short:[--bliss-gutter-t:calc(var(--spacing-control-md)+6px)]"
    >
      <ol className="flex w-[min(420px,100%)] flex-col gap-6">
        {[...list].reverse().map((n) => (
          <NoticeCard key={n.id} notice={n} />
        ))}
      </ol>
    </section>
  );
}
