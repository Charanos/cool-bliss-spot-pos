'use client';

import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Button } from '@bliss/ui/components/button';
import { TextField, SelectField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';
import type { Zone } from '@bliss/shared/domain';
import { createZone, updateZone } from '../../_actions';

export function ZoneDialog({ target, open, onClose }: { target?: Zone | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [name, setName] = useState(target?.name ?? '');
  const [sortOrder, setSortOrder] = useState(target?.sortOrder?.toString() ?? '0');
  const [status, setStatus] = useState<'active' | 'archived'>(target?.status ?? 'active');

  const isEdit = Boolean(target);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const payload = {
        name,
        sortOrder: parseInt(sortOrder, 10) || 0,
        defaultPriceListId: null,
      };

      const result = isEdit && target 
        ? await updateZone({ zoneId: target.id, status, ...payload }) 
        : await createZone(payload);

      if (!result.ok) {
        setError(result.message);
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={isEdit ? 'Edit Zone' : 'Add Zone'} description={isEdit ? 'Update area details.' : 'Define a new floor area or counter.'} width="md">
      <form onSubmit={handleSave} className="flex flex-col gap-32 pb-16">
        {error && <div className="text-attention-text bg-attention-wash p-12 rounded-sm text-body-sm">{error}</div>}

        <div className="flex flex-col gap-12">
          <h3 className="text-label text-ink-subtle uppercase tracking-wider pl-4">Zone Properties</h3>
          <div className="flex flex-col bg-page rounded-[16px] border border-hairline/60 p-24 shadow-[0_2px_12px_rgba(0,0,0,0.02)] gap-24">
            <TextField label="Zone Name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g. Main Floor" required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <TextField label="Sort Order" type="number" value={sortOrder} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSortOrder(e.target.value)} required />
              {isEdit && (
                <SelectField label="Status" value={status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as any)} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} required />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-12 mt-8 pt-16 border-t border-hairline/40">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Save</Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}
