'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { useDismiss } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconDeviceTablet, IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { crumbsFor } from '../../_lib/nav';
import { useRecordCrumb } from './crumbs';

export interface StationStatus {
  id: string;
  label: string;
  kind: string;
  online: boolean;
  lastSeenAt: number | null;
  unsynced: number;
}

/**
 * The top bar. docs/19 section 4.3. Where you are on the left, as a breadcrumb that names the
 * record on a detail page; on the right, the stations, and a warning only when orders are waiting.
 * Quiet when all is well: nothing on it asks for attention unless something needs it.
 */
export function TopBar({ stations, timezone }: { stations: readonly StationStatus[]; timezone: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const record = useRecordCrumb();
  const crumbs = crumbsFor(pathname, record);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  return (
    <header className={cx('sticky top-0 z-bar flex h-bar shrink-0 items-center justify-between gap-16 bg-page px-32 transition-hover', scrolled ? 'border-b border-rule' : 'border-b border-transparent')}>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-8 text-body-sm">
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 ? (
                <li aria-hidden="true" className="text-ink-disabled">
                  /
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

      <div className="flex shrink-0 items-center gap-12">
        {waiting > 0 ? (
          <Link
            href="/console/settings/devices"
            className="inline-flex h-control-sm items-center gap-8 rounded-md bg-attention-wash px-12 text-body-sm font-medium text-attention transition-hover hover:bg-low-wash"
          >
            <span aria-hidden="true" className="size-dot rounded-dot bg-attention" />
            {holding.length === 1
              ? `${waiting} ${waiting === 1 ? 'order' : 'orders'} waiting on ${holding[0]!.label}`
              : `${waiting} orders waiting on ${holding.length} stations`}
          </Link>
        ) : null}
        <StationsPopover stations={stations} timezone={timezone} />
      </div>
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
        className="inline-flex h-control-sm items-center gap-8 rounded-md px-8 text-body-sm text-ink-muted transition-hover hover:bg-control hover:text-ink aria-expanded:bg-control aria-expanded:text-ink"
      >
        <span aria-hidden="true" className={cx('size-dot rounded-dot', online === all ? 'bg-poured' : online === 0 ? 'bg-ink-disabled' : 'bg-attention')} />
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
              className="fixed z-popover w-popover rounded-md border border-edge bg-card p-4 shadow-popover"
            >
              <ul className="flex flex-col">
                {stations.map((s) => (
                  <li key={s.id} className="flex items-center gap-12 rounded-sm px-8 py-8">
                    <IconDeviceTablet size={16} stroke={1.5} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-ink">{s.label}</span>
                      <span className="block truncate text-body-sm text-ink-subtle">
                        {s.online ? 'Online' : s.lastSeenAt ? `Last seen ${Date.now() - s.lastSeenAt < 12 * 3_600_000 ? formatAgo(Date.now() - s.lastSeenAt) : `at ${formatTime(s.lastSeenAt, timezone)}`}` : 'Not seen yet'}
                      </span>
                    </span>
                    {s.unsynced > 0 ? (
                      <span className="text-body-sm font-medium text-attention tabular">{s.unsynced} waiting</span>
                    ) : (
                      <span aria-hidden="true" className={cx('size-dot rounded-dot', s.online ? 'bg-poured' : 'bg-ink-disabled')} />
                    )}
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
