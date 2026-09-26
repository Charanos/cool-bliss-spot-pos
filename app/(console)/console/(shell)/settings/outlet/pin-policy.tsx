'use client';

import { PIN_MAX, PIN_MIN } from '@bliss/shared/pin';
import { plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { SelectField, Stepper, Switch, TextArea } from '@bliss/ui/components/fields';
import { IconKey, IconPencil } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { updatePinPolicy } from '../../_actions/people';
import { Fieldset, FormDialog, useDialog } from '../../_components/forms';

export interface PinPolicyDraft {
  length: number;
  expiryDays: number | null;
  lockAttempts: number;
  history: number;
  ownPinAfterReset: boolean;
}

const EXPIRY = [
  { value: 'never', label: 'Never' },
  { value: '30', label: 'After 30 days' },
  { value: '60', label: 'After 60 days' },
  { value: '90', label: 'After 90 days' },
  { value: '180', label: 'After 180 days' },
  { value: '365', label: 'After a year' },
];

function lasts(days: number | null): string {
  return days === null ? 'Never runs out' : `Runs out after ${plural(days, 'day')}`;
}

/**
 * The outlet's PIN rules: how many digits a new PIN has, how long one lasts, how many wrong tries
 * lock it, how many old PINs cannot come back, and whether a reset PIN is only good for one sign-in.
 */
export function PinPolicyCard({ policy, canManage }: { policy: PinPolicyDraft; canManage: boolean }) {
  const dialog = useDialog<'edit'>();
  const [f, setF] = useState(policy);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!dialog.is('edit')) return;
    setF(policy);
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [dialog.is('edit')]);
  const set = <K extends keyof PinPolicyDraft>(key: K, value: PinPolicyDraft[K]) => setF((x) => ({ ...x, [key]: value }));
  const expiry = f.expiryDays === null ? 'never' : String(f.expiryDays);

  return (
    <Card aria-labelledby="outlet-pins">
      <CardHeader
        band
        level="h2"
        titleId="outlet-pins"
        icon={IconKey}
        title="Sign-in and PINs"
        subtitle="For every station and the Console"
        actions={
          canManage ? (
            <Button variant="ghost" size="sm" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
              Change
            </Button>
          ) : null
        }
      />
      <KeyRows>
        <KeyRow label="A new PIN has">{plural(policy.length, 'digit')}</KeyRow>
        <KeyRow label="A PIN">{lasts(policy.expiryDays)}</KeyRow>
        <KeyRow label="Locks for 15 minutes after">{plural(policy.lockAttempts, 'wrong try', 'wrong tries')}</KeyRow>
        <KeyRow label="Cannot come back">{policy.history === 0 ? 'Any old PIN can' : `The last ${plural(policy.history, 'PIN')}`}</KeyRow>
        <KeyRow label="After a reset">{policy.ownPinAfterReset ? 'They choose their own' : 'They keep the one given'}</KeyRow>
      </KeyRows>

      <FormDialog
        open={dialog.is('edit')}
        onClose={dialog.close}
        title="Sign-in and PINs"
        description="New PINs follow these rules. PINs already set keep their length until they are next changed."
        submitLabel="Save the rules"
        onSubmit={() => updatePinPolicy({ ...f, reason })}
        toast={{ title: 'PIN rules saved', body: 'New PINs follow them from now on.' }}
      >
        <Fieldset legend="A new PIN">
          <div className="flex flex-col gap-8">
            <span className="text-label text-ink-muted">Digits</span>
            <Stepper value={f.length} min={PIN_MIN} max={PIN_MAX} onChange={(v) => set('length', v)} label="Digits in a new PIN" size="md" decreaseLabel="Fewer digits" increaseLabel="More digits" />
            <span className="text-body-sm text-ink-subtle">Four is quick to type; eight is far harder to guess.</span>
          </div>
          <SelectField
            label="Runs out"
            value={expiry}
            onChange={(e) => set('expiryDays', e.target.value === 'never' ? null : Number(e.target.value))}
            options={EXPIRY}
            helper="When it runs out, the next sign-in asks for a new one."
          />
        </Fieldset>
        <Fieldset legend="Guarding it">
          <div className="flex flex-col gap-8">
            <span className="text-label text-ink-muted">Wrong tries before it locks</span>
            <Stepper value={f.lockAttempts} min={3} max={10} onChange={(v) => set('lockAttempts', v)} label="Wrong tries before a PIN locks" size="md" />
            <span className="text-body-sm text-ink-subtle">It locks for 15 minutes, or until a manager unlocks it.</span>
          </div>
          <div className="flex flex-col gap-8">
            <span className="text-label text-ink-muted">Old PINs that cannot come back</span>
            <Stepper value={f.history} min={0} max={10} onChange={(v) => set('history', v)} label="Old PINs that cannot be used again" size="md" />
            <span className="text-body-sm text-ink-subtle">Zero lets anyone go back to an old PIN.</span>
          </div>
        </Fieldset>
        <Switch
          checked={f.ownPinAfterReset}
          onChange={(v) => set('ownPinAfterReset', v)}
          label="After a reset, they choose their own"
          helper="A PIN a manager sets works for one sign-in; then the person picks one only they know."
        />
        <TextArea label="Reason (at least 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required placeholder="Longer PINs now the bar has more staff" />
      </FormDialog>
    </Card>
  );
}
