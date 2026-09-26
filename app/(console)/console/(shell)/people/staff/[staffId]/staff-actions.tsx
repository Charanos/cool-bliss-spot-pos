'use client';

import { formatDate, plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconKey, IconLockOpen, IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { unlockPin } from '../../../_actions/people';
import type { PinPolicyView } from '../pin-dialog';
import { useStaffManager } from '../staff-manager';
import { PinChip, type StaffRow } from '../staff-table';

/** The person's own actions, beside their name: the same as the list's row menu. */
export function StaffActions({ row, roles, canManage, policy, timezone }: { row: StaffRow; roles: { value: string; label: string }[]; canManage: boolean; policy: PinPolicyView; timezone: string }) {
  const manager = useStaffManager({ roles, canManage, policy, timezone });
  if (!canManage || row.status === 'left') return null;
  const items = manager.actions(row).filter((a) => a.key !== 'edit');
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => manager.edit(row)}>
        Edit details
      </Button>
      {items.length > 0 ? <OverflowMenu label={`More for ${row.displayName}`} items={items} /> : null}
      {manager.dialogs}
    </>
  );
}

const STATE: Record<StaffRow['pin']['status'], string> = {
  none: 'No PIN',
  set: 'Set',
  expiring: 'Running out soon',
  expired: 'Ran out',
  must_change: 'Chooses their own next',
  locked: 'Locked after wrong tries',
};

/**
 * How this person signs in: their PIN's state, length and dates, and, for a manager who outranks
 * them, the controls to set, reset, unlock or take it away and to end their sessions.
 */
export function SignInCard({
  row,
  roles,
  canManage,
  policy,
  timezone,
  lockAttempts,
  now,
}: {
  row: StaffRow;
  roles: { value: string; label: string }[];
  canManage: boolean;
  policy: PinPolicyView;
  timezone: string;
  lockAttempts: number;
  now: number;
}) {
  const router = useRouter();
  const notify = useToast();
  const manager = useStaffManager({ roles, canManage, policy, timezone });
  const { status, length, setAt, expiresAt } = row.pin;
  const tone = status === 'none' || status === 'expired' || status === 'locked' ? 'stop' : status === 'expiring' ? 'low' : status === 'must_change' ? 'accent' : 'poured';
  const managed = canManage && row.canSetPin && row.status !== 'left';

  return (
    <Card aria-labelledby="person-sign-in" tone={tone === 'stop' ? 'stop' : tone === 'low' ? 'low' : undefined}>
      <CardHeader
        band
        level="h2"
        titleId="person-sign-in"
        title="Sign-in"
        subtitle={row.isSelf ? 'Your PIN, for every station and the Console' : 'Their PIN, for every station and the Console'}
        meta={<PinChip row={row} now={now} />}
      />
      <KeyRows>
        <KeyRow label="PIN" tone={tone}>
          {STATE[status]}
        </KeyRow>
        <KeyRow label="Digits">{status === 'none' ? 'None' : length}</KeyRow>
        <KeyRow label="Set on">{setAt ? formatDate(setAt, timezone) : 'Before records began'}</KeyRow>
        <KeyRow label="Runs out" tone={status === 'expired' ? 'stop' : status === 'expiring' ? 'low' : undefined}>
          {expiresAt ? formatDate(expiresAt, timezone) : 'Never'}
        </KeyRow>
        <KeyRow label="Locks after">{plural(lockAttempts, 'wrong try', 'wrong tries')}</KeyRow>
      </KeyRows>
      {managed || row.isSelf || (canManage && row.pinLocked) ? (
        <div className="flex flex-wrap gap-8 border-t border-rule px-20 py-16">
          {managed ? (
            <Button variant="primary" size="sm" icon={IconKey} onClick={() => manager.pin(row, 'pin')}>
              {status === 'none' ? 'Set a PIN' : 'Reset the PIN'}
            </Button>
          ) : null}
          {row.isSelf ? (
            <Button variant="outline" size="sm" icon={IconKey} onClick={() => manager.pin(row, 'own')}>
              Change my PIN
            </Button>
          ) : null}
          {canManage && row.pinLocked ? (
            <Button
              variant="outline"
              size="sm"
              icon={IconLockOpen}
              onClick={() =>
                void unlockPin({ staffId: row.id }).then((r) => {
                  notify(r.ok ? { title: `${row.displayName}'s PIN unlocked` } : { tone: 'stop', title: 'The PIN is still locked', body: r.message });
                  router.refresh();
                })
              }
            >
              Unlock
            </Button>
          ) : null}
          {managed ? (
            <Button variant="ghost" size="sm" onClick={() => manager.pin(row, 'sessions')}>
              End their sessions
            </Button>
          ) : null}
          {managed && status !== 'none' ? (
            <Button variant="ghost" size="sm" onClick={() => manager.pin(row, 'clear')}>
              Take the PIN away
            </Button>
          ) : null}
        </div>
      ) : !row.canSetPin && canManage && !row.isSelf ? (
        <p className="border-t border-rule px-20 py-16 text-body-sm text-ink-muted">Only an owner sets the PIN of a manager or another owner.</p>
      ) : null}
      {manager.dialogs}
    </Card>
  );
}
