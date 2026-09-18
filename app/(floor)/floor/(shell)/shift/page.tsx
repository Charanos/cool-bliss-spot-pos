'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { Money } from '@bliss/ui/components/money';
import { OverlayActions } from '@bliss/ui/components/overlay';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { Pane } from '@bliss/ui/components/surface';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconLogout, IconUsers } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { posDb } from '@/lib/pos/db';
import { handOver } from '@/lib/pos/mutations';
import { useOpenTabs, useOutlet, useStaffDirectory } from '@/lib/pos/queries';
import { signOut, useSession } from '@/lib/pos/session';
import { useSync } from '@/lib/pos/sync';

/**
 * My shift, and handing it over. docs/05 section 2.11: seats, labels and lines are untouched; only
 * responsibility moves. F-15: hand my open tabs to another waiter at shift change.
 */
export default function ShiftPage() {
  const router = useRouter();
  const session = useSession();
  const outlet = useOutlet();
  const tabs = useOpenTabs();
  const staff = useStaffDirectory();
  const sync = useSync();
  const now = useNow(30_000);
  const [picker, setPicker] = useState(false);
  const [to, setTo] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const fired = useLiveQuery(async () => {
    if (!session) return 0;
    const orders = await posDb().orders.where('status').notEqual('draft').toArray();
    return orders.filter((o) => o.firedBy === session.staffId && (o.firedAt ?? 0) >= session.signedInAt).length;
  }, [session?.staffId, session?.signedInAt]);

  if (!session) return null;
  const mine = (tabs ?? []).filter((t) => t.tab.assignedTo === session.staffId);
  const total = sum(mine.map((t) => t.total));
  const colleagues = (staff ?? []).filter((s) => s.id !== session.staffId && (s.roleKey === 'waiter' || s.roleKey === 'supervisor'));
  const target = colleagues.find((c) => c.id === to);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-rule px-24 pb-16 pt-20">
        <h1 className="text-title-lg text-ink">My shift</h1>
        <p className="mt-4 text-body text-ink-subtle">
          Started {formatTime(session.signedInAt, tz)} · {formatElapsed(now - session.signedInAt)} on the floor
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-24 pb-32 pt-20">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-12">
          {[
            { label: 'Tabs open in my name', value: <span className="font-mono tabular text-num-lg text-ink">{mine.length}</span> },
            { label: 'On the floor', value: <Money value={total} size="num-lg" tone="money" /> },
            { label: 'Orders fired this shift', value: <span className="font-mono tabular text-num-lg text-ink">{fired ?? 0}</span> },
            {
              label: 'Held on this tablet',
              value: <span className={cx('font-mono tabular text-num-lg', sync.heldOrders > 0 ? 'text-info' : 'text-ink')}>{sync.heldOrders}</span>,
            },
          ].map((m) => (
            <Pane key={m.label}>
              <p className="text-label text-ink-subtle">{m.label}</p>
              <div className="mt-8">{m.value}</div>
            </Pane>
          ))}
        </div>

        <section aria-labelledby="my-tabs" className="mt-32">
          <div className="flex items-end justify-between gap-16">
            <div>
              <h2 id="my-tabs" className="text-title text-ink">
                Hand over at shift change
              </h2>
              <p className="mt-4 text-body text-ink-muted">Handing over moves every open tab in your name. Nothing closes, and no line changes.</p>
            </div>
          </div>
          {done ? (
            <InlineNotice tone="poured" className="mt-12">
              {done}
            </InlineNotice>
          ) : null}
          {mine.length === 0 ? (
            <EmptyState title="No tabs in your name" body="There is nothing to hand over." className="py-24" />
          ) : (
            <ul className="mt-16 divide-y divide-rule border-y border-rule">
              {mine.map((t) => (
                <li key={t.tab.id}>
                  <button type="button" onClick={() => router.push(`/floor/tabs/${t.tab.id}`)} className="flex min-h-[64px] w-full items-center gap-16 px-4 text-left press-feedback hover:bg-raised">
                    <span className="w-[140px] shrink-0 text-body text-ink">{t.label}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-4">
                      {t.showSeats ? t.seats.map((s) => <SeatChip key={s.id} seat={s.seatNo} size="dense" settled={s.status === 'settled'} />) : <span className="text-body text-ink-subtle">One seat</span>}
                    </span>
                    <span className="font-mono tabular text-num-sm text-ink-subtle">{formatElapsed(now - t.tab.openedAt)}</span>
                    <Money value={t.total} size="num" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-40 flex flex-wrap items-center gap-16 border-t border-rule pt-24">
          <Button
            variant="quiet-destructive"
            size="lg"
            icon={IconLogout}
            onClick={() =>
              void signOut().then(() => {
                router.replace('/floor/sign-in');
              })
            }
          >
            Sign out of this tablet
          </Button>
          <p className="text-body text-ink-subtle">
            {sync.heldOrders > 0 ? `${plural(sync.heldOrders, 'order')} held here still send after you sign out.` : 'Everything you fired has reached the bar.'}
          </p>
        </section>
      </div>

      <BaseAction>
        <Button variant="primary" size="xl" icon={IconUsers} disabled={mine.length === 0} onClick={() => setPicker(true)}>
          {mine.length > 0 ? `Hand over ${plural(mine.length, 'tab')}` : 'Hand over tabs'}
        </Button>
      </BaseAction>

      <Sheet open={picker} onClose={() => setPicker(false)} title={`Hand over ${plural(mine.length, 'tab')}, ${formatKes(total, { decimals: 'whole' })}`} description="Who is taking your section?" width="md">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-8" role="radiogroup" aria-label="Colleague">
          {colleagues.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={to === c.id}
              onClick={() => setTo(c.id)}
              className={cx('flex h-[72px] flex-col justify-center rounded-md px-16 text-left press-feedback', to === c.id ? 'bg-accent text-accent-ink' : 'bg-control text-ink hover:bg-control-hover')}
            >
              <span className="text-subtitle">{c.displayName}</span>
              <span className={cx('text-body', to === c.id ? 'text-accent-ink/70' : 'text-ink-subtle')}>{c.roleKey === 'supervisor' ? 'Supervisor' : 'Waiter'}</span>
            </button>
          ))}
        </div>
        <OverlayActions>
          <Button variant="ghost" size="lg" onClick={() => setPicker(false)}>
            Keep them
          </Button>
          <Button
            variant="primary"
            size="xl"
            disabled={!target}
            loading={pending}
            onClick={async () => {
              if (!target) return;
              setPending(true);
              await handOver(
                mine.map((t) => t.tab.id),
                target.id,
              );
              setPending(false);
              setPicker(false);
              setDone(`${plural(mine.length, 'tab')} moved to ${target.displayName}. Seats, labels and lines are unchanged.`);
            }}
          >
            {target ? `Hand over ${plural(mine.length, 'tab')} to ${target.displayName}` : `Hand over ${plural(mine.length, 'tab')}`}
          </Button>
        </OverlayActions>
      </Sheet>
    </div>
  );
}
