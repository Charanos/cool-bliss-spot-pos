'use client';

import type { EmploymentStatus } from '@bliss/shared/domain';
import { formatDate, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader, CardMedia, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { StatusChip } from '@bliss/ui/components/status';
import { IconDeviceTablet, IconLock, IconPencil, IconPlus, IconUserCheck, IconUsers } from '@tabler/icons-react';
import { StaffAvatar } from './avatar';
import { useStaffManager } from './staff-manager';

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

export function Access({ row }: { row: StaffRow }) {
  if (row.status === 'active') return row.pinLocked ? <StatusChip status="suspended" label="PIN locked" /> : <StatusChip status="active" />;
  return <StatusChip status={row.status === 'suspended' ? 'suspended' : 'retired'} label={row.status === 'left' ? 'Left' : undefined} />;
}

/**
 * Everyone who can sign in to Bliss: their role, whether they can get in, and when they last worked.
 * A person without staff.manage sees the list and changes nothing.
 */
export function StaffTable({ rows, roles, canManage, timezone }: { rows: StaffRow[]; roles: { value: string; label: string }[]; canManage: boolean; timezone: string }) {
  const manager = useStaffManager({ roles, canManage, createParam: true });
  const actions = manager.actions;

  const active = rows.filter((r) => r.status === 'active');
  const ready = active.filter((r) => !r.pinLocked && r.pinState !== 'none').length;
  const signedIn = rows.filter((r) => r.signedInOn.length > 0).length;
  const blocked = rows.filter((r) => r.pinLocked || r.status === 'suspended').length;

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
        rowHref={(r) => `/console/people/staff/${r.id}`}
        defaultSort={{ key: 'name', dir: 'asc' }}
        leading={
          canManage ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={manager.add}>
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
            <Card as="article" interactive tone={r.pinLocked || r.status === 'suspended' ? 'low' : undefined} className="group h-full">
              {r.avatarUrl ? (
                <CardMedia src={r.avatarUrl} title={`${r.name}${r.isSelf ? ' (you)' : ''}`} subtitle={`${r.role}, shows as ${r.displayName}`} href={`/console/people/staff/${r.id}`} meta={own.length > 0 ? <OverflowMenu label={`Actions for ${r.name}`} size="sm" items={own} /> : null} />
              ) : (
                <CardHeader
                  band
                  icon={<StaffAvatar name={r.name} avatarUrl={r.avatarUrl} colourIndex={r.colourIndex} size="md" />}
                  title={`${r.name}${r.isSelf ? ' (you)' : ''}`}
                  subtitle={`Shows as ${r.displayName}`}
                  href={`/console/people/staff/${r.id}`}
                  actions={own.length > 0 ? <OverflowMenu label={`Actions for ${r.name}`} size="sm" items={own} /> : undefined}
                />
              )}
              <CardStats>
                <Stat label="Role">{r.role}</Stat>
                <Stat label="Signed in on">{r.signedInOn.length > 0 ? r.signedInOn.join(', ') : 'Not signed in'}</Stat>
                <Stat label="Shifts, 28 days">{r.shifts}</Stat>
                <Stat label="Last shift">{r.lastShiftAt ? formatDate(r.lastShiftAt, timezone) : 'None yet'}</Stat>
              </CardStats>
              <CardFooter>
                <Access row={r} />
                {canManage && r.status !== 'left' ? (
                  <Button variant="ghost" size="xs" icon={IconPencil} onClick={() => manager.edit(r)}>
                    Edit
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        }}
      />
      {manager.dialogs}
    </div>
  );
}

