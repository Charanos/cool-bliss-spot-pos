'use client';

import type { EmploymentStatus } from '@bliss/shared/domain';
import { formatDate, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { SelectField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { StatusChip } from '@bliss/ui/components/status';
import { IconDeviceTablet, IconDoorExit, IconLock, IconLockOpen, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlus, IconUserCheck, IconUserCog, IconUsers } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setEmploymentStatus, setStaffRole, unlockPin } from '../../_actions/people';
import { StaffAvatar } from './avatar';
import { StaffDialog } from './staff-dialog';

export interface StaffRow {
  id: string;
  name: string;
  displayName: string;
  colourIndex: number;
  roleId: string;
  role: string;
  status: EmploymentStatus;
  pinState: 'set' | 'needs_reset' | 'development' | 'none';
  avatarUrl: string | null;
  contactNumber: string | null;
  pinLocked: boolean;
  lastShiftAt: number | null;
  shifts: number;
  signedInOn: string[];
  isSelf: boolean;
}

type Pending = { kind: 'role'; row: StaffRow } | { kind: 'status'; row: StaffRow; status: EmploymentStatus };

function Access({ row }: { row: StaffRow }) {
  if (row.status === 'active') return row.pinLocked ? <StatusChip status="suspended" label="PIN locked" /> : <StatusChip status="active" />;
  return <StatusChip status={row.status === 'suspended' ? 'suspended' : 'retired'} label={row.status === 'left' ? 'Left' : undefined} />;
}

/**
 * Everyone who can sign in to Bliss: their role, whether they can get in, and when they last worked.
 * A person without staff.manage sees the list and changes nothing.
 */
export function StaffTable({ rows, roles, canManage, timezone }: { rows: StaffRow[]; roles: { value: string; label: string }[]; canManage: boolean; timezone: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);

  // "Add a person" from the command menu arrives as ?new=1.
  useEffect(() => {
    if (params.get('new') !== '1') return;
    if (canManage) setEditing('new');
    const next = new URLSearchParams(window.location.search);
    next.delete('new');
    window.history.replaceState(null, '', next.size > 0 ? `?${next.toString()}` : window.location.pathname);
  }, [params, canManage]);

  const active = rows.filter((r) => r.status === 'active');
  const ready = active.filter((r) => !r.pinLocked && r.pinState !== 'none').length;
  const signedIn = rows.filter((r) => r.signedInOn.length > 0).length;
  const blocked = rows.filter((r) => r.pinLocked || r.status === 'suspended').length;

  const actions = (r: StaffRow) => {
    if (!canManage || r.status === 'left') return [];
    const items = [
      {
        key: 'edit',
        label: 'Edit details and PIN',
        icon: IconPencil,
        onSelect: () => setEditing(r),
      },
    ];
    if (r.pinLocked) {
      items.push({
        key: 'unlock',
        label: 'Unlock their PIN',
        icon: IconLockOpen,
        onSelect: () => {
          void unlockPin({ staffId: r.id }).then(() => router.refresh());
        },
      });
    }
    if (r.isSelf) return items;
    return [
      ...items,
      {
        key: 'role',
        label: 'Change role',
        icon: IconUserCog,
        onSelect: () => setPending({ kind: 'role', row: r }),
      },
      r.status === 'active'
        ? {
            key: 'suspend',
            label: 'Suspend access',
            icon: IconPlayerPause,
            onSelect: () => setPending({ kind: 'status', row: r, status: 'suspended' }),
          }
        : {
            key: 'reinstate',
            label: 'Reinstate access',
            icon: IconPlayerPlay,
            onSelect: () => setPending({ kind: 'status', row: r, status: 'active' }),
          },
      {
        key: 'left',
        label: 'Mark as left',
        icon: IconDoorExit,
        destructive: true,
        onSelect: () => setPending({ kind: 'status', row: r, status: 'left' }),
      },
    ];
  };

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
          <StaffAvatar name={r.name} avatarUrl={r.avatarUrl} colourIndex={r.colourIndex} />
          <StackCell primary={`${r.name}${r.isSelf ? ' (you)' : ''}`} secondary={`Shows as ${r.displayName}`} />
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '152px',
      sortValue: (r) => r.role,
      csv: (r) => r.role,
      cell: (r) => <span className="text-ui text-ink">{r.role}</span>,
    },
    {
      key: 'status',
      header: 'Access',
      width: '136px',
      sortValue: (r) => r.status,
      csv: (r) => (r.pinLocked ? 'PIN locked' : r.status),
      cell: (r) => <Access row={r} />,
    },
    {
      key: 'on',
      header: 'Signed in on',
      width: 'minmax(128px,1fr)',
      csv: (r) => r.signedInOn.join('; '),
      cell: (r) => <span className="truncate text-ui text-ink-muted">{r.signedInOn.length > 0 ? r.signedInOn.join(', ') : 'Not signed in'}</span>,
    },
    {
      key: 'shifts',
      header: 'Shifts, 28 days',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.shifts,
      csv: (r) => r.shifts,
      cell: (r) => <NumCell>{r.shifts}</NumCell>,
    },
    {
      key: 'last',
      header: 'Last shift',
      width: '120px',
      align: 'right',
      sortValue: (r) => r.lastShiftAt,
      csv: (r) => (r.lastShiftAt ? new Date(r.lastShiftAt).toISOString() : ''),
      cell: (r) => <NumCell tone="muted">{r.lastShiftAt ? formatDate(r.lastShiftAt, timezone) : 'None yet'}</NumCell>,
    },
  ];

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="People" icon={IconUsers} value={<CountUp value={rows.length} />} detail={`${active.length} active, ${plural(roles.length, 'role')}`} />
        <Metric label="Ready to work" icon={IconUserCheck} tone="poured" value={<CountUp value={ready} delayMs={60} />} detail="Active, with a PIN that works" />
        <Metric
          label="Signed in now"
          icon={IconDeviceTablet}
          tone={signedIn > 0 ? 'info' : 'default'}
          value={<CountUp value={signedIn} delayMs={120} />}
          detail={signedIn > 0 ? 'On a floor tablet or the counter' : 'Nobody is signed in'}
        />
        <Metric
          label="Locked out"
          icon={IconLock}
          tone={blocked > 0 ? 'attention' : 'default'}
          value={<CountUp value={blocked} delayMs={180} />}
          detail={blocked > 0 ? 'Suspended, or a PIN locked after wrong tries' : 'Nobody is locked out'}
        />
      </MetricGrid>

      <DataTable
        id="people-staff"
        caption="Staff"
        noun={['person', 'people']}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'name', dir: 'asc' }}
        leading={
          canManage ? (
            <Button variant="primary" size="sm" icon={IconPlus} onClick={() => setEditing('new')}>
              Add a person
            </Button>
          ) : undefined
        }
        search={{
          placeholder: 'Search people',
          test: (r, q) => r.name.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q),
        }}
        filters={[
          {
            kind: 'select',
            key: 'role',
            label: 'Role',
            options: roles,
            test: (r, v) => r.roleId === v,
          },
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
        rowActions={canManage ? actions : undefined}
        exportName="staff"
        empty={{
          title: 'Nobody here yet',
          body: canManage ? 'Add the first person, then give them a role and a PIN.' : 'A manager adds people here.',
        }}
        emptyFiltered={{
          title: 'Nobody matches',
          body: 'Clear the role, access or search to see everyone.',
        }}
        renderGridCard={(r) => {
          const own = actions(r);
          return (
            <Card as="article" tone={r.pinLocked || r.status === 'suspended' ? 'low' : undefined} className="h-full">
              <CardHeader
                band
                icon={<StaffAvatar name={r.name} avatarUrl={r.avatarUrl} colourIndex={r.colourIndex} size="md" />}
                title={`${r.name}${r.isSelf ? ' (you)' : ''}`}
                subtitle={`Shows as ${r.displayName}`}
                actions={own.length > 0 ? <OverflowMenu label={`Actions for ${r.name}`} size="sm" items={own} /> : undefined}
              />
              <CardStats>
                <Stat label="Role">{r.role}</Stat>
                <Stat label="Signed in on">{r.signedInOn.length > 0 ? r.signedInOn.join(', ') : 'Not signed in'}</Stat>
                <Stat label="Shifts, 28 days">{r.shifts}</Stat>
                <Stat label="Last shift">{r.lastShiftAt ? formatDate(r.lastShiftAt, timezone) : 'None yet'}</Stat>
              </CardStats>
              <CardFooter>
                <Access row={r} />
                {canManage && r.status !== 'left' ? (
                  <Button variant="ghost" size="xs" icon={IconPencil} onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        }}
      />
      <StaffDialog target={editing === 'new' ? null : editing} roles={roles} open={editing !== null} onClose={() => setEditing(null)} />
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
    <ConsoleOverlay
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `Change ${target.displayName}'s role?` : ''}
      description="Their permissions change from their next action on any device."
      width="md"
    >
      {target ? (
        <ReasonForm
          key={target.id}
          destructive={false}
          quickReasons={['Promoted', 'Covering a manager', 'Moved to the counter']}
          confirmLabel={`Make ${target.displayName} ${roles.find((r) => r.value === chosen)?.label.toLowerCase() ?? ''}`.trim()}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            if (chosen === target.roleId) throw new Error('Choose a different role.');
            const r = await setStaffRole({
              staffId: target.id,
              roleId: chosen,
              reason,
            });
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

const STATUS_COPY: Record<
  EmploymentStatus,
  {
    title: (name: string) => string;
    description: string;
    confirm: (name: string) => string;
    chips: string[];
  }
> = {
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
            const r = await setEmploymentStatus({
              staffId: target.row.id,
              status: target.status,
              reason,
            });
            if (!r.ok) throw new Error(r.message);
            onClose();
            router.refresh();
          }}
        />
      ) : null}
    </ConsoleOverlay>
  );
}
