import { formatAgo, formatDate, formatDateTime, formatIsoDate, plural } from '@bliss/shared/format';
import { sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconCalendar, IconCash, IconCloudOff, IconReceipt, IconUser, IconVersions, IconWifi } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as audit from '@/modules/audit/service';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import * as sync from '@/modules/sync/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { actionLabel } from '../../../_lib/labels';
import { DeviceActions } from './device-actions';

const KIND: Record<string, string> = { floor: 'Floor tablet', counter: 'Counter', bar: 'Bar screen', console: 'Console' };

export async function generateMetadata({ params }: { params: Promise<{ deviceId: string }> }): Promise<Metadata> {
  const { deviceId } = await params;
  return { title: identity.devices().find((d) => d.id === deviceId)?.label ?? 'Device' };
}

/**
 * One device: whether it is connected and paired, who is on it, what it holds that has not been
 * sent, the drawers counted on it and the bills it settled, and what has been done to it.
 */
export default async function DevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const device = identity.devices().find((d) => d.id === deviceId);
  if (!device) notFound();
  const actor = await identity.currentConsoleActor();
  const tz = identity.outlet().timezone;
  const clock = reporting.clock();
  const from = addDays(clock.current, -6);
  const drawers = settlement
    .drawerSessions()
    .filter((d) => d.deviceId === device.id)
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, 8);
  const bills = settlement.billsBetween(from, clock.current).filter((b) => b.deviceId === device.id);
  const isCounter = device.kind === 'counter';
  const orders = isCounter
    ? []
    : trade
        .readTables()
        .orders.filter((o) => o.deviceId === device.id && o.firedAt && o.businessDate >= from)
        .sort((a, b) => (b.firedAt ?? 0) - (a.firedAt ?? 0));
  const tabLabel = (tabId: string) => {
    const tab = trade.tabById(tabId);
    if (!tab) return 'A tab';
    const s = trade.summarise(tab);
    return tab.tabNumber ? `${s.tableLabel}, tab ${tab.tabNumber}` : s.tableLabel;
  };
  const letters = sync.deadLetters().filter((d) => d.deviceId === device.id);
  const open = letters.filter((d) => !d.resolvedAt);
  const events = audit
    .list()
    .filter((e) => (e.entityType === 'device' && e.entityId === device.id) || e.actorDeviceId === device.id)
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, 10);
  const status =
    device.status !== 'active' ? (
      <StatusChip status={device.status === 'lost' ? 'lost' : 'retired'} label={device.status === 'lost' ? 'Withdrawn' : undefined} />
    ) : device.pairingPending ? (
      <ToneChip tone="info">Waiting to pair</ToneChip>
    ) : device.online ? (
      <StatusChip status="active" label="Online" />
    ) : (
      <ToneChip tone="info">Offline</ToneChip>
    );

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={device.label} />
      <DetailHeader
        back={{ href: '/console/settings/devices', label: 'Devices' }}
        title={device.label}
        status={status}
        meta={
          <MetaRow
            items={[
              { value: KIND[device.kind] ?? device.kind },
              { icon: IconCalendar, value: `Registered ${formatDate(device.enrolledAt, tz)} by ${identity.displayName(device.enrolledBy)}` },
              device.appVersion ? { icon: IconVersions, value: `Version ${device.appVersion}` } : null,
              device.signedInStaffId
                ? {
                    icon: IconUser,
                    value: (
                      <EntityLink kind="staff" id={device.signedInStaffId} muted>
                        {identity.displayName(device.signedInStaffId)} signed in
                      </EntityLink>
                    ),
                  }
                : null,
            ]}
          />
        }
        actions={<DeviceActions device={{ id: device.id, label: device.label, status: device.status }} canManage={identity.can(actor.staffId, 'device.manage')} />}
      />

      {device.status !== 'active' ? (
        <Callout tone="stop" title={`Withdrawn${device.revokedAt ? ` ${formatDateTime(device.revokedAt, tz)}` : ''}`}>
          {device.revokedReason ? `${device.revokedReason.replace(/\.$/, '')}. ` : ''}Nobody can sign in on it. Bring it back when it is found or repaired; it pairs again with a new code.
        </Callout>
      ) : device.pairingPending ? (
        <Callout tone="info" title="Waiting for its pairing code">
          Nobody can sign in on it until the code shown when it was registered is entered on the device. If the code is lost, ask for a new one.
        </Callout>
      ) : null}

      <MetricGrid>
        <Metric
          label="Connection"
          icon={IconWifi}
          tone={device.status !== 'active' ? 'default' : device.online ? 'poured' : 'attention'}
          value={<span className="font-sans text-title-lg">{device.status !== 'active' ? 'Withdrawn' : device.online ? 'Online' : 'Offline'}</span>}
          detail={device.lastSeenAt ? `Seen ${formatAgo(Math.max(0, clock.now - device.lastSeenAt))}` : 'Never seen'}
        />
        <Metric
          label="Not yet sent"
          icon={IconCloudOff}
          tone={device.unsyncedCount > 0 ? 'attention' : 'default'}
          value={device.unsyncedCount}
          detail={device.unsyncedCount > 0 ? 'Sent when it reconnects' : 'It has sent everything'}
        />
        <Metric
          label="Could not sync"
          icon={IconCloudOff}
          tone={open.length > 0 ? 'stop' : 'default'}
          href={open.length > 0 ? '/console/settings/sync' : undefined}
          value={open.length}
          detail={letters.length > open.length ? `${letters.length - open.length} resolved before` : 'Nothing refused'}
        />
        {isCounter ? (
          <Metric
            label="Bills settled"
            icon={IconReceipt}
            value={<Money value={sum(bills.map(settlement.billNet))} size="num-kpi" decimals="whole" />}
            detail={`${plural(bills.length, 'bill')}, the last seven days`}
          />
        ) : (
          <Metric label="Orders fired" icon={IconReceipt} value={orders.length} detail="From this device, the last seven days" />
        )}
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        {isCounter ? (
          <Card aria-labelledby="device-drawers">
            <CardHeader band level="h2" titleId="device-drawers" icon={IconCash} title="Drawers counted here" subtitle={drawers.length > 0 ? 'The most recent first' : undefined} />
            {drawers.length === 0 ? (
              <div className="px-20 py-20">
                <EmptyState title="No drawer on this device" body="A counter opens a drawer when the cashier counts the float in." />
              </div>
            ) : (
              <LedgerList className="mx-8 my-8" label="Drawers">
                {drawers.map((d) => (
                  <LedgerItem key={d.id} tone={d.status !== 'closed' ? 'poured' : undefined}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="drawer" id={d.id} className="text-ui">
                        {formatIsoDate(d.businessDate)}
                      </EntityLink>
                      {d.status === 'closed' && d.varianceCents !== null ? <Money value={d.varianceCents} size="num-md" /> : <StatusChip status={d.status === 'counting' ? 'counting' : 'open'} />}
                    </span>
                    <span className="block text-body-sm text-ink-subtle">
                      Opened by {identity.displayName(d.openedBy)}
                      {d.closedBy ? `, counted by ${identity.displayName(d.closedBy)}` : ''}
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            )}
          </Card>
        ) : (
          <Card aria-labelledby="device-orders">
            <CardHeader band level="h2" titleId="device-orders" icon={IconReceipt} title="Orders fired from it" subtitle={orders.length > 0 ? 'The last seven days, most recent first' : undefined} />
            {orders.length === 0 ? (
              <div className="px-20 py-20">
                <EmptyState title="No orders in seven days" body="Orders a waiter fires from this device appear here." />
              </div>
            ) : (
              <LedgerList className="mx-8 my-8" label="Orders fired">
                {orders.slice(0, 10).map((o) => (
                  <LedgerItem key={o.id}>
                    <span className="flex items-baseline justify-between gap-12">
                      <EntityLink kind="tab" id={o.tabId} className="text-ui">
                        {tabLabel(o.tabId)}
                      </EntityLink>
                      <span className="font-mono tabular text-num-sm text-ink-subtle">{o.orderNumber ? `Order ${o.orderNumber}` : ''}</span>
                    </span>
                    <span className="block text-body-sm text-ink-subtle">
                      {formatDateTime(o.firedAt ?? 0, tz)}, {identity.displayName(o.firedBy)}
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            )}
          </Card>
        )}

        <Card aria-labelledby="device-history">
          <CardHeader band level="h2" titleId="device-history" title="What happened to it" subtitle="Registered, paired, renamed, withdrawn" />
          {events.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="Nothing recorded" body="Changes to this device appear here." />
            </div>
          ) : (
            <LedgerList className="mx-8 my-8" label="Device history">
              {events.map((e) => (
                <LedgerItem key={e.id} tone={e.severity === 'sensitive' ? 'stop' : undefined}>
                  <span className="block text-ui text-ink">{actionLabel(e.action)}</span>
                  <span className="block text-body-sm text-ink-subtle">
                    {formatDateTime(e.occurredAt, tz)}, {identity.displayName(e.actorStaffId)}
                    {e.reason ? `: ${e.reason}` : ''}
                  </span>
                </LedgerItem>
              ))}
            </LedgerList>
          )}
          {open.length > 0 ? (
            <p className="border-t border-rule px-20 py-12 text-body-sm text-ink-muted">
              <Link href="/console/settings/sync" className="rounded-sm text-stop transition-hover hover:text-ink">
                {plural(open.length, 'entry', 'entries')} from this device could not sync
              </Link>
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
