'use client';

import type { EmploymentStatus } from '@bliss/shared/domain';
import { formatDate, plural } from '@bliss/shared/format';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Metric } from '@bliss/ui/components/console/metric';
import { SelectField } from '@bliss/ui/components/fields';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { StatusChip } from '@bliss/ui/components/status';
import { seatBgClass } from '@bliss/ui/lib/seat';
import { IconDeviceTablet, IconDoorExit, IconLock, IconPlayerPause, IconPlayerPlay, IconUserCheck, IconUserCog, IconUsers } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setEmploymentStatus, setStaffRole } from '../../_actions';

export interface StaffRow {
  id: string;
  name: string;
  displayName: string;
  colourIndex: number;
  roleId: string;
  role: string;
  status: EmploymentStatus;
  pinLocked: boolean;
  lastShiftAt: number | null;
  shifts: number;
  signedInOn: string[];
  isSelf: boolean;
}

type Pending = { kind: 'role'; row: StaffRow } | { kind: 'status'; row: StaffRow; status: EmploymentStatus };

export function StaffTable({ rows, roles, canManage, timezone }: { rows: StaffRow[]; roles: { value: string; label: string }[]; canManage: boolean; timezone: string }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const totalStaff = rows.length;
  const activeStaff = rows.filter((r) => r.status === 'active' && !r.pinLocked).length;
  const signedInCount = rows.filter((r) => r.signedInOn.length > 0).length;
  const lockedOrSuspended = rows.filter((r) => r.pinLocked || r.status === 'suspended').length;

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      header: 'Person',
      width: 'minmax(220px,2fr)',
      fixed: true,
      sortValue: (r) => r.name,
      csv: (r) => r.name,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-12">
          <span aria-hidden="true" className={`flex size-control-sm shrink-0 items-center justify-center rounded-sm font-mono text-num-sm text-seat-ink ${seatBgClass(r.colourIndex + 1)}`}>
            {r.displayName.slice(0, 2).toUpperCase()}
          </span>
          <StackCell primary={`${r.name}${r.isSelf ? ' (you)' : ''}`} secondary={`Shows as ${r.displayName}`} />
        </span>
      ),
    },
    { key: 'role', header: 'Role', width: '150px', sortValue: (r) => r.role, csv: (r) => r.role, cell: (r) => <span className="text-body text-ink">{r.role}</span> },
    {
      key: 'status',
      header: 'Access',
      width: '150px',
      sortValue: (r) => r.status,
      csv: (r) => r.status,
      cell: (r) =>
        r.status === 'active' ? (
          r.pinLocked ? (
            <StatusChip status="suspended" label="PIN locked" />
          ) : (
            <StatusChip status="active" />
          )
        ) : (
          <StatusChip status={r.status === 'suspended' ? 'suspended' : 'retired'} label={r.status === 'left' ? 'Left' : undefined} />
        ),
    },
    {
      key: 'on',
      header: 'Signed in on',
      width: 'minmax(120px,1fr)',
      csv: (r) => r.signedInOn.join('; '),
      cell: (r) => <span className="text-body text-ink-muted">{r.signedInOn.length > 0 ? r.signedInOn.join(', ') : '··'}</span>,
    },
    { key: 'shifts', header: 'Shifts, 28 days', width: '120px', align: 'right', sortValue: (r) => r.shifts, csv: (r) => r.shifts, cell: (r) => <NumCell>{r.shifts}</NumCell> },
    {
      key: 'last',
      header: 'Last shift',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.lastShiftAt,
      csv: (r) => (r.lastShiftAt ? new Date(r.lastShiftAt).toISOString() : ''),
      cell: (r) => <NumCell tone="muted">{r.lastShiftAt ? formatDate(r.lastShiftAt, timezone) : '··'}</NumCell>,
    },
  ];

  return (
    <div className="flex flex-col gap-24">
      {/* Executive Staff Roster Metrics */}
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        <Metric
          label="Team Members"
          value={totalStaff}
          detail={`${activeStaff} active · ${plural(roles.length, 'role')}`}
          icon={IconUsers}
          tone="default"
        />
        <Metric
          label="Shift Ready"
          value={activeStaff}
          detail="Credentials clear for service"
          icon={IconUserCheck}
          tone="poured"
        />
        <Metric
          label="Signed In Now"
          value={signedInCount}
          detail="Active terminal sessions"
          icon={IconDeviceTablet}
          tone={signedInCount > 0 ? 'poured' : 'default'}
        />
        <Metric
          label="PIN Locks & Holds"
          value={lockedOrSuspended}
          detail="Requires manager clearance"
          icon={IconLock}
          tone={lockedOrSuspended > 0 ? 'attention' : 'default'}
        />
      </div>

      <DataTable
        id="people-staff"
        caption="Staff"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'name', dir: 'asc' }}
        search={{ placeholder: 'Search people', test: (r, q) => r.name.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'role', label: 'Role', options: roles, test: (r, v) => r.roleId === v },
          {
            kind: 'chips',
            key: 'access',
            label: 'Access',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'left', label: 'Left' },
            ],
            test: (r, v) => r.status === v,
          },
        ]}
        rowTone={(r) => (r.status === 'active' ? 'default' : 'muted')}
        rowActions={
          canManage
            ? (r) =>
                r.isSelf || r.status === 'left'
                  ? []
                  : [
                      { key: 'role', label: 'Change role', icon: IconUserCog, onSelect: () => setPending({ kind: 'role', row: r }) },
                      r.status === 'active'
                        ? { key: 'suspend', label: 'Suspend access', icon: IconPlayerPause, onSelect: () => setPending({ kind: 'status', row: r, status: 'suspended' }) }
                        : { key: 'reinstate', label: 'Reinstate access', icon: IconPlayerPlay, onSelect: () => setPending({ kind: 'status', row: r, status: 'active' }) },
                      { key: 'left', label: 'Mark as left', icon: IconDoorExit, destructive: true, onSelect: () => setPending({ kind: 'status', row: r, status: 'left' }) },
                    ]
            : undefined
        }
        exportName="staff"
        empty={{ title: 'Nobody here yet', body: 'Add the first person, then give them a role and a PIN.' }}
      />
      <RoleDialog target={pending?.kind === 'role' ? pending.row : null} roles={roles} onClose={() => setPending(null)} />
      <StatusDialog target={pending?.kind === 'status' ? pending : null} onClose={() => setPending(null)} />
    </div>
  );
}

function RoleDialog({ target, roles, onClose }: { target: StaffRow | null; roles: { value: string; label: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState('');
  const chosen = roleId || target?.roleId || '';
  return (
    <ConsoleOverlay open={Boolean(target)} onClose={onClose} title={target ? `Change ${target.displayName}'s role?` : ''} description="Their permissions change from their next action on any device." width="md">
      {target ? (
        <ReasonForm
          key={target.id}
          destructive={false}
          quickReasons={['Promoted', 'Covering a manager', 'Moved to the counter']}
          confirmLabel={`Make ${target.displayName} ${roles.find((r) => r.value === chosen)?.label.toLowerCase() ?? ''}`.trim()}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            if (chosen === target.roleId) throw new Error('Choose a different role.');
            const r = await setStaffRole({ staffId: target.id, roleId: chosen, reason });
            if (!r.ok) throw new Error(r.message);
            setRoleId('');
            onClose();
            router.refresh();
          }}
        >
          <div className="pb-16">
            <SelectField label="New role" value={chosen} onChange={(e) => setRoleId(e.target.value)} options={roles} />
          </div>
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}

const STATUS_COPY: Record<EmploymentStatus, { title: (name: string) => string; description: string; confirm: (name: string) => string; chips: string[] }> = {
  suspended: {
    title: (n) => `Suspend ${n}'s access?`,
    description: 'Their PIN stops working on every device. Tabs they hold stay open and can be handed over.',
    confirm: (n) => `Suspend ${n}`,
    chips: ['On leave', 'Under investigation', 'Shared their PIN'],
  },
  active: {
    title: (n) => `Reinstate ${n}'s access?`,
    description: 'Their PIN works again straight away.',
    confirm: (n) => `Reinstate ${n}`,
    chips: ['Back from leave', 'Investigation closed'],
  },
  left: {
    title: (n) => `Mark ${n} as left?`,
    description: 'Their PIN stops working for good. Their history stays in every report.',
    confirm: (n) => `Mark ${n} as left`,
    chips: ['Resigned', 'Contract ended'],
  },
};

function StatusDialog({ target, onClose }: { target: { row: StaffRow; status: EmploymentStatus } | null; onClose: () => void }) {
  const router = useRouter();
  const copy = target ? STATUS_COPY[target.status] : null;
  return (
    <ConsoleOverlay open={Boolean(target)} onClose={onClose} title={target && copy ? copy.title(target.row.displayName) : ''} description={copy?.description} width="md">
      {target && copy ? (
        <ReasonForm
          key={`${target.row.id}-${target.status}`}
          destructive={target.status !== 'active'}
          quickReasons={copy.chips}
          confirmLabel={copy.confirm(target.row.displayName)}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            const r = await setEmploymentStatus({ staffId: target.row.id, status: target.status, reason });
            if (!r.ok) throw new Error(r.message);
            onClose();
            router.refresh();
          }}
        />
      ) : null}
    </ConsoleOverlay>
  );
}
