'use client';

import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Button } from '@bliss/ui/components/button';
import { TextField, SelectField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';
import type { ServiceTable, Zone } from '@bliss/shared/domain';
import { createServiceTable, updateServiceTable } from '../../_actions/people';

export function TableDialog({ target, zones, open, onClose }: { target?: ServiceTable | null; zones: Zone[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [label, setLabel] = useState(target?.label ?? '');
  const [zoneId, setZoneId] = useState(target?.zoneId ?? zones[0]?.id ?? '');
  const [seats, setSeats] = useState(target?.seats?.toString() ?? '4');
  const [status, setStatus] = useState<'available' | 'occupied' | 'out_of_service'>(target?.status ?? 'available');

  const isEdit = Boolean(target);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const payload = {
        label,
        zoneId,
        seats: parseInt(seats, 10) || 4,
        positionX: target?.positionX ?? 0,
        positionY: target?.positionY ?? 0,
      };

      const result = isEdit && target 
        ? await updateServiceTable({ tableId: target.id, status, ...payload }) 
        : await createServiceTable(payload);

      if (!result.ok) {
        setError(result.message);
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={isEdit ? 'Edit Table' : 'Add Table'} description={isEdit ? 'Update table properties.' : 'Create a new table for service.'} width="md">
      <form onSubmit={handleSave} className="flex flex-col gap-32 pb-16">
        {error && <div className="text-attention-text bg-attention-wash p-12 rounded-sm text-body-sm">{error}</div>}

        <div className="flex flex-col gap-12">
          <h3 className="text-label text-ink-subtle uppercase tracking-wider pl-4">Table Details</h3>
          <div className="flex flex-col bg-page rounded-[16px] border border-hairline/60 p-24 shadow-[0_2px_12px_rgba(0,0,0,0.02)] gap-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <TextField label="Table Label" value={label} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)} placeholder="e.g. T1" required />
              <SelectField label="Zone" value={zoneId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZoneId(e.target.value)} options={zones.map(z => ({ value: z.id, label: z.name }))} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              <TextField label="Seat Count" type="number" value={seats} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeats(e.target.value)} required />
              {isEdit && (
                <SelectField label="Status" value={status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as any)} options={[{ value: 'available', label: 'Available' }, { value: 'out_of_service', label: 'Out of Service' }]} required />
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
