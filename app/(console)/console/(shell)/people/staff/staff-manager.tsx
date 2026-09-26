'use client';

import type { EmploymentStatus } from '@bliss/shared/domain';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { useToast } from '@bliss/ui/components/console/toast';
import { SelectField } from '@bliss/ui/components/fields';
import type { ActionItem } from '@bliss/ui/components/action-list';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { IconDoorExit, IconKey, IconKeyOff, IconLockOpen, IconLogout, IconPencil, IconPlayerPause, IconPlayerPlay, IconUserCog } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { clearPin, endSessions, setEmploymentStatus, setStaffRole, unlockPin } from '../../_actions/people';
import { ReasonDialog, useCreateParam } from '../../_components/forms';
import { ChangePinDialog } from '../../_components/shell/change-pin-dialog';
import { PinDialog, type PinPolicyView } from './pin-dialog';
import { StaffDialog } from './staff-dialog';
import type { StaffRow } from './staff-table';

type Pending = { kind: 'role' | 'pin' | 'clear' | 'sessions' | 'own'; row: StaffRow } | { kind: 'status'; row: StaffRow; status: EmploymentStatus };

/**
 * Everything a manager does to a person, in one place for the list and the record: edit, set or
 * reset the PIN, take it away, unlock it, end their sessions, change role, suspend, reinstate, mark
 * as left. Returns the menu for a row, the PIN openers and the dialogs.
 */
export function useStaffManager({
  roles,
  canManage,
  createParam = false,
  policy,
  timezone,
}: {
  roles: { value: string; label: string }[];
  canManage: boolean;
  createParam?: boolean;
  policy: PinPolicyView;
  timezone: string;
}): {
  actions: (r: StaffRow) => ActionItem[];
  add: () => void;
  edit: (r: StaffRow) => void;
  pin: (r: StaffRow, kind: 'pin' | 'clear' | 'sessions' | 'own') => void;
  dialogs: ReactNode;
} {
  const router = useRouter();
  const notify = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  useCreateParam(() => setEditing('new'), canManage && createParam);

  const actions = (r: StaffRow): ActionItem[] => {
    if (!canManage || r.status === 'left') return [];
    const hasPin = r.pin.status !== 'none';
    const items: ActionItem[] = [
      {
        key: 'edit',
        label: 'Edit details',
        icon: IconPencil,
        onSelect: () => setEditing(r),
      },
    ];
    if (r.isSelf) items.push({ key: 'own', label: 'Change my PIN', icon: IconKey, onSelect: () => setPending({ kind: 'own', row: r }) });
    if (r.canSetPin) {
      items.push({ key: 'pin', label: hasPin ? 'Reset the PIN' : 'Set a PIN', icon: IconKey, onSelect: () => setPending({ kind: 'pin', row: r }) });
    }
    if (r.pinLocked) {
      items.push({
        key: 'unlock',
        label: 'Unlock their PIN',
        icon: IconLockOpen,
        onSelect: () => {
          void unlockPin({ staffId: r.id }).then((result) => {
            notify(result.ok ? { title: `${r.displayName}'s PIN unlocked` } : { tone: 'stop', title: 'The PIN is still locked', body: result.message });
            router.refresh();
          });
        },
      });
    }
    if (r.canSetPin) {
      items.push({ key: 'sessions', label: 'End their sessions', icon: IconLogout, onSelect: () => setPending({ kind: 'sessions', row: r }) });
      if (hasPin) items.push({ key: 'clear', label: 'Take the PIN away', icon: IconKeyOff, destructive: true, onSelect: () => setPending({ kind: 'clear', row: r }) });
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

  return {
    actions,
    add: () => setEditing('new'),
    edit: (r) => setEditing(r),
    pin: (r, kind) => setPending({ kind, row: r }),
    dialogs: (
      <>
        <PinDialog
          target={pending?.kind === 'pin' ? { id: pending.row.id, displayName: pending.row.displayName, hasPin: pending.row.pin.status !== 'none' } : null}
          policy={policy}
          timezone={timezone}
          onClose={() => setPending(null)}
        />
        <ChangePinDialog open={pending?.kind === 'own'} onClose={() => setPending(null)} currentLength={pending?.row.pin.length ?? 6} nextLength={policy.length} />
        <ReasonDialog
          open={pending?.kind === 'clear'}
          onClose={() => setPending(null)}
          title={`Take ${pending?.row.displayName ?? 'their'}'s PIN away?`}
          description="Nobody can sign in as them until a new PIN is set. Their sessions end now. Their history stays."
          confirmLabel="Take the PIN away"
          quickReasons={['PIN was shared', 'Away for a long while', 'Access under review']}
          run={(reason) => clearPin({ staffId: pending!.row.id, reason })}
          toast={{ title: `${pending?.row.displayName ?? 'Their'}'s PIN taken away`, body: 'Set a new one when they are back.' }}
        />
        <ReasonDialog
          open={pending?.kind === 'sessions'}
          onClose={() => setPending(null)}
          title={`End ${pending?.row.displayName ?? 'their'}'s sessions?`}
          description="Every device and browser they are signed in on asks for their PIN again. Their PIN does not change."
          confirmLabel="End their sessions"
          destructive={false}
          quickReasons={['Left a device signed in', 'Device lost', 'Shift is over']}
          run={(reason) => endSessions({ staffId: pending!.row.id, reason })}
          toast={{ title: `${pending?.row.displayName ?? 'Their'}'s sessions ended`, body: 'They sign in again with their PIN.' }}
        />
        <StaffDialog target={editing === 'new' ? null : editing} roles={roles} open={editing !== null} onClose={() => setEditing(null)} pinLength={policy.length} />
        <RoleDialog target={pending?.kind === 'role' ? pending.row : null} roles={roles} onClose={() => setPending(null)} />
        <StatusDialog target={pending?.kind === 'status' ? pending : null} onClose={() => setPending(null)} />
      </>
    ),
  };
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
