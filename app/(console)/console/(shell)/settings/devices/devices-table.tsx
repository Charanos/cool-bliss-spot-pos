'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import { formatAgo, formatDate, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Dot, StatusChip, ToneChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconBuildingStore, IconCheck, IconCloudOff, IconDeviceDesktop, IconDeviceTablet, IconGlassFull, IconPlus } from '@tabler/icons-react';
import { type DeviceKind, useDeviceManager } from './device-manager';

export interface DeviceTableRow {
  id: string;
  label: string;
  kind: string;
  kindKey: DeviceKind | 'console';
  status: DeviceStatus;
  pairingPending: boolean;
  online: boolean;
  lastSeenAt: number | null;
  signedIn: string | null;
  unsynced: number;
  appVersion: string;
  enrolledAt: number;
  revokedReason: string | null;
}

const KIND_ICON = { floor: IconDeviceTablet, counter: IconBuildingStore, bar: IconGlassFull, console: IconDeviceDesktop } as const;

/** Every registered device: connected or not, who is signed in, and what it holds that is not yet sent. */
export function DevicesTable({ rows, now: serverNow, latestVersion, timezone, canManage }: { rows: DeviceTableRow[]; now: number; latestVersion: string; timezone: string; canManage: boolean }) {
  const manager = useDeviceManager({ canManage, createParam: true });
  const clientNow = useNow(15_000);
  const now = useHydrated() ? clientNow : serverNow;

  const columns: Column<DeviceTableRow>[] = [
    { key: 'label', header: 'Device', width: 'minmax(160px,1.2fr)', fixed: true, sortValue: (r) => r.label, csv: (r) => r.label, cell: (r) => <StackCell primary={r.label} secondary={`${r.kind}, registered ${formatDate(r.enrolledAt, timezone)}`} /> },
    {
      key: 'connection',
      header: 'Connection',
      width: '150px',
      sortValue: (r) => (r.status !== 'active' ? 2 : r.online ? 0 : 1),
      csv: (r) => (r.status !== 'active' ? r.status : r.online ? 'online' : 'offline'),
      cell: (r) =>
        r.status === 'active' && r.pairingPending ? (
          <ToneChip tone="info">Waiting to pair</ToneChip>
        ) : r.status !== 'active' ? (
          <span title={r.revokedReason ?? undefined}>
            <StatusChip status={r.status === 'lost' ? 'lost' : r.status === 'suspended' ? 'suspended' : 'retired'} label={r.status === 'lost' ? 'Withdrawn' : undefined} />
          </span>
        ) : (
          <span className="flex flex-col">
            <span className="flex items-center gap-8 text-ui text-ink">
              <Dot tone={r.online ? 'poured' : 'info'} />
              {r.online ? 'Online' : 'Offline'}
            </span>
            <span className="text-body-sm text-ink-subtle">{r.lastSeenAt ? `seen ${formatAgo(Math.max(0, now - r.lastSeenAt))}` : 'never seen'}</span>
          </span>
        ),
    },
    { key: 'signedIn', header: 'Signed in', width: '120px', sortValue: (r) => r.signedIn, csv: (r) => r.signedIn ?? '', cell: (r) => <span className="text-ui text-ink-muted">{r.signedIn ?? 'Nobody'}</span> },
    {
      key: 'held',
      header: 'Not yet sent',
      width: '130px',
      align: 'right',
      sortValue: (r) => r.unsynced,
      csv: (r) => r.unsynced,
      cell: (r) => (r.unsynced > 0 ? <span className="text-body-sm font-medium text-info">{r.unsynced} held</span> : <NumCell tone="muted">None</NumCell>),
    },
    {
      key: 'version',
      header: 'Version',
      width: '110px',
      sortValue: (r) => r.appVersion,
      csv: (r) => r.appVersion,
      cell: (r) => (
        <span className="flex flex-col">
          <NumCell tone="muted">{r.appVersion}</NumCell>
          {r.status === 'active' && r.appVersion !== latestVersion ? <span className="text-body-sm text-low">Update waiting</span> : null}
        </span>
      ),
    },
  ];

  const onlineCount = rows.filter((r) => r.online).length;
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const heldOrdersCount = rows.reduce((n, r) => n + r.unsynced, 0);
  const tabletsCount = rows.filter((r) => r.kind.toLowerCase().includes('tablet')).length;
  const outdated = rows.filter((r) => r.status === 'active' && r.appVersion !== latestVersion).length;

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Online" icon={IconDeviceTablet} tone={onlineCount < activeCount ? 'attention' : 'poured'} value={`${onlineCount} of ${activeCount}`} detail="Registered devices connected now" />
        <Metric
          label="Orders held on a device"
          icon={IconCloudOff}
          tone={heldOrdersCount > 0 ? 'attention' : 'default'}
          href="/console/settings/sync"
          value={<CountUp value={heldOrdersCount} delayMs={60} />}
          detail={heldOrdersCount > 0 ? 'They send when the device reconnects' : 'Every device has sent everything'}
        />
        <Metric label="Floor tablets" icon={IconDeviceTablet} value={<CountUp value={tabletsCount} delayMs={120} />} detail="Used by waiters on the floor" />
        <Metric label="Latest version" icon={IconCheck} value={latestVersion || 'None'} detail={outdated > 0 ? `${plural(outdated, 'device')} not yet updated` : 'Every device is up to date'} tone={outdated > 0 ? 'attention' : 'default'} />
      </MetricGrid>

      <p className="measure text-body-sm text-ink-muted">Each tablet keeps working without a connection and sends what it holds when it reconnects. A device that is lost or stolen is withdrawn here, and its PIN sessions end.</p>

      <DataTable
        id="settings-devices"
        caption="Registered devices"
        noun={['device', 'devices']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/console/settings/devices/${r.id}`}
        defaultSort={{ key: 'connection', dir: 'asc' }}
        leading={
          canManage ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={manager.register}>
              Register a device
            </Button>
          ) : null
        }
        renderGridCard={(r) => {
          const Icon = KIND_ICON[r.kindKey];
          const own = manager.actions(r);
          return (
            <Card as="article" interactive className="group h-full" tone={r.status !== 'active' ? undefined : r.unsynced > 0 ? 'low' : r.online ? 'poured' : undefined}>
              <CardHeader
                band
                icon={Icon}
                title={r.label}
                subtitle={r.kind}
                href={`/console/settings/devices/${r.id}`}
                meta={
                  r.status !== 'active' ? (
                    <StatusChip status={r.status === 'lost' ? 'lost' : 'retired'} label={r.status === 'lost' ? 'Withdrawn' : undefined} />
                  ) : r.pairingPending ? (
                    <ToneChip tone="info">Waiting to pair</ToneChip>
                  ) : (
                    <span className="flex items-center gap-6 text-body-sm text-ink-muted">
                      <Dot tone={r.online ? 'poured' : 'info'} className={r.online ? 'animate-breathe' : undefined} />
                      {r.online ? 'Online' : 'Offline'}
                    </span>
                  )
                }
                actions={own.length > 0 ? <OverflowMenu label={`More for ${r.label}`} size="sm" items={own} /> : undefined}
              />
              <CardStats columns={3}>
                <Stat label="Signed in">{r.signedIn ?? 'Nobody'}</Stat>
                <Stat label="Not yet sent" tone={r.unsynced > 0 ? 'low' : undefined}>
                  {r.unsynced > 0 ? r.unsynced : 'None'}
                </Stat>
                <Stat label="Version">{r.appVersion || 'Not yet'}</Stat>
              </CardStats>
              <CardFooter>
                <span className="text-body-sm text-ink-muted">{r.lastSeenAt ? `Seen ${formatAgo(Math.max(0, now - r.lastSeenAt))}` : 'Never seen'}</span>
                <span className="text-body-sm text-ink-subtle">Since {formatDate(r.enrolledAt, timezone)}</span>
              </CardFooter>
            </Card>
          );
        }}
        rowTone={(r) => (r.status !== 'active' ? 'muted' : r.unsynced > 0 ? 'attention' : 'default')}
        rowActions={canManage ? manager.actions : undefined}
        exportName="devices"
        empty={{ title: 'No devices registered', body: 'Register a tablet here, then pair it with the code shown.' }}
      />
      {manager.dialogs}
    </div>
  );
}
