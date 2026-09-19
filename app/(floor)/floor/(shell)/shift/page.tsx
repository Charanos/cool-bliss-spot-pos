'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { staffPhoto } from '@/lib/pos/staff-photos';
import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconClockHour4,
  IconCloudCheck,
  IconCoffee,
  IconFlame,
  IconLogout,
  IconReceipt2,
  IconUsers,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { posDb } from '@/lib/pos/db';
import { useOpenTabs, useOutlet, useStaffDirectory } from '@/lib/pos/queries';
import { signOut, useSession } from '@/lib/pos/session';
import { useSync } from '@/lib/pos/sync';
import { ShiftHandoverSheet } from './_components/shift-handover-sheet';
import { ShiftMetricCard } from './_components/shift-metric-card';
import { ShiftTabCard } from './_components/shift-tab-card';

/**
 * Production-grade Floor Waiter Shift Surface.
 * Conforms to docs/12-surface-language.md, docs/13-floor-tabs-revamp.md and docs/15-floor-orders-revamp.md:
 * - Live Shift Telemetry header with active break toggle and waiter status
 * - Bento grid of tactile performance metrics (Active Tabs, Floor Volume, Orders Fired, Sync Outbox)
 * - Assigned Tables & Tabs stack with seat chips, zone tags, and individual tab totals
 * - Live workload-aware shift handover console
 * - Pre-flight sign-out safety guard
 * - Strictly follows bliss/one-pane and bliss/max-font-weight guidelines
 */
export default function ShiftPage() {
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const allTabs = useOpenTabs();
  const staff = useStaffDirectory();
  const sync = useSync();
  const now = useNow(30_000);

  const [handoverOpen, setHandoverOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [onBreak, setOnBreak] = useState(false);

  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  // Live query of orders fired during this session
  const firedOrders = useLiveQuery(async () => {
    if (!session) return [];
    const orders = await posDb()
      .orders.where('status')
      .notEqual('draft')
      .toArray();
    return orders.filter(
      (o) =>
        o.firedBy === session.staffId &&
        (o.firedAt ?? 0) >= session.signedInAt,
    );
  }, [session?.staffId, session?.signedInAt]);

  if (!session) return null;

  // Tabs assigned to this waiter
  const myTabs = (allTabs ?? []).filter(
    (t) => t.tab.assignedTo === session.staffId,
  );
  const floorLiabilityTotal = sum(myTabs.map((t) => t.total));
  const totalGuests = myTabs.reduce(
    (acc, t) => acc + (t.tab.guestCount ?? t.seats.length),
    0,
  );

  // Colleague directory eligible for handover
  const colleagues = (staff ?? []).filter(
    (s) =>
      s.id !== session.staffId &&
      (s.roleKey === 'waiter' || s.roleKey === 'supervisor'),
  );

  const firedCount = firedOrders?.length ?? 0;

  const photoUrl = staffPhoto(session.displayName);
  const nameParts = session.displayName.split(/\s+/);
  const initials = nameParts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent overflow-hidden">
      {/* ── Sticky Frosted Header & Shift Telemetry ─────────────────── */}
      <header className="shrink-0 z-10 border-b border-rule-raised/20 bg-page/85 px-16 tablet:px-24 py-16 tablet:py-20 backdrop-blur-md shadow-sm">
        <div className="flex flex-col gap-10 tablet:gap-12">
          {/* Main Masthead Row: Identity on Left, Actions on Right (Unified Command Bar) */}
          <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-12 tablet:gap-16">
            {/* Left: Avatar + Display Name + Role Badge + Live Status Pill */}
            <div className="flex items-center gap-12 min-w-0">
              {/* Waiter Circular Photo Avatar (Exact match to Top Bar profile) */}
              <div
                aria-hidden="true"
                className="flex size-[44px] tablet:size-[48px] items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-label font-medium text-accent-text select-none shadow-sm shrink-0 transition-transform hover:scale-105"
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={session.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="flex items-center gap-8 min-w-0 flex-wrap">
                <div className="flex flex-col gap-1">
                <h1 className="text-title-lg font-medium tracking-tight text-ink truncate leading-none">
                  {session.displayName}
                </h1>

                <span
                  className="font-mono text-micro mt-6 text-ink/40 uppercase tracking-wider"
                >
                  {session.roleKey === 'supervisor' ? 'Supervisor' : 'Floor Waiter'}
                </span>
                </div>

                {/* Status indicator badge */}
                {onBreak ? (
                  <Badge
                    tone="stop"
                    className="!rounded-dot px-10 py-1 font-mono text-micro shadow-[0_0_12px_color-mix(in_oklab,var(--color-stop)_20%,transparent)]"
                  >
                    <Dot tone="stop" />
                    <span>On Break · Away</span>
                  </Badge>
                ) : (
                  <Badge
                    tone="poured"
                    className="!rounded-dot px-10 py-1 font-mono text-micro shadow-[0_0_12px_color-mix(in_oklab,var(--color-poured)_20%,transparent)]"
                  >
                    <Dot tone="poured" />
                    <span>On Floor · Active</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: Actions aligned on the EXACT SAME HORIZONTAL ROW as Peter! */}
            <div className="flex items-center gap-12 shrink-0">
              <Button
                variant={onBreak ? 'destructive' : 'secondary'}
                size="md"
                icon={onBreak ? IconCheck : IconCoffee}
                onClick={() => setOnBreak((prev) => !prev)}
                className={cx(
                  '!rounded-dot px-16 text-body-sm font-medium transition-all shadow-sm',
                  onBreak
                    ? '!bg-stop !text-stop-ink hover:!bg-stop/90'
                    : 'bg-control text-ink hover:bg-control-hover border border-rule-raised/40',
                )}
              >
                {onBreak ? 'Resume floor duty' : 'Take a break'}
              </Button>

              <Button
                variant="primary"
                size="md"
                icon={IconUsers}
                disabled={myTabs.length === 0}
                onClick={() => setHandoverOpen(true)}
                className="!rounded-dot px-18 text-body-sm font-medium shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Hand over section
              </Button>
            </div>
          </div>

          {/* Subtitle Telemetry Row: Indented exactly under Peter (pl-[56px] tablet:pl-[60px]) */}
          <div className="flex items-center gap-6 pl-0 tablet:pl-[60px] font-mono text-micro text-ink-subtle flex-wrap">
            <span className="inline-flex items-center gap-4 text-ink-subtle">
              <IconClockHour4 size={12} stroke={ICON_STROKE} className="text-ink-muted shrink-0" />
              <span>Clocked in {formatTime(session.signedInAt, tz)}</span>
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="text-ink-muted">
              <Elapsed since={session.signedInAt} /> on floor
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            <span className="text-ink-subtle">
              {plural(totalGuests, 'guest cover')} under care
            </span>
            <span aria-hidden="true" className="text-ink-disabled">·</span>
            {firedCount > 0 ? (
              <span className="text-ink-subtle">
                {firedCount} order(s) fired <span className="text-ink text-body">{formatKes(floorLiabilityTotal, { decimals: 'whole' })}</span>
              </span>
            ) : (
              <span className="text-ink-subtle">No orders fired yet</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Scrollable Body ─────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-16 tablet:px-24 py-24 pb-[160px] flex flex-col gap-32">
        {/* Success Notice after Handover */}
        {successNotice ? (
          <InlineNotice tone="poured" className="shadow-sm">
            <div className="flex items-center justify-between w-full">
              <span>{successNotice}</span>
              <button
                type="button"
                onClick={() => setSuccessNotice(null)}
                className="font-mono text-micro uppercase tracking-wider text-poured hover:underline ml-12 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </InlineNotice>
        ) : null}

        {/* ── 1. Bento Grid of Tactile Shift Metrics ─────────────────── */}
        <section aria-labelledby="shift-metrics-title">
          <h2 id="shift-metrics-title" className="sr-only">
            Shift Performance Metrics
          </h2>
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-12 tablet:gap-16">
            {/* Metric 1: Open Tabs */}
            <ShiftMetricCard
              label="Assigned tabs"
              value={
                <span className="font-mono tabular text-display font-medium text-ink">
                  {myTabs.length}
                </span>
              }
              subtitle={
                myTabs.length > 0
                  ? `${plural(totalGuests, 'guest cover')} seated`
                  : 'No active tables on floor'
              }
              icon={IconReceipt2}
              tone="accent"
              badge={
                myTabs.length > 0 ? (
                  <Badge tone="accent" className="!rounded-dot px-8 py-1 font-mono text-micro">
                    <Dot tone="accent" />
                    <span>Active</span>
                  </Badge>
                ) : null
              }
            />

            {/* Metric 2: Floor Liability Spend */}
            <ShiftMetricCard
              label="Floor spend"
              value={<Money value={floorLiabilityTotal} size="display" tone="money" />}
              subtitle="Active unbilled guest liability"
              icon={IconCash}
              tone="money"
              badge={
                floorLiabilityTotal > 0 ? (
                  <Badge tone="poured" className="!rounded-dot px-8 py-1 font-mono text-micro">
                    <Dot tone="poured" />
                    <span>Live</span>
                  </Badge>
                ) : null
              }
            />

            {/* Metric 3: Orders Fired */}
            <ShiftMetricCard
              label="Orders fired"
              value={
                <span className="font-mono tabular text-display font-medium text-ink">
                  {firedCount}
                </span>
              }
              subtitle={
                firedCount > 0
                  ? `${plural(firedCount, 'round')} sent this shift`
                  : 'Rounds sent to bar & kitchen'
              }
              icon={IconFlame}
              tone="poured"
              badge={
                firedCount > 0 ? (
                  <Badge tone="poured" className="!rounded-dot px-8 py-1 font-mono text-micro">
                    <Dot tone="poured" />
                    <span>Active</span>
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="!rounded-dot px-8 py-1 font-mono text-micro">
                    <span>Shift</span>
                  </Badge>
                )
              }
            />

            {/* Metric 4: Tablet Sync Status */}
            <ShiftMetricCard
              label="Tablet outbox"
              value={
                sync.heldOrders > 0 ? (
                  <div className="flex items-baseline gap-8 leading-none">
                    <span className="font-mono tabular text-display font-medium text-stop">
                      {sync.heldOrders}
                    </span>
                    <span className="font-mono text-body-sm text-stop font-medium">
                      held
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-8 leading-none">
                    <span className="font-mono tabular text-display font-medium text-ink">
                      0
                    </span>
                    <span className="font-mono text-body-sm text-served font-medium">
                      Synced
                    </span>
                  </div>
                )
              }
              subtitle={
                sync.heldOrders > 0
                  ? `${plural(sync.heldOrders, 'order')} waiting for uplink`
                  : 'Connected to cloud event log'
              }
              icon={IconCloudCheck}
              tone={sync.heldOrders > 0 ? 'stop' : 'served'}
              badge={
                <Badge
                  tone={sync.heldOrders > 0 ? 'stop' : 'served'}
                  className="!rounded-dot px-8 py-1 font-mono text-micro"
                >
                  <Dot tone={sync.heldOrders > 0 ? 'stop' : 'served'} />
                  <span>{sync.heldOrders > 0 ? 'Pending' : 'Synced'}</span>
                </Badge>
              }
            />
          </div>
        </section>

        {/* visual seperator */}
        <div className="border border-sunken/80 w-full" />

        {/* ── 2. Assigned Tables & Tabs Roster ───────────────────────── */}
        <section aria-labelledby="assigned-tabs-title" className="flex flex-col gap-16 w-full mt-16">
          <div className="flex items-center justify-between gap-16 w-full">
              <h2 id="assigned-tabs-title" className="text-title font-medium text-ink tracking-tight">
                Active tables in your name
              </h2>
              <Badge tone="neutral" className="!rounded-dot px-10 py-1.5 font-mono text-micro">
                {plural(myTabs.length, 'active tab')}
              </Badge>
          </div>

          {myTabs.length === 0 ? (
            <div className="rounded-lg bg-raised/50 backdrop-blur-md border border-rule-raised/30 p-32 tablet:p-40 text-center flex flex-col items-center justify-center gap-14 shadow-sm">
              <div className="size-[48px] rounded-md bg-wash border border-rule-raised/30 flex items-center justify-center text-ink-subtle shadow-sm">
                <IconCheck size={24} stroke={ICON_STROKE} />
              </div>
              <div className="flex flex-col gap-4 max-w-[420px]">
                <span className="text-body-lg font-medium text-ink">
                  No active tables in your name
                </span>
                <p className="text-body-sm text-ink-subtle leading-relaxed">
                  Your section is clear. You can open a new table from the Tabs screen, or receive an incoming section handover from a colleague.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/floor/tabs')}
                className="mt-4 !rounded-dot px-20"
              >
                Go to Floor Tabs
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-14 tablet:gap-18">
              {myTabs.map((t) => (
                <ShiftTabCard
                  key={t.tab.id}
                  tabId={t.tab.id}
                  label={t.label}
                  seats={t.seats}
                  showSeats={t.showSeats}
                  openedAt={t.tab.openedAt}
                  total={t.total}
                  onOpen={() => router.push(`/floor/tabs/${t.tab.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="border border-sunken/80 w-full" />

        {/* ── 3. Pre-flight Sign-Out & Handover Safety Guard ──────────── */}
        <section aria-labelledby="shift-security-title" className="pt-8 mt-8">
          <div  
            className={cx(
              'relative overflow-hidden rounded-lg p-20 tablet:p-24 transition-all',
              'bg-raised/70 backdrop-blur-md border shadow-lift',
              myTabs.length > 0
                ? 'border-stop/30 hover:border-stop/40'
                : 'border-served/30 hover:border-served/40',
              'flex flex-col tablet:flex-row tablet:items-center justify-between gap-18 tablet:gap-24',
            )}
          >
            {/* Ambient Top Glow Line */}
            <div
              aria-hidden="true"
              className={cx(
                'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r',
                myTabs.length > 0
                  ? 'from-stop/60 via-stop/20 to-transparent'
                  : 'from-served/60 via-served/20 to-transparent',
              )}
            />

            {/* Left: Icon + Security Telemetry Copy */}
            <div className="flex items-start gap-16 min-w-0">
              <div
                className={cx(
                  'size-[40px] rounded-md flex items-center justify-center shrink-0 shadow-sm mt-0.5 border',
                  myTabs.length > 0
                    ? 'bg-stop/15 text-stop border-stop/30'
                    : 'bg-served/15 text-served border-served/30',
                )}
              >
                {myTabs.length > 0 ? (
                  <IconAlertCircle size={20} stroke={ICON_STROKE} />
                ) : (
                  <IconCheck size={20} stroke={ICON_STROKE} />
                )}
              </div>

              <div className="flex flex-col gap-4 min-w-0">
                <span className="text-body-lg font-medium text-ink">
                  {myTabs.length > 0
                    ? `You have ${plural(myTabs.length, 'active tab')} on the floor`
                    : 'Section clear · Ready for shift sign-out'}
                </span>
                <p className="text-body-sm text-ink-subtle leading-relaxed max-w-[620px]">
                  {myTabs.length > 0
                    ? 'We recommend handing over open tables to another waiter before signing off so guests continue receiving service uninterrupted.'
                    : 'All orders fired have synced and no tables remain in your name. You can safely sign off this tablet.'}
                </p>
              </div>
            </div>

            {/* Right: Paired Action Buttons */}
            <div className="flex items-center gap-12 shrink-0 flex-wrap">
              {myTabs.length > 0 ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={IconUsers}
                  onClick={() => setHandoverOpen(true)}
                  className="!rounded-dot px-18 text-body-sm font-medium shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  Hand over tabs
                </Button>
              ) : null}

              <Button
                variant="destructive"
                size="md"
                icon={IconLogout}
                onClick={() =>
                  void signOut().then(() => {
                    router.replace('/floor/sign-in');
                  })
                }
                className={cx(
                  '!rounded-dot px-16 text-body-sm font-medium transition-all shadow-sm',
                  myTabs.length > 0
                    ? '!bg-transparent !text-stop border border-stop/40 hover:!bg-stop/10'
                    : '!bg-stop !text-stop-ink hover:!bg-stop/90',
                )}
              >
                Sign out
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Bottom Docked Base Action ───────────────────────────────── */}
      <BaseAction>
        <Button
          variant="primary"
          size="xl"
          icon={IconUsers}
          disabled={myTabs.length === 0}
          onClick={() => setHandoverOpen(true)}
        >
          {myTabs.length > 0
            ? `Hand over ${plural(myTabs.length, 'tab')}`
            : 'Hand over section'}
        </Button>
      </BaseAction>

      {/* ── Production Handover Console Modal ───────────────────────── */}
      <ShiftHandoverSheet
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        myTabs={myTabs}
        colleagues={colleagues}
        allTabs={allTabs ?? []}
        onSuccess={(msg) => setSuccessNotice(msg)}
      />
    </div>
  );
}
