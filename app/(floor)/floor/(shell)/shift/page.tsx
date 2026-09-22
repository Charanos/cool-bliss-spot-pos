'use client';

import { formatTime, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Elapsed } from '@bliss/ui/components/elapsed';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { MetaLine, SectionHeader } from '@bliss/ui/components/working';
import { staffPhoto } from '@/lib/pos/staff-photos';
import {
  IconAlertCircle,
  IconCash,
  IconCheck,
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
import { MetricTile } from '@bliss/ui/components/metric-tile';
import { ShiftTabCard } from './_components/shift-tab-card';

/**
 * The waiter's shift: who is on, what is in their name, and what has to happen before they can
 * leave. docs/13 and docs/16-responsive-and-offline.md.
 *
 * The page is one scroll region from the phone up. Its header scrolls away on a small screen,
 * where every line of height belongs to the tables, and sticks from a tablet up, where there is
 * room for it. Handing over lives in the dock's action slot, so it is under the thumb wherever the
 * page happens to be scrolled.
 */
export default function ShiftPage() {
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const allTabs = useOpenTabs();
  const staff = useStaffDirectory();
  const sync = useSync();

  const [handoverOpen, setHandoverOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [onBreak, setOnBreak] = useState(false);

  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const firedOrders = useLiveQuery(async () => {
    if (!session) return [];
    const orders = await posDb().orders.where('status').notEqual('draft').toArray();
    return orders.filter((o) => o.firedBy === session.staffId && (o.firedAt ?? 0) >= session.signedInAt);
  }, [session?.staffId, session?.signedInAt]);

  if (!session) return null;

  const myTabs = (allTabs ?? []).filter((t) => t.tab.assignedTo === session.staffId);
  const floorLiabilityTotal = sum(myTabs.map((t) => t.total));
  const totalGuests = myTabs.reduce((acc, t) => acc + (t.tab.guestCount ?? t.seats.length), 0);
  const colleagues = (staff ?? []).filter((s) => s.id !== session.staffId && (s.roleKey === 'waiter' || s.roleKey === 'supervisor'));
  const firedCount = firedOrders?.length ?? 0;
  const photoUrl = staffPhoto(session.displayName);
  const role = session.roleKey === 'supervisor' ? 'Supervisor' : 'Floor waiter';

  return (
    <div className="scroll-region flex flex-col">
      <header className="z-10 border-b border-rule-raised/20 bg-page/85 px-12 py-12 backdrop-blur-glass pad:sticky pad:top-0 pad:px-24 pad:py-16 short:py-8">
        <div className="flex flex-col gap-12">
          <div className="flex items-start justify-between gap-12">
            <div className="flex min-w-0 items-center gap-12">
              <span aria-hidden="true" className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-label font-medium text-accent-text pad:size-control-lg">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  session.displayName.slice(0, 1)
                )}
              </span>

              <div className="min-w-0">
                <h1 className="truncate text-title font-medium text-ink pad:text-title-lg">{session.displayName}</h1>
                <p className="flex flex-wrap items-center gap-8">
                  <span className="caps text-ink-subtle">{role}</span>
                  <Badge tone={onBreak ? 'stop' : 'poured'}>
                    <Dot tone={onBreak ? 'stop' : 'poured'} />
                    <span>{onBreak ? 'On break' : 'On floor'}</span>
                  </Badge>
                </p>
              </div>
            </div>

            <Button
              variant={onBreak ? 'primary' : 'secondary'}
              size="md"
              icon={onBreak ? IconCheck : IconCoffee}
              onClick={() => setOnBreak((prev) => !prev)}
              className="shrink-0"
            >
              <span className="hidden compact:inline">{onBreak ? 'Resume floor duty' : 'Take a break'}</span>
              <span className="compact:hidden">{onBreak ? 'Resume' : 'Break'}</span>
            </Button>
          </div>

          <MetaLine
            items={[
              { key: 'in', text: `Clocked in ${formatTime(session.signedInAt, tz)}`, mono: true },
              { key: 'for', text: <Elapsed since={session.signedInAt} /> },
              { key: 'covers', text: `${plural(totalGuests, 'guest cover')} under care` },
              {
                key: 'fired',
                text: firedCount > 0 ? `${plural(firedCount, 'order')} fired, ${formatKes(floorLiabilityTotal, { decimals: 'whole' })} on the floor` : 'No orders fired yet',
              },
            ]}
          />
        </div>
      </header>

      <div className="flex flex-col gap-24 px-12 py-16 pad:gap-32 pad:px-24 pad:py-24">
        {successNotice ? (
          <InlineNotice tone="poured" action={<Button variant="ghost" size="sm" onClick={() => setSuccessNotice(null)}>Dismiss</Button>}>
            {successNotice}
          </InlineNotice>
        ) : null}

        <section aria-labelledby="shift-metrics">
          <h2 id="shift-metrics" className="sr-only">
            This shift
          </h2>
          <div className="grid grid-cols-2 gap-8 pad:gap-16 desktop:grid-cols-4">
            <MetricTile
              label="Assigned tabs"
              value={<span className="font-mono tabular text-num-lg font-medium text-ink">{myTabs.length}</span>}
              subtitle={myTabs.length > 0 ? `${plural(totalGuests, 'guest cover')} seated` : 'No tables in your name'}
              icon={IconReceipt2}
              tone="accent"
              badge={myTabs.length > 0 ? <Badge tone="accent">Active</Badge> : null}
            />

            <MetricTile
              label="Floor spend"
              value={<Money value={floorLiabilityTotal} size="num-lg" tone="money" decimals="whole" />}
              subtitle="Open, not yet billed"
              icon={IconCash}
              tone="money"
              badge={floorLiabilityTotal > 0n ? <Badge tone="poured">Live</Badge> : null}
            />

            <MetricTile
              label="Orders fired"
              value={<span className="font-mono tabular text-num-lg font-medium text-ink">{firedCount}</span>}
              subtitle={firedCount > 0 ? `${plural(firedCount, 'round')} sent this shift` : 'Rounds sent to the counter'}
              icon={IconFlame}
              tone="poured"
            />

            <MetricTile
              label="Tablet outbox"
              value={
                <span className="flex items-baseline gap-8">
                  <span className={sync.heldOrders > 0 ? 'font-mono tabular text-num-lg font-medium text-stop' : 'font-mono tabular text-num-lg font-medium text-ink'}>{sync.heldOrders}</span>
                  <span className={sync.heldOrders > 0 ? 'text-body-sm text-stop' : 'text-body-sm text-served'}>{sync.heldOrders > 0 ? 'held' : 'sent'}</span>
                </span>
              }
              subtitle={sync.heldOrders > 0 ? `${plural(sync.heldOrders, 'order')} waiting to send` : 'Everything has reached the server'}
              icon={IconCloudCheck}
              tone={sync.heldOrders > 0 ? 'stop' : 'served'}
            />
          </div>
        </section>

        <section aria-labelledby="assigned-tabs" className="flex flex-col gap-12">
          <SectionHeader id="assigned-tabs" title="Tables in your name" count={myTabs.length} />

          {myTabs.length === 0 ? (
            <EmptyState
              title="Your section is clear"
              body="Open a table from Tabs, or take a handover from a colleague. Nothing here is waiting on you."
              action={
                <Button variant="primary" size="md" onClick={() => router.push('/floor/tabs')}>
                  Go to tabs
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-12 pad:grid-cols-2 desktop:grid-cols-3">
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

        <section aria-labelledby="sign-out" className="flex flex-col gap-12 rounded-md border border-rule-raised/40 bg-raised/70 p-12 backdrop-blur-glass pad:flex-row pad:items-center pad:justify-between pad:gap-24 pad:rounded-lg pad:p-24">
          <div className="flex min-w-0 items-start gap-12">
            <span
              className={
                myTabs.length > 0
                  ? 'flex size-40 shrink-0 items-center justify-center rounded-md bg-stop/15 text-stop'
                  : 'flex size-40 shrink-0 items-center justify-center rounded-md bg-served/15 text-served'
              }
            >
              {myTabs.length > 0 ? <IconAlertCircle size={20} stroke={ICON_STROKE} aria-hidden="true" /> : <IconCheck size={20} stroke={ICON_STROKE} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h2 id="sign-out" className="text-body-lg font-medium text-ink">
                {myTabs.length > 0 ? `You have ${plural(myTabs.length, 'table')} open` : 'Ready to sign out'}
              </h2>
              <p className="max-w-[62ch] text-body-sm text-ink-subtle">
                {myTabs.length > 0
                  ? 'Hand these over before you sign out, so someone is looking after the guests.'
                  : 'Everything you fired has reached the server and no table is in your name.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-8 compact:flex-row">
            {myTabs.length > 0 ? (
              <Button variant="secondary" size="md" icon={IconUsers} onClick={() => setHandoverOpen(true)}>
                Hand over tables
              </Button>
            ) : null}
            <Button
              variant={myTabs.length > 0 ? 'quiet-destructive' : 'destructive'}
              size="md"
              icon={IconLogout}
              onClick={() => void signOut().then(() => router.replace('/floor/sign-in'))}
            >
              Sign out
            </Button>
          </div>
        </section>
      </div>

      <BaseAction>
        <Button variant="primary" size="xl" icon={IconUsers} disabled={myTabs.length === 0} onClick={() => setHandoverOpen(true)}>
          {myTabs.length > 0 ? `Hand over ${plural(myTabs.length, 'tab')}` : 'Hand over section'}
        </Button>
      </BaseAction>

      <ShiftHandoverSheet
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        myTabs={myTabs}
        allTabs={allTabs ?? []}
        colleagues={colleagues}
        onSuccess={(message) => {
          setHandoverOpen(false);
          setSuccessNotice(message);
        }}
      />
    </div>
  );
}
