'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { useDismiss } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconChevronDown, IconChevronRight, IconDeviceTablet } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavCount } from '../../_lib/counts';
import { crumbsFor, isRecordPath, pageFor } from '../../_lib/nav';
import { useRecordCrumb } from './crumbs';

export interface StationStatus {
  id: string;
  label: string;
  kind: string;
  online: boolean;
  lastSeenAt: number | null;
  unsynced: number;
}

/** The element the sheet scrolls in: the header reads it, and the page resets it on a new route. */
export const SHEET_SCROLL_ID = 'console-sheet';

/**
 * The sheet's header. docs/19 section 4.3. It rides at the top of the floating sheet and stays
 * there as the page scrolls under it: a hairline appears once there is something beneath it.
 *
 * Row one says where you are (the workspace's icon, then the breadcrumb, naming the record on a
 * record page) and, on the right, only what is worth knowing: orders a station is holding, and
 * the stations. Row two is the workspace's views as underline tabs with their counts; a record
 * page has none, since its own header carries the way back.
 */
export function SheetHeader({
  stations,
  timezone,
  icons,
  counts,
}: {
  stations: readonly StationStatus[];
  timezone: string;
  /** Each workspace's icon, keyed by its href. */
  icons: Record<string, ReactNode>;
  /** Each view's count, keyed by its href. */
  counts: Record<string, NavCount>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const record = useRecordCrumb();
  const crumbs = crumbsFor(pathname, record);
  const found = pageFor(pathname);
  const onRecord = isRecordPath(pathname);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sheet = document.getElementById(SHEET_SCROLL_ID);
    if (!sheet) return undefined;
    const onScroll = () => setScrolled(sheet.scrollTop > 4);
    onScroll();
    sheet.addEventListener('scroll', onScroll, { passive: true });
    return () => sheet.removeEventListener('scroll', onScroll);
  }, []);

  // R refreshes the page's data from the server, without a full reload.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'r' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      router.refresh();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const holding = stations.filter((s) => s.unsynced > 0);
  const waiting = holding.reduce((n, s) => n + s.unsynced, 0);
  const views = found && !onRecord ? found.workspace.pages : [];
  const current = found?.page?.href ?? null;

  return (
    <header className={cx('sticky top-0 z-bar shrink-0 bg-page transition-hover', scrolled || views.length > 0 ? 'border-b border-rule' : 'border-b border-transparent')}>
      <div className="flex h-bar items-center justify-between gap-16 px-32">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-12">
          {found ? (
            <span aria-hidden="true" className="flex size-control-sm shrink-0 items-center justify-center rounded-md bg-band-strong text-ink-muted">
              {icons[found.workspace.href]}
            </span>
          ) : null}
          <ol className="flex min-w-0 items-center gap-6 text-body-sm">
            {crumbs.map((crumb, i) => (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 ? (
                  <li aria-hidden="true" className="text-ink-disabled">
                    <IconChevronRight size={14} stroke={1.5} />
                  </li>
                ) : null}
                <li className="min-w-0 truncate">
                  {crumb.href ? (
                    <Link href={crumb.href} className="rounded-sm text-ink-muted transition-hover hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="font-medium text-ink">
                      {crumb.label}
                    </span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-8">
          {waiting > 0 ? (
            <Link
              href="/console/settings/devices"
              className="inline-flex h-control-sm items-center gap-8 rounded-pill bg-attention-wash px-12 text-body-sm font-medium text-attention transition-hover hover:bg-low-wash"
            >
              <span aria-hidden="true" className="size-dot rounded-dot bg-attention" />
              {holding.length === 1
                ? `${waiting} ${waiting === 1 ? 'order' : 'orders'} waiting on ${holding[0]!.label}`
                : `${waiting} orders waiting on ${holding.length} stations`}
            </Link>
          ) : null}
          <StationsPopover stations={stations} timezone={timezone} />
        </div>
      </div>

      {views.length > 0 ? (
        <nav aria-label={`${found!.workspace.label} views`} className="px-32">
          <ul className="flex items-center gap-24 overflow-x-auto no-scrollbar">
            {views.map((view) => {
              const active = view.href === current;
              const c = counts[view.href];
              return (
                <li key={view.href} className="shrink-0">
                  <Link
                    href={view.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative inline-flex h-control-md items-center gap-6 text-body-sm transition-hover',
                      active ? 'font-medium text-ink' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {view.label}
                    {c && c.count > 0 ? (
                      <span
                        className={cx(
                          'inline-flex h-count min-w-count items-center justify-center rounded-pill px-6 font-mono tabular text-num-sm',
                          c.tone === 'stop' ? 'bg-stop-wash text-stop' : c.tone === 'attention' ? 'bg-attention-wash text-attention' : 'bg-band-strong text-ink-muted',
                        )}
                      >
                        {c.count}
                      </span>
                    ) : null}
                    <span aria-hidden="true" className={cx('absolute inset-x-0 bottom-0 h-2 rounded-pill transition-hover', active ? 'bg-ink' : 'bg-transparent')} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function StationsPopover({ stations, timezone }: { stations: readonly StationStatus[]; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const online = stations.filter((s) => s.online).length;
  const all = stations.length;

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(panelRef, open, () => close(false));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? 'stations-panel' : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-control-sm items-center gap-8 rounded-pill border border-edge px-12 text-body-sm text-ink-muted transition-hover hover:border-edge-strong hover:text-ink aria-expanded:border-edge-strong aria-expanded:text-ink"
      >
        <span aria-hidden="true" className={cx('size-dot rounded-dot', online === all ? 'animate-breathe bg-poured' : online === 0 ? 'bg-ink-disabled' : 'bg-attention')} />
        <span className="tabular">
          {online} of {all} stations online
        </span>
        <IconChevronDown size={14} stroke={1.5} aria-hidden="true" className={cx('text-ink-subtle transition-card', open && 'rotate-180')} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id="stations-panel"
              role="dialog"
              aria-label="Stations"
              tabIndex={-1}
              style={{ top: position?.top ?? -9999, right: position?.right ?? -9999 }}
              className="fixed z-popover w-popover rounded-card border border-edge bg-card p-4 shadow-popover"
            >
              <ul className="flex flex-col">
                {stations.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/console/settings/devices/${s.id}`}
                      onClick={() => close(false)}
                      className="flex items-center gap-12 rounded-md px-8 py-8 transition-hover hover:bg-band-strong"
                    >
                      <span className="flex size-control-sm shrink-0 items-center justify-center rounded-md bg-band-strong text-ink-subtle">
                        <IconDeviceTablet size={16} stroke={1.5} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium text-ink">{s.label}</span>
                        <span className="block truncate text-body-sm text-ink-subtle">
                          {s.online
                            ? 'Online'
                            : s.lastSeenAt
                              ? `Last seen ${Date.now() - s.lastSeenAt < 12 * 3_600_000 ? formatAgo(Date.now() - s.lastSeenAt) : `at ${formatTime(s.lastSeenAt, timezone)}`}`
                              : 'Not seen yet'}
                        </span>
                      </span>
                      {s.unsynced > 0 ? (
                        <span className="text-body-sm font-medium text-attention tabular">{s.unsynced} waiting</span>
                      ) : (
                        <span aria-hidden="true" className={cx('size-dot rounded-dot', s.online ? 'bg-poured' : 'bg-ink-disabled')} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-edge px-8 pb-4 pt-8">
                <Link href="/console/settings/devices" onClick={() => close(false)} className="text-body-sm font-medium text-accent-text transition-hover hover:text-ink">
                  Manage devices
                </Link>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
