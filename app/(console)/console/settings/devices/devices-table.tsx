'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import { formatAgo, formatDate } from '@bliss/shared/format';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconDeviceTabletOff } from '@tabler/icons-react';
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
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-8 text-body text-ink">
              <Dot tone={r.online ? 'poured' : 'info'} />
              {r.online ? 'Online' : 'Offline'}
            </span>
            <span className="text-body-sm text-ink-subtle">{r.lastSeenAt ? `seen ${formatAgo(Math.max(0, now - r.lastSeenAt))}` : 'never seen'}</span>
          </span>
        ),
    },
    { key: 'signedIn', header: 'Signed in', width: '120px', sortValue: (r) => r.signedIn, csv: (r) => r.signedIn ?? '', cell: (r) => <span className="text-body text-ink-muted">{r.signedIn ?? '··'}</span> },
    {
      key: 'held',
      header: 'Not yet sent',
      width: '130px',
      align: 'right',
      sortValue: (r) => r.unsynced,
      csv: (r) => r.unsynced,
      cell: (r) => (r.unsynced > 0 ? <span className="text-body text-info">{r.unsynced} held on the tablet</span> : <NumCell tone="muted">··</NumCell>),
    },
    {
      key: 'version',
      header: 'Version',
      width: '110px',
      sortValue: (r) => r.appVersion,
      csv: (r) => r.appVersion,
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <NumCell tone="muted">{r.appVersion}</NumCell>
          {r.status === 'active' && r.appVersion !== latestVersion ? <span className="text-body-sm text-low">Update waiting</span> : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        id="settings-devices"
        caption="Registered devices"
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
    </>
  );
}
