'use client';

import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { IconCamera } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useState, useTransition } from 'react';
import { createStaff, updateStaff } from '../../_actions/people';
import { uploadFiles } from '../../_lib/upload';
import type { StaffRow } from './staff-table';
import { useToast } from '@bliss/ui/components/console/toast';

/**
 * Add or edit a person. A new person can be given a first PIN here, at the outlet's length; after
 * that a PIN is set, reset or taken away from its own dialog, which keeps the reason on record.
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
  const router = useRouter();
  const notify = useToast();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
  }, [open, target, roles]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    const result = await uploadFiles([file]);
    setUploading(false);
    if (result.ok) setAvatarUrl(result.urls[0] ?? '');
    else setError(result.message);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      const form = { fullName, displayName, roleId, pin: editing ? null : pin || null, avatarUrl: avatarUrl || null, contactNumber: contactNumber || null };
      const result = editing && target ? await updateStaff({ staffId: target.id, ...form }) : await createStaff(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      notify({
        title: target ? `${displayName || 'Their'} details saved` : `${displayName || 'The person'} added`,
        body: target ? undefined : pin ? 'Hand them the PIN you set.' : 'They can sign in once their PIN is set.',
      });
      router.refresh();
    });
  }

  const photo = avatarUrl;
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  return (
    <ConsoleOverlay
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target?.displayName ?? 'person'}` : 'Add a person'}
      description={editing ? 'Details and role save together. Their PIN has its own dialog.' : 'They can sign in once their PIN is set.'}
      width="lg"
    >
      <form onSubmit={save} className="flex flex-col gap-24">
        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}

        <div className="flex items-center gap-16">
          <label className="group relative flex size-avatar shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-dot bg-control text-title-card text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} disabled={uploading} aria-label="Choose a photo" />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden="true">{initials || '?'}</span>
            )}
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-scrim text-on-scrim opacity-0 transition-hover group-hover:opacity-100">
              <IconCamera size={20} stroke={1.5} />
            </span>
          </label>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-title-card text-ink">{fullName || 'New person'}</span>
            <span className="text-body-sm text-ink-muted">{uploading ? 'Uploading the photo' : 'Choose a photo, or keep their initials.'}</span>
          </div>
        </div>

        <fieldset className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          <legend className="mb-8 label-caps text-ink-subtle">Details</legend>
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" autoComplete="off" required />
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane"
            helper="What the floor and the bills show."
            autoComplete="off"
            required
          />
          <TextField label="Contact number" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+254 712 345 678" autoComplete="off" />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          <legend className="mb-8 label-caps text-ink-subtle">Access</legend>
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
        </fieldset>

        <div className="flex justify-end gap-12 border-t border-rule pt-16">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={uploading}>
            {editing ? 'Save changes' : 'Add person'}
          </Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}
