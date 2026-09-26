import { formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { isPositive, sum } from '@bliss/shared/money';
import { businessDate, zonedParts } from '@bliss/shared/time';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBan, IconCalendar, IconClock, IconDiscount2, IconHourglass, IconReceipt, IconTable, IconUserShare } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ROLE_LABEL } from '../../../_lib/labels';
import { StaffAvatar } from '../../../people/staff/avatar';
import { ShiftActions } from './shift-actions';

export async function generateMetadata({ params }: { params: Promise<{ shiftId: string }> }): Promise<Metadata> {
  const shift = trade.shiftById((await params).shiftId);
  return { title: shift ? `${identity.displayName(shift.staffId)}, ${formatIsoDate(shift.businessDate)}` : 'Shift' };
}

function localInput(at: number, tz: string) {
  const p = zonedParts(at, tz);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/**
 * One shift: who worked it, the tabs they opened, the bills they settled, and what they voided.
 * A shift left open after its person went home can be ended here, at the time it really ended.
 */
export default async function ShiftPage({ params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await params;
  const shift = trade.shiftById(shiftId);
  if (!shift) notFound();
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const actor = await identity.currentConsoleActor();
  const person = identity.staffById(shift.staffId);
  const name = identity.displayName(shift.staffId);
  const until = shift.endedAt ?? Date.now();
  const within = (at: number | null | undefined) => at !== null && at !== undefined && at >= shift.startedAt && at <= until;

  const tabs = trade
    .tabsOn(shift.businessDate)
    .filter((t) => t.openedBy === shift.staffId && within(t.openedAt))
    .sort((a, b) => a.openedAt - b.openedAt);
  const bills = settlement
    .billsOn(shift.businessDate)
    .filter((b) => b.settledBy === shift.staffId && within(b.settledAt))
    .sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0));
  const voids = trade
    .voidedBetween(shift.businessDate, shift.businessDate)
    .filter((l) => (l.voidedBy === shift.staffId || l.createdBy === shift.staffId) && within(l.voidedAt))
    .sort((a, b) => (a.voidedAt ?? 0) - (b.voidedAt ?? 0));
  const settled = sum(bills.map(settlement.billNet));
  const stale = shift.status === 'open' && shift.businessDate < businessDate(Date.now(), tz, outlet.businessDayCutover);
  const title = `${name}, ${formatIsoDate(shift.businessDate)}`;
  const tabLabel = (tabId: string) => {
    const tab = trade.tabById(tabId);
    if (!tab) return 'A tab';
    const s = trade.summarise(tab);
    return tab.tabNumber ? `${s.tableLabel}, tab ${tab.tabNumber}` : s.tableLabel;
  };

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/trade/shifts', label: 'Shifts' }}
        title={
          <span className="flex items-center gap-12">
            <StaffAvatar name={name} avatarUrl={person?.avatarUrl ?? null} colourIndex={person?.colourIndex ?? 0} size="md" />
            {title}
          </span>
        }
        status={shift.status === 'open' ? <StatusChip status="open" label="On shift" /> : <StatusChip status="settled" label="Ended" />}
        meta={
          <MetaRow
            items={[
              {
                value: (
                  <EntityLink kind="staff" id={shift.staffId} muted>
                    {ROLE_LABEL[shift.roleAtShift] ?? shift.roleAtShift}
                  </EntityLink>
                ),
              },
              { icon: IconCalendar, value: formatIsoDate(shift.businessDate) },
              { icon: IconClock, value: `${formatTime(shift.startedAt, tz)} to ${shift.endedAt ? formatTime(shift.endedAt, tz) : 'now'}` },
              { icon: IconHourglass, value: formatElapsed(until - shift.startedAt) },
              shift.handoverTo
                ? {
                    icon: IconUserShare,
                    value: (
                      <EntityLink kind="staff" id={shift.handoverTo} muted>
                        Handed over to {identity.displayName(shift.handoverTo)}
                      </EntityLink>
                    ),
                  }
                : null,
            ]}
          />
        }
        actions={
          shift.status === 'open' && identity.can(actor.staffId, 'staff.manage') ? (
            <ShiftActions shiftId={shift.id} name={name} startedAt={localInput(shift.startedAt, tz)} suggestedEnd={localInput(Math.max(shift.startedAt, tabs.at(-1)?.closedAt ?? bills.at(-1)?.settledAt ?? Date.now()), tz)} />
          ) : null
        }
      />

      {stale ? (
        <Callout tone="low" title="Still open from an earlier day">
          {name} did not sign out. End the shift at the time they left, so their hours and the next day read true.
        </Callout>
      ) : null}

      <MetricGrid>
        <Metric label="Sales" icon={IconReceipt} tone="poured" value={<Money value={shift.salesCents} size="num-kpi" decimals="whole" />} detail={bills.length > 0 ? `${plural(bills.length, 'bill')} settled by ${name}` : 'Settled on the tabs they served'} />
        <Metric label="Tabs opened" icon={IconTable} value={shift.tabsOpened} detail={shift.tabsHandedOver > 0 ? `${shift.tabsHandedOver} handed over` : 'None handed over'} />
        <Metric label="Voids" icon={IconBan} tone={isPositive(shift.voidsCents) ? 'stop' : 'default'} value={<Money value={shift.voidsCents} size="num-kpi" decimals="whole" />} detail={voids.length > 0 ? plural(voids.length, 'line') : 'Nothing voided'} />
        <Metric
          label="Discounts"
          icon={IconDiscount2}
          tone={isPositive(shift.discountsCents) ? 'attention' : 'default'}
          value={<Money value={shift.discountsCents} size="num-kpi" decimals="whole" />}
          detail={isPositive(shift.discountsCents) ? 'Given off the price' : 'No discounts given'}
        />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="shift-tabs">
          <CardHeader band level="h2" titleId="shift-tabs" title="Tabs opened" subtitle={tabs.length > 0 ? plural(tabs.length, 'tab') : undefined} />
          {tabs.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="No tabs opened" body="Tabs this person opens during the shift appear here." />
            </div>
          ) : (
            <LedgerList className="mx-20 my-16" label="Tabs opened">
              {tabs.map((t) => (
                <LedgerItem key={t.id} tone={t.status === 'voided' ? 'stop' : t.status === 'settled' ? 'poured' : undefined}>
                  <span className="flex items-baseline justify-between gap-12">
                    <EntityLink kind="tab" id={t.id} className="text-ui">
                      {tabLabel(t.id)}
                    </EntityLink>
                    <Money value={trade.tabTotal(t.id)} size="num-md" />
                  </span>
                  <span className="block text-body-sm text-ink-subtle">
                    {formatTime(t.openedAt, tz)}, {plural(t.guestCount, 'guest')}
                    {t.assignedTo !== shift.staffId ? `, now with ${identity.displayName(t.assignedTo)}` : ''}
                  </span>
                </LedgerItem>
              ))}
            </LedgerList>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="shift-bills">
            <CardHeader band level="h2" titleId="shift-bills" title="Bills settled" subtitle={bills.length > 0 ? undefined : 'None on this shift'} actions={bills.length > 0 ? <Money value={settled} size="num-md" /> : null} />
            {bills.length > 0 ? (
              <LedgerList className="mx-20 my-16" label="Bills settled">
                {bills.map((b) => (
                  <LedgerItem key={b.id}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="bill" id={b.id} className="text-ui">
                        Bill {b.billNumber}
                      </EntityLink>
                      <Money value={settlement.billNet(b)} size="num-md" />
                    </span>
                    <span className="block text-body-sm text-ink-subtle">{formatTime(b.settledAt ?? 0, tz)}</span>
                  </LedgerItem>
                ))}
              </LedgerList>
            ) : null}
          </Card>

          <Card aria-labelledby="shift-voids">
            <CardHeader band level="h2" titleId="shift-voids" title="Voids" subtitle={voids.length > 0 ? 'Lines they rang up or voided' : 'Nothing voided on this shift'} />
            {voids.length > 0 ? (
              <LedgerList className="mx-20 my-16" label="Voided lines">
                {voids.map((l) => (
                  <LedgerItem key={l.id} tone="stop">
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="tab" id={l.tabId} className="text-ui">
                        {tabLabel(l.tabId)}
                      </EntityLink>
                      <Money value={l.lineTotalCents} size="num-md" />
                    </span>
                    <span className="block text-body-sm text-ink-subtle">
                      {formatTime(l.voidedAt ?? 0, tz)}, by {identity.displayName(l.voidedBy)}
                      {l.voidReason ? `: ${l.voidReason}` : ''}
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
