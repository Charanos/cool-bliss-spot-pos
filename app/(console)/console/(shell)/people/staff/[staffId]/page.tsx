import { formatDate, formatDateTime, formatElapsed, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { type Cents, isPositive, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import { Card, CardHeader, CardMedia, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Separator } from '@bliss/ui/components/console/section';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconBan, IconClock, IconDeviceTablet, IconPhone, IconReceipt, IconShieldCheck, IconTable } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as audit from '@/modules/audit/service';
import * as pins from '@/modules/identity/pins';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { actionLabel } from '../../../_lib/labels';
import { hrefForEntity } from '../../../_lib/nav';
import { StaffAvatar } from '../avatar';
import { staffRow } from '../staff-row';
import { Access } from '../staff-table';
import { SignInCard, StaffActions } from './staff-actions';

export async function generateMetadata({ params }: { params: Promise<{ staffId: string }> }): Promise<Metadata> {
  const person = identity.staffById((await params).staffId);
  return { title: person?.fullName ?? 'Person' };
}

/**
 * One person: their role and access, and everything that went through their hands over the last
 * four weeks: shifts, tabs, bills, voids, drawers, and what they changed in the Console.
 */
export default async function StaffRecordPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const person = identity.staffById(staffId);
  if (!person) notFound();
  const actor = await identity.currentConsoleActor();
  const tz = identity.outlet().timezone;
  const clock = reporting.clock();
  const from = addDays(clock.current, -27);
  const shifts = trade.shiftsBetween(from, clock.current);
  const row = staffRow(person, shifts, identity.devices(), actor.staffId);
  const role = identity.roleFor(person.id);
  const own = shifts.filter((s) => s.staffId === person.id).sort((a, b) => b.startedAt - a.startedAt);
  const minutes = own.reduce((total, s) => total + Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 60_000), 0);
  const sales = sum(own.map((s) => s.salesCents));
  const voidsCents = sum(own.map((s) => s.voidsCents));
  const holding = trade.openTabs().filter((t) => t.tab.assignedTo === person.id);
  const bills = settlement
    .billsBetween(addDays(clock.current, -6), clock.current)
    .filter((b) => b.settledBy === person.id)
    .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));
  const voids = trade
    .voidedBetween(from, clock.current)
    .filter((l) => l.voidedBy === person.id || l.createdBy === person.id)
    .sort((a, b) => (b.voidedAt ?? 0) - (a.voidedAt ?? 0));
  const drawers = settlement.drawerSessionsBetween(from, clock.current).filter((d) => d.openedBy === person.id || d.closedBy === person.id);
  const devices = new Map(identity.devices().map((d) => [d.id, d.label]));
  const events = audit
    .list()
    .filter((e) => e.actorStaffId === person.id || (e.entityType === 'staff' && e.entityId === person.id))
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, 12);
  const canManage = identity.can(actor.staffId, 'staff.manage');
  const roles = identity.roles().map((r) => ({ value: r.id, label: r.name }));
  const rule = pins.policy();
  const policy = { length: rule.length, expiryDays: rule.expiryDays, ownPinAfterReset: rule.ownPinAfterReset };
  const now = Date.now();
  const tabLabel = (tabId: string) => {
    const tab = trade.tabById(tabId);
    if (!tab) return 'A tab';
    const s = trade.summarise(tab);
    return tab.tabNumber ? `${s.tableLabel}, tab ${tab.tabNumber}` : s.tableLabel;
  };

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={person.fullName} />
      <DetailHeader
        back={{ href: '/console/people/staff', label: 'Staff' }}
        title={
          <span className="flex items-center gap-12">
            {person.avatarUrl ? null : <StaffAvatar name={person.fullName} avatarUrl={null} colourIndex={person.colourIndex} size="md" />}
            {person.fullName}
            {row.isSelf ? <span className="text-title-card text-ink-subtle">(you)</span> : null}
          </span>
        }
        status={<Access row={row} />}
        meta={
          <MetaRow
            items={[
              {
                icon: IconShieldCheck,
                value: role ? (
                  <EntityLink kind="role" id={role.id} muted>
                    {role.name}
                  </EntityLink>
                ) : (
                  'No role'
                ),
              },
              { value: `Shows as ${person.displayName}` },
              person.contactNumber ? { icon: IconPhone, value: person.contactNumber } : null,
              row.signedInOn.length > 0 ? { icon: IconDeviceTablet, value: `Signed in on ${row.signedInOn.join(', ')}` } : null,
            ]}
          />
        }
        actions={<StaffActions row={row} roles={roles} canManage={canManage} policy={policy} timezone={tz} />}
      />

      <Figures shifts={own.length} minutes={minutes} sales={sales} voidsCents={voidsCents} voids={voids.length} holding={holding.length} />

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {person.avatarUrl ? (
          <Card as="section" aria-label={`${person.fullName}, photograph`} className="overflow-hidden">
            <CardMedia src={person.avatarUrl} title={person.fullName} subtitle={role?.name ?? ''} />
            <CardStats>
              <Stat label="Role">{role?.name ?? 'No role'}</Stat>
              <Stat label="Last shift">{row.lastShiftAt ? formatDate(row.lastShiftAt, tz) : 'None yet'}</Stat>
            </CardStats>
          </Card>
        ) : null}
        <div className={person.avatarUrl ? 'min-w-0' : 'min-w-0 desktop:col-span-2'}>
          <SignInCard row={row} roles={roles} canManage={canManage} policy={policy} timezone={tz} lockAttempts={rule.lockAttempts} now={now} />
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="person-shifts">
          <CardHeader band level="h2" titleId="person-shifts" title="Shifts" subtitle="The last four weeks" />
          {own.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="No shifts in four weeks" body="A shift starts when they sign in on a floor tablet or the counter." />
            </div>
          ) : (
            <LedgerList className="mx-8 my-8" label="Shifts">
              {own.slice(0, 10).map((s) => (
                <LedgerItem key={s.id} tone={s.status === 'open' ? 'poured' : undefined}>
                  <span className="flex items-baseline justify-between gap-12">
                    <EntityLink kind="shift" id={s.id} className="text-ui">
                      {formatIsoDate(s.businessDate)}
                    </EntityLink>
                    <Money value={s.salesCents} size="num-md" decimals="whole" />
                  </span>
                  <span className="block text-body-sm text-ink-subtle">
                    {formatTime(s.startedAt, tz)} to {s.endedAt ? formatTime(s.endedAt, tz) : 'now'}, {formatElapsed((s.endedAt ?? Date.now()) - s.startedAt)}, {plural(s.tabsOpened, 'tab')}
                  </span>
                </LedgerItem>
              ))}
            </LedgerList>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="person-tabs">
            <CardHeader band level="h2" titleId="person-tabs" title="Tabs they hold" subtitle={holding.length > 0 ? plural(holding.length, 'open tab') : 'None open now'} />
            {holding.length > 0 ? (
              <LedgerList className="mx-8 my-8" label="Tabs they hold">
                {holding.map((t) => (
                  <LedgerItem key={t.tab.id}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="tab" id={t.tab.id} className="text-ui">
                        {tabLabel(t.tab.id)}
                      </EntityLink>
                      <Money value={t.total} size="num-md" />
                    </span>
                    <span className="block text-body-sm text-ink-subtle">
                      {t.zoneName}, opened {formatTime(t.tab.openedAt, tz)}
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            ) : null}
          </Card>

          <Card aria-labelledby="person-bills">
            <CardHeader
              band
              level="h2"
              titleId="person-bills"
              title="Bills settled"
              subtitle={bills.length > 0 ? 'The last seven days' : 'None in the last seven days'}
              actions={bills.length > 0 ? <Money value={sum(bills.map(settlement.billNet))} size="num-md" decimals="whole" /> : null}
            />
            {bills.length > 0 ? (
              <LedgerList className="mx-8 my-8" label="Bills settled">
                {bills.slice(0, 8).map((b) => (
                  <LedgerItem key={b.id}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="bill" id={b.id} className="text-ui">
                        Bill {b.billNumber}
                      </EntityLink>
                      <Money value={settlement.billNet(b)} size="num-md" />
                    </span>
                    <span className="block text-body-sm text-ink-subtle">{b.settledAt ? formatDateTime(b.settledAt, tz) : formatIsoDate(b.businessDate)}</span>
                  </LedgerItem>
                ))}
                {bills.length > 8 ? (
                  <LedgerItem>
                    <Link href="/console/trade/bills?range=7" className="text-body-sm text-ink-muted transition-hover hover:text-ink">
                      {plural(bills.length - 8, 'more bill')} in Bills
                    </Link>
                  </LedgerItem>
                ) : null}
              </LedgerList>
            ) : null}
          </Card>
        </div>

        <Card aria-labelledby="person-voids">
          <CardHeader band level="h2" titleId="person-voids" title="Voids" subtitle={voids.length > 0 ? 'Lines they rang up or voided, four weeks' : 'Nothing voided in four weeks'} />
          {voids.length > 0 ? (
            <LedgerList className="mx-8 my-8" label="Voided lines">
              {voids.slice(0, 10).map((l) => (
                <LedgerItem key={l.id} tone="stop">
                  <span className="flex items-baseline justify-between gap-12">
                    <EntityLink kind="tab" id={l.tabId} className="text-ui">
                      {tabLabel(l.tabId)}
                    </EntityLink>
                    <Money value={l.lineTotalCents} size="num-md" />
                  </span>
                  <span className="block text-body-sm text-ink-subtle">
                    {l.voidedAt ? formatDateTime(l.voidedAt, tz) : ''}, by {identity.displayName(l.voidedBy)}
                    {l.voidReason ? `: ${l.voidReason}` : ''}
                  </span>
                </LedgerItem>
              ))}
            </LedgerList>
          ) : null}
        </Card>

        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="person-drawers">
            <CardHeader band level="h2" titleId="person-drawers" title="Drawers" subtitle={drawers.length > 0 ? 'Opened or counted by them, four weeks' : 'No drawer in four weeks'} />
            {drawers.length > 0 ? (
              <LedgerList className="mx-8 my-8" label="Drawers">
                {drawers.slice(0, 8).map((d) => (
                  <LedgerItem key={d.id} tone={d.status !== 'closed' ? 'poured' : undefined}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="drawer" id={d.id} className="text-ui">
                        {devices.get(d.deviceId) ?? 'A counter'}, {formatIsoDate(d.businessDate)}
                      </EntityLink>
                      {d.status === 'closed' && d.varianceCents !== null ? <Money value={d.varianceCents} size="num-md" /> : <StatusChip status="open" />}
                    </span>
                    <span className="block text-body-sm text-ink-subtle">{d.openedBy === person.id ? (d.closedBy === person.id ? 'Opened and counted' : 'Opened') : 'Counted'}</span>
                  </LedgerItem>
                ))}
              </LedgerList>
            ) : null}
          </Card>

          <Card aria-labelledby="person-audit">
            <CardHeader band level="h2" titleId="person-audit" title="In the audit trail" subtitle="What they changed, and changes made to them" />
            {events.length === 0 ? (
              <div className="px-20 py-20">
                <EmptyState title="Nothing recorded" body="Changes they make in the Console, and changes to their access, appear here." />
              </div>
            ) : (
              <LedgerList className="mx-8 my-8" label="Audit events">
                {events.map((e) => {
                  const href = hrefForEntity(e.entityType, e.entityId);
                  return (
                    <LedgerItem key={e.id} tone={e.severity === 'sensitive' ? 'stop' : undefined}>
                      <span className="block text-ui text-ink">
                        {href ? (
                          <Link href={href} className="rounded-sm transition-hover hover:text-accent-text">
                            {actionLabel(e.action)}
                          </Link>
                        ) : (
                          actionLabel(e.action)
                        )}
                      </span>
                      <span className="block text-body-sm text-ink-subtle">
                        {formatDateTime(e.occurredAt, tz)}
                        {e.actorStaffId !== person.id ? `, by ${identity.displayName(e.actorStaffId)}` : ''}
                        {e.reason ? `: ${e.reason}` : ''}
                      </span>
                    </LedgerItem>
                  );
                })}
              </LedgerList>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Figures({ shifts, minutes, sales, voidsCents, voids, holding }: { shifts: number; minutes: number; sales: Cents; voidsCents: Cents; voids: number; holding: number }) {
  return (
    <MetricGrid>
      <Metric label="Shifts" icon={IconClock} value={shifts} detail={`${formatElapsed(minutes * 60_000)} worked, four weeks`} />
      <Metric label="Sales" icon={IconReceipt} tone="poured" value={<Money value={sales} size="num-kpi" decimals="whole" />} detail="On their shifts, four weeks" />
      <Metric
        label="Voids"
        icon={IconBan}
        tone={isPositive(voidsCents) ? 'stop' : 'default'}
        value={<Money value={voidsCents} size="num-kpi" decimals="whole" />}
        detail={voids > 0 ? plural(voids, 'line') : 'Nothing voided'}
      />
      <Metric label="Tabs held" icon={IconTable} tone={holding > 0 ? 'info' : 'default'} value={holding} detail={holding > 0 ? 'Open now, in their name' : 'None open now'} />
    </MetricGrid>
  );
}
