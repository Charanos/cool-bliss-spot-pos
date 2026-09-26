'use client';

import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Button } from '@bliss/ui/components/button';
import { TextField, SelectField } from '@bliss/ui/components/fields';
import { IconCamera } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { staffPhoto } from '@/lib/pos/staff-photos';
import React, { useState, useTransition, useEffect } from 'react';
import { createStaff, updateStaff, setStaffRole } from '../../_actions';
import type { StaffRow } from './staff-table';

export function StaffDialog({ target, roles, open, onClose }: { target?: StaffRow | null; roles: { value: string; label: string }[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState(target?.name ?? '');
  const [displayName, setDisplayName] = useState(target?.displayName ?? '');
  const [roleId, setRoleId] = useState(target?.roleId ?? roles[0]?.value ?? '');
  const [contactNumber, setContactNumber] = useState(target?.contactNumber ?? '');
  const [pinHash, setPinHash] = useState(target?.pinHash ?? '');
  const [avatarUrl, setAvatarUrl] = useState(target?.avatarUrl ?? '');

  const isEdit = Boolean(target);

  useEffect(() => {
    if (open) {
      setFullName(target?.name ?? '');
      setDisplayName(target?.displayName ?? '');
      setRoleId(target?.roleId ?? roles[0]?.value ?? '');
      setContactNumber(target?.contactNumber ?? '');
      setPinHash(target?.pinHash ?? '');
      setAvatarUrl(target?.avatarUrl ?? '');
      setError('');
    }
  }, [open, target, roles]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const payload = {
        fullName,
        displayName,
        roleId,
        pinHash: pinHash || null,
        avatarUrl: avatarUrl || null,
        contactNumber: contactNumber || null,
      };

      const result = isEdit && target ? await updateStaff({ staffId: target.id, ...payload }) : await createStaff(payload);

      if (!result.ok) {
        setError(result.message);
      } else {
        if (isEdit && target && target.roleId !== roleId) {
          await setStaffRole({ staffId: target.id, roleId, reason: 'Updated via Console Edit' });
        }
        onClose();
        router.refresh();
      }
    });
  }

  const effectiveAvatar = avatarUrl || staffPhoto(displayName);

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={isEdit ? 'Edit Person' : 'Add Person'} description={isEdit ? 'Update details, PIN, and role for this team member.' : 'Add a new member to the team.'} width="lg">
      <form onSubmit={handleSave} className="flex flex-col gap-32 pb-16">
        {error && <div className="text-attention-text bg-attention-wash p-12 rounded-sm text-body-sm">{error}</div>}

        <div className="flex items-center gap-16 mb-4">
          <label className="group relative size-[64px] rounded-full overflow-hidden bg-seat-ink text-white flex items-center justify-center font-medium text-[24px] shadow-sm cursor-pointer transition-transform hover:scale-105 active:scale-95">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            {effectiveAvatar ? (
              <>
                <img src={effectiveAvatar} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <IconCamera size={24} className="text-white" stroke={1.5} />
                </div>
              </>
            ) : (
              <>
                <span>{displayName.slice(0, 2).toUpperCase() || '??'}</span>
                <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <IconCamera size={24} className="text-white" stroke={1.5} />
                </div>
              </>
            )}
          </label>
          <div className="flex flex-col">
            <span className="text-body font-medium text-ink">{fullName || 'New Person'}</span>
            <span className="text-body-sm text-ink-subtle">Upload Profile Photo</span>
          </div>
        </div>

        <div className="flex flex-col gap-12">
          <h3 className="text-label text-ink-subtle uppercase tracking-wider pl-4">Personal Information</h3>
          <div className="flex flex-col bg-page rounded-[16px] border border-hairline/60 p-24 shadow-[0_2px_12px_rgba(0,0,0,0.02)] gap-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <TextField label="Full name" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} placeholder="e.g. Jane Doe" required />
              <TextField label="Display name" value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} placeholder="e.g. Jane" helper="Shown on receipts and tablets" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <TextField label="Contact number" type="tel" value={contactNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactNumber(e.target.value)} placeholder="e.g. +254..." />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-12">
          <h3 className="text-label text-ink-subtle uppercase tracking-wider pl-4">Security & Access</h3>
          <div className="flex flex-col bg-page rounded-[16px] border border-hairline/60 p-24 shadow-[0_2px_12px_rgba(0,0,0,0.02)] gap-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <SelectField label="Role" value={roleId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRoleId(e.target.value)} options={roles} required />
              <TextField label="PIN (for sign in)" type="password" value={pinHash} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPinHash(e.target.value)} placeholder="6 digits recommended" helper="Their secure sign-in code" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-12 mt-8 pt-16 border-t border-hairline/40">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Save changes</Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}
