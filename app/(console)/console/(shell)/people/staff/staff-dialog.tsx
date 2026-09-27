'use client';

import { Photo } from '@bliss/ui/components/photo';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { IconUserPlus, IconUserEdit } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { createStaff, updateStaff } from '../../_actions/people';
import { Fieldset, FormDialog, PhotoField } from '../../_components/forms';
import type { StaffRow } from './staff-table';

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

  useEffect(() => {
    if (!open) return;
    setFullName(target?.name ?? '');
    setDisplayName(target?.displayName ?? '');
    // A new person starts as a waiter, the role with the least reach, never as the first role listed.
    setRoleId(target?.roleId ?? (roles.find((r) => r.label === 'Waiter') ?? roles[roles.length - 1])?.value ?? '');
    setContactNumber(target?.contactNumber ?? '');
    setPin('');
    setAvatarUrl(target?.avatarUrl ?? '');
  }, [open, target, roles]);

  const shown = displayName.trim() || fullName.trim().split(/\s+/)[0] || 'New person';
  const role = roles.find((r) => r.value === roleId)?.label ?? '';

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon={editing ? IconUserEdit : IconUserPlus}
      disabled={uploading}
      title={editing ? `Edit ${target?.displayName ?? 'person'}` : 'Add a person'}
      description={editing ? 'Details and role save together. Their PIN has its own dialog.' : 'They can sign in once their PIN is set.'}
      submitLabel={editing ? 'Save changes' : 'Add person'}
      onSubmit={() => {
        const form = { fullName, displayName, roleId, pin: editing ? null : pin || null, avatarUrl: avatarUrl || null, contactNumber: contactNumber || null };
        return editing && target ? updateStaff({ staffId: target.id, ...form }) : createStaff(form);
      }}
      toast={
        editing
          ? { title: `${displayName || 'Their'} details saved` }
          : { title: `${displayName || 'The person'} added`, body: pin ? 'Hand them the PIN you set.' : 'They can sign in once their PIN is set.' }
      }
    >
      <div className="grid grid-cols-1 items-center gap-24 desktop:grid-cols-[minmax(0,1fr)_auto]">
        <PhotoField value={avatarUrl || null} name={shown} shape="round" helper="A photo for the sign-in screen, or keep their initials." onChange={(url) => setAvatarUrl(url ?? '')} onUploading={setUploading} />
        <figure className="flex flex-col items-center gap-8">
          <div data-theme="dark" aria-hidden="true" className="pointer-events-none flex w-card-preview items-center gap-12 rounded-card bg-raised p-12 shadow-lift">
            <span className="flex size-control-lg shrink-0 items-center justify-center overflow-hidden rounded-dot text-body text-ink-muted ring-1 ring-rule-raised">
              {avatarUrl ? <Photo src={avatarUrl} className="size-full object-cover" /> : shown.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium text-ink">{shown}</span>
              <span className="caps truncate text-ink-subtle">{role || 'Role'}</span>
            </span>
          </div>
          <figcaption className="text-label text-ink-subtle">On the sign-in screen</figcaption>
        </figure>
      </div>

      <Fieldset legend="Details" hint="The display name is what the floor, the tickets and the bills show.">
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" autoComplete="off" required />
        <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane" autoComplete="off" required />
        <TextField label="Contact number" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+254 712 345 678" autoComplete="off" />
      </Fieldset>

      <Fieldset legend="Access" hint="The role decides which stations they sign in on and what they can do there.">
        <SelectField
          label="Role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          options={roles}
          required
          disabled={target?.isSelf}
          helper={target?.isSelf ? 'Another manager changes your role.' : undefined}
        />
        {editing ? null : (
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
            helper="Optional. Not a run or a repeat. Or set one after, typed or made at random."
          />
        )}
      </Fieldset>
    </FormDialog>
  );
}
