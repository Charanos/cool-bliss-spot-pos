'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import { formatAgo, formatDate } from '@bliss/shared/format';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric } from '@bliss/ui/components/console/metric';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { useHydrated, useNow } from '@bliss/ui/hooks';
import { IconCheck, IconCloudOff, IconDeviceTablet, IconDeviceTabletOff } from '@tabler/icons-react';
import { ICON_STROKE } from '@bliss/ui/components/icon';
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
          <span className="flex flex-col ">
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
      cell: (r) => (r.unsynced > 0 ? <span className="text-body text-info font-medium">{r.unsynced} held on tablet</span> : <NumCell tone="muted">··</NumCell>),
    },
    {
      key: 'version',
      header: 'Version',
      width: '110px',
      sortValue: (r) => r.appVersion,
      csv: (r) => r.appVersion,
      cell: (r) => (
        <span className="flex flex-col ">
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

  return (
    <div className="flex flex-col gap-20">
      <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-16 rounded-xl bg-control/30 border border-hairline/60 p-16 shadow-[0_2px_8px_rgba(0,0,0,0.02)] backdrop-blur-sm">
        <div className="flex items-center gap-14">
          <div className="flex size-[36px] items-center justify-center rounded-lg bg-accent/15 text-accent-text shrink-0">
            <IconDeviceTablet size={20} stroke={ICON_STROKE} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-8">
              <span className="text-body font-semibold text-ink">OFFLINE-FIRST ARCHITECTURE & POWER TOPOLOGY</span>
              <span className="rounded-full bg-poured-wash border border-poured/30 px-8 py-[1px] text-micro font-bold text-poured uppercase tracking-wider">
                Resilient Ledger
              </span>
            </div>
            <p className="mt-2 text-body-sm text-ink-muted">
              Local ledger on device (Dexie IndexedDB), synchronizing seamlessly when 4G/Wi-Fi returns. Power topology: Dedicated UPS on counter till + thermal printer + router. Battery-powered mobile tablets for floor servers.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
        <Metric
          label="Active fleet"
          icon={IconDeviceTablet}
          tone="default"
          value={<span className="font-mono tabular">{onlineCount} / {activeCount}</span>}
          detail="Devices currently connected"
        />
        <Metric
          label="Unsynced orders"
          icon={IconCloudOff}
          tone={heldOrdersCount > 0 ? 'attention' : 'poured'}
          value={<CountUp value={heldOrdersCount} delayMs={60} />}
          detail={heldOrdersCount > 0 ? 'Queued locally on offline devices' : 'All devices synchronized'}
        />
        <Metric
          label="Floor tablets"
          icon={IconDeviceTablet}
          tone="default"
          value={<CountUp value={tabletsCount} delayMs={120} />}
          detail="Assigned to table service"
        />
        <Metric
          label="App version"
          icon={IconCheck}
          tone="default"
          value={<span className="font-mono tabular">v{latestVersion}</span>}
          detail="Production build status"
        />
      </div>

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
        renderGridCard={(r) => (
          <div className="text-left w-full h-[340px] bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all flex flex-col group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {/* Header */}
            <div className="flex flex-col p-20 bg-desk-hover border-b border-hairline/40 shrink-0">
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-[11px] font-bold tracking-widest text-desk-muted uppercase">{r.kind}</span>
                {r.status !== 'active' ? (
                  <StatusChip status={r.status === 'lost' ? 'lost' : r.status === 'suspended' ? 'suspended' : 'retired'} label={r.status === 'lost' ? 'Withdrawn' : undefined} />
                ) : (
                  <span className="flex items-center gap-8 text-[11px] font-medium text-ink uppercase tracking-wider">
                    <Dot tone={r.online ? 'poured' : 'info'} />
                    {r.online ? 'Online' : 'Offline'}
                  </span>
                )}
              </div>
              <span className="text-title font-medium text-ink truncate mb-4">{r.label}</span>
              <span className="text-micro text-ink-subtle truncate">
                {r.status === 'active' ? (r.lastSeenAt ? `Seen ${formatAgo(Math.max(0, now - r.lastSeenAt))}` : 'Never seen') : r.revokedReason}
              </span>
            </div>

            {/* Details */}
            <div className="flex flex-col flex-1 p-20 text-body-sm bg-page w-full">
              <div className="flex flex-col mt-auto gap-8">
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Signed in</span>
                  <span className="text-ink font-medium truncate ml-16">{r.signedIn ?? '··'}</span>
                </div>
                <div className="flex justify-between items-center py-8 border-b border-hairline/40">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Version</span>
                  <span className={r.status === 'active' && r.appVersion !== latestVersion ? "text-low font-medium" : "text-ink font-medium"}>{r.appVersion}</span>
                </div>
                <div className="flex justify-between items-center py-8">
                  <span className="text-micro font-medium text-ink-subtle uppercase tracking-wider">Unsynced</span>
                  <span className={r.unsynced > 0 ? "text-info font-medium" : "text-ink-muted"}>{r.unsynced > 0 ? `${r.unsynced} held` : '··'}</span>
                </div>
              </div>
              {canManage && r.status === 'active' && (
                <div className="mt-16 pt-16 border-t border-hairline/40 flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setWithdraw({ deviceId: r.id, label: r.label })}
                    className="inline-flex h-[32px] items-center gap-6 rounded-full bg-desk-muted/10 text-stop px-16 text-[13px] font-medium hover:bg-desk-muted/20 transition-colors"
                  >
                    <IconDeviceTabletOff size={14} stroke={2.5} />
                    <span>Withdraw</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      />
      <WithdrawDeviceDialog target={withdraw} onClose={() => setWithdraw(null)} />
    </div>
  );
}
