'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import { formatAgo, formatDate, plural } from '@bliss/shared/format';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconCheck, IconCloudOff, IconDeviceTablet, IconDeviceTabletOff } from '@tabler/icons-react';
import { useState } from 'react';
import { WithdrawDeviceDialog } from '../../_components/dialogs';

export interface DeviceTableRow {
  id: string;
  label: string;
  kind: string;
  status: DeviceStatus;
  online: boolean;
  lastSeenAt: number | null;
  signedIn: string | null;
  unsynced: number;
  appVersion: string;
  enrolledAt: number;
  revokedReason: string | null;
}

/** Every registered device: connected or not, who is signed in, and what it holds that is not yet sent. */
export function DevicesTable({ rows, now: serverNow, latestVersion, timezone, canManage }: { rows: DeviceTableRow[]; now: number; latestVersion: string; timezone: string; canManage: boolean }) {
  const [withdraw, setWithdraw] = useState<{ deviceId: string; label: string } | null>(null);
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
        r.status !== 'active' ? (
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
        defaultSort={{ key: 'connection', dir: 'asc' }}
        rowTone={(r) => (r.status !== 'active' ? 'muted' : r.unsynced > 0 ? 'attention' : 'default')}
        rowActions={canManage ? (r) => (r.status === 'active' ? [{ key: 'withdraw', label: `Withdraw ${r.label}`, icon: IconDeviceTabletOff, destructive: true, onSelect: () => setWithdraw({ deviceId: r.id, label: r.label }) }] : []) : undefined}
        exportName="devices"
        empty={{ title: 'No devices registered', body: 'Register a tablet by signing in on it with an owner or manager PIN.' }}
      />
      <WithdrawDeviceDialog target={withdraw} onClose={() => setWithdraw(null)} />
    </div>
  );
}
