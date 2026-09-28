'use client';

import { Photo } from '@bliss/ui/components/photo';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { IconUserPlus, IconUserEdit } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { createStaff, updateStaff } from '../../_actions/people';
import { FactList, Fieldset, FormDialog, PhotoField, useOpenStamp } from '../../_components/forms';
import type { StaffRow } from './staff-table';

/** Where each role signs in, read back beside the role as it is chosen. */
const STATIONS: Record<string, string> = {
  Waiter: 'The Floor and the Counter',
  Supervisor: 'The Floor and the Counter',
  Cashier: 'The Counter',
  Manager: 'The Console, the Floor and the Counter',
  Owner: 'The Console, the Floor and the Counter',
  'Stock controller': 'The Console',
};

/**
 * Add or edit a person. A new person can be given a first PIN here, at the outlet's length; after
 * that a PIN is set, reset or taken away from its own dialog, which keeps the reason on record.
 * Beside the photograph, their card as the sign-in screen on a tablet will show it.
 */
export function StaffDialog({
  target,
  roles,
  open,
  onClose,
  pinLength,
}: {
  target?: StaffRow | null;
  roles: { value: string; label: string }[];
  open: boolean;
  onClose: () => void;
  pinLength: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [pin, setPin] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const editing = Boolean(target);

  const stamp = useOpenStamp(open, target?.id);
  useEffect(() => {
    if (!open) return;
    setFullName(target?.name ?? '');
    setDisplayName(target?.displayName ?? '');
    // A new person starts as a waiter, the role with the least reach, never as the first role listed.
    setRoleId(target?.roleId ?? (roles.find((r) => r.label === 'Waiter') ?? roles[roles.length - 1])?.value ?? '');
    setContactNumber(target?.contactNumber ?? '');
    setPin('');
    setAvatarUrl(target?.avatarUrl ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resets when it opens, never on a refresh underneath
  }, [stamp]);

  const shown = displayName.trim() || fullName.trim().split(/\s+/)[0] || 'New person';
  const role = roles.find((r) => r.value === roleId)?.label ?? '';

  const where = STATIONS[roles.find((r) => r.value === roleId)?.label ?? ''] ?? 'Where their role allows';
  const summary = fullName.trim() ? [shown, role || null, editing ? null : pin.length === pinLength ? 'PIN set' : 'PIN to set after'].filter(Boolean).join(' · ') : 'Start with their name.';

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon={editing ? IconUserEdit : IconUserPlus}
      disabled={uploading}
      title={editing ? `Edit ${target?.displayName ?? 'person'}` : 'Add a person'}
      description={editing ? 'Details and role save together. Their PIN has its own dialog.' : 'They can sign in once their PIN is set.'}
      submitLabel={editing ? 'Save changes' : 'Add person'}
      summary={summary}
      aside={
        <>
          {/* Their card as the sign-in screen on a station will show it, while it is being typed. */}
          <figure className="flex flex-col gap-12">
            <figcaption className="label-caps text-ink-subtle">On the sign-in screen</figcaption>
            <div data-theme="dark" aria-hidden="true" className="pointer-events-none flex w-full items-center gap-12 rounded-card bg-page p-12 shadow-lift ring-1 ring-rule-raised/40">
              <span className="flex size-control-lg shrink-0 items-center justify-center overflow-hidden rounded-dot bg-accent-wash text-body font-medium text-accent-text">
                {avatarUrl ? <Photo src={avatarUrl} className="size-full object-cover" /> : shown.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium text-ink">{shown}</span>
                <span className="caps truncate text-ink-subtle">{role || 'Role'}</span>
              </span>
            </div>
          </figure>
          <PhotoField layout="panel" value={avatarUrl || null} name={shown} shape="round" helper="Optional. Their initial shows until there is one." onChange={(url) => setAvatarUrl(url ?? '')} onUploading={setUploading} />
          <FactList
            facts={[
              { label: 'Role', value: role || 'Choose one', muted: !role },
              { label: 'Signs in on', value: where },
              ...(editing ? [] : [{ label: 'PIN', value: pin.length === pinLength ? 'Set, changed at first sign-in' : 'Set after', muted: pin.length !== pinLength }]),
            ]}
          />
        </>
      }
      onSubmit={() => {
        const form = { fullName, displayName, roleId, pin: editing ? null : pin || null, avatarUrl: avatarUrl || null, contactNumber: contactNumber || null };
        return editing && target ? updateStaff({ staffId: target.id, ...form }) : createStaff(form);
      }}
      toast={
        editing
          ? { title: `${displayName || 'Their'} details saved` }
          : { title: `${displayName || 'The person'} added`, body: pin ? 'Hand them the PIN you set. They choose their own at their first sign-in.' : 'They can sign in once their PIN is set.' }
      }
    >
      <Fieldset step={1} legend="Who they are" hint="The display name is what the floor, the tickets and the bills show.">
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" autoComplete="off" required className="tablet:col-span-2" />
        <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane" autoComplete="off" required />
        <TextField label="Contact number" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+254 712 345 678" autoComplete="off" helper="Optional." />
      </Fieldset>

      <Fieldset step={2} legend="What they do" hint="The role decides which stations they sign in on and what they can do there.">
        <SelectField
          label="Role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          options={roles}
          required
          disabled={target?.isSelf}
          helper={target?.isSelf ? 'Another manager changes your role.' : where}
          className="tablet:col-span-2"
        />
      </Fieldset>

      {editing ? null : (
        <Fieldset step={3} legend="Their first PIN" hint="Optional now. They choose their own the first time they sign in." columns={2}>
          <TextField
            label="First PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern={`\\d{${pinLength}}`}
            maxLength={pinLength}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
            placeholder={`${pinLength} digits`}
            helper="Not a run or a repeat. Or set one after, typed or made at random."
          />
        </Fieldset>
      )}
    </FormDialog>
  );
}
